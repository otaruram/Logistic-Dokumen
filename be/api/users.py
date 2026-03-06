"""
User API routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from supabase import create_client, Client

from config.database import get_db
from config.settings import settings
from models.models import User, Scan, Invoice
from schemas.schemas import UserResponse
from utils.auth import get_current_active_user, get_current_user

router = APIRouter()

# Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

@router.get("/profile", response_model=UserResponse)
async def get_user_profile(current_user: User = Depends(get_current_active_user)):
    """Get user profile"""
    return current_user

@router.get("/credits")
async def get_user_credits(current_user: User = Depends(get_current_active_user)):
    """Get user credits balance from Supabase profiles (source of truth)"""
    from utils.auth import supabase_admin
    
    try:
        if supabase_admin:
            profile_res = supabase_admin.table("profiles").select("credits").eq("id", str(current_user.id)).single().execute()
            if profile_res.data:
                return {
                    "credits": profile_res.data.get("credits", 0),
                    "user_id": current_user.id
                }
    except Exception as e:
        print(f"Warning: Could not read credits from Supabase profiles: {e}")
    
    # Fallback to local DB
    return {
        "credits": current_user.credits,
        "user_id": current_user.id
    }

@router.delete("/delete-account")
async def delete_account(
    db: Session = Depends(get_db),
    user_auth = Depends(get_current_user)
):
    """Delete user account and ALL related data (local DB + Supabase)."""
    from utils.auth import supabase_admin

    try:
        user_id = str(user_auth.id)

        # ── 1. Wipe Supabase tables (cloud data) ──
        if supabase_admin:
            # First, get all session IDs to delete chat_messages via session_id
            try:
                sessions = supabase_admin.table("chat_sessions") \
                    .select("id") \
                    .eq("user_id", user_id) \
                    .execute()
                session_ids = [s["id"] for s in (sessions.data or [])]
                for sid in session_ids:
                    try:
                        supabase_admin.table("chat_messages").delete().eq("session_id", sid).execute()
                    except Exception:
                        pass
                print(f"  🗑️ Cleared chat_messages for {len(session_ids)} sessions")
            except Exception as e:
                print(f"  ⚠️ Could not clear chat_messages: {e}")

            # Tables with user_id column
            user_id_tables = [
                "chat_sessions",
                "extracted_finance_data",
                "fraud_scans",
                "documents",
                "imagekit_files",
                "reviews",
            ]
            for table in user_id_tables:
                try:
                    supabase_admin.table(table).delete().eq("user_id", user_id).execute()
                    print(f"  🗑️ Cleared {table}")
                except Exception as e:
                    print(f"  ⚠️ Could not clear {table}: {e}")

            # profiles uses 'id' not 'user_id'
            try:
                supabase_admin.table("profiles").delete().eq("id", user_id).execute()
                print(f"  🗑️ Cleared profiles")
            except Exception as e:
                print(f"  ⚠️ Could not clear profiles: {e}")

        # ── 2. Wipe local DB (SQLite/Postgres) ──
        db_user = db.query(User).filter(User.email == user_auth.email).first()
        if db_user:
            db.query(Scan).filter(Scan.user_id == db_user.id).delete()
            # Invoice table might not have issue_date column in DB
            try:
                db.query(Invoice).filter(Invoice.user_id == db_user.id).delete()
            except Exception as e:
                print(f"  ⚠️ Could not clear invoices: {e}")
                db.rollback()
            db.delete(db_user)
            db.commit()
            print(f"  🗑️ Local DB cleared for {user_auth.email}")

        # ── 3. Delete Supabase Auth user (needs SERVICE_ROLE_KEY) ──
        try:
            supabase_admin.auth.admin.delete_user(user_id)
            print(f"✅ User {user_auth.email} fully deleted from Supabase Auth")
        except Exception as e:
            print(f"⚠️ Could not delete Supabase Auth user: {e}")

        return {
            "success": True,
            "message": "Account and all data deleted successfully"
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        print(f"❌ Delete account error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")


