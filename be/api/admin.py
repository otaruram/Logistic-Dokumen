"""
Admin API — restricted to admin email (okitr52@gmail.com)
Endpoints: user management, activity monitoring, token/ban/retention controls
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

from models.models import User, Scan
from utils.auth import get_current_active_user
from config.database import get_db
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
)

ADMIN_EMAIL = "okitr52@gmail.com"


def require_admin(current_user: User = Depends(get_current_active_user)):
    """Dependency that checks if the current user is admin."""
    if current_user.email != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access only")
    return current_user


def get_supabase():
    from utils.auth import supabase_admin
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return supabase_admin


class CreditUpdate(BaseModel):
    credits: int


class BanUpdate(BaseModel):
    banned: bool


class RetentionUpdate(BaseModel):
    extra_days: int = 30


# ── Global Stats ─────────────────────────────────────────

@router.get("/stats")
async def get_admin_stats(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Global platform statistics."""
    sb = get_supabase()

    # Total users from profiles
    try:
        profiles = sb.table("profiles").select("id, credits, updated_at").execute()
        total_users = len(profiles.data) if profiles.data else 0
    except Exception:
        profiles = type('obj', (object,), {'data': []})()
        total_users = 0

    # Total scans (local DB)
    total_scans = db.query(Scan).count()

    # Total chat sessions
    try:
        sessions = sb.table("chat_sessions").select("id", count="exact").execute()
        total_sessions = sessions.count if sessions.count else 0
    except Exception:
        total_sessions = 0

    # Total chat messages
    try:
        msgs = sb.table("chat_messages").select("id", count="exact").execute()
        total_messages = msgs.count if msgs.count else 0
    except Exception:
        total_messages = 0

    # Total fraud scans
    try:
        fraud = sb.table("fraud_scans").select("id", count="exact").execute()
        total_fraud = fraud.count if fraud.count else 0
    except Exception:
        total_fraud = 0

    # Active today (profiles updated today)
    today = datetime.utcnow().date().isoformat()
    active_today = 0
    if profiles.data:
        for p in profiles.data:
            if p.get("updated_at", "").startswith(today):
                active_today += 1

    return {
        "total_users": total_users,
        "active_today": active_today,
        "total_scans": total_scans,
        "total_fraud_scans": total_fraud,
        "total_chat_sessions": total_sessions,
        "total_chat_messages": total_messages,
    }


# ── User List ────────────────────────────────────────────

@router.get("/users")
async def list_all_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all users with profile info, credits, and activity summary."""
    sb = get_supabase()

    # Get all profiles from Supabase
    try:
        profiles_res = sb.table("profiles").select("*").execute()
        profiles = profiles_res.data or []
    except Exception as e:
        print(f"Error fetching profiles: {e}")
        profiles = []

    # Get auth users for email/name
    try:
        auth_users = sb.auth.admin.list_users()
        user_map = {}
        for u in auth_users:
            user_map[u.id] = {
                "email": u.email,
                "name": u.user_metadata.get("full_name", "") or u.user_metadata.get("name", ""),
                "picture": u.user_metadata.get("avatar_url", "") or u.user_metadata.get("picture", ""),
                "last_sign_in": str(u.last_sign_in_at) if u.last_sign_in_at else None,
                "created_at": str(u.created_at) if u.created_at else None,
                "banned": getattr(u, "banned_until", None) is not None,
            }
    except Exception as e:
        print(f"Error fetching auth users: {e}")
        user_map = {}

    # Merge profiles with auth info
    users = []
    for p in profiles:
        uid = p.get("id", "")
        auth_info = user_map.get(uid, {})
        users.append({
            "id": uid,
            "email": auth_info.get("email", "unknown"),
            "name": auth_info.get("name", ""),
            "picture": auth_info.get("picture", ""),
            "credits": p.get("credits", 0),
            "last_sign_in": auth_info.get("last_sign_in"),
            "created_at": auth_info.get("created_at"),
            "banned": auth_info.get("banned", False),
            "updated_at": p.get("updated_at"),
        })

    return {"users": users, "total": len(users)}


# ── User Activity ────────────────────────────────────────

@router.get("/users/{user_id}/activity")
async def get_user_activity(
    user_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get detailed activity for a specific user."""
    sb = get_supabase()

    # Local scans
    local_scans = db.query(Scan).filter(Scan.user_id == user_id).count()

    # Fraud scans from Supabase
    try:
        fraud_res = sb.table("fraud_scans").select("id, created_at, status").eq("user_id", user_id).order("created_at", desc=True).limit(20).execute()
        fraud_scans = fraud_res.data or []
    except Exception:
        fraud_scans = []

    # Chat sessions + messages
    try:
        sessions_res = sb.table("chat_sessions").select("id, title, created_at, updated_at").eq("user_id", user_id).order("updated_at", desc=True).limit(20).execute()
        chat_sessions = sessions_res.data or []
    except Exception:
        chat_sessions = []

    total_messages = 0
    try:
        for s in chat_sessions[:5]:
            msg_res = sb.table("chat_messages").select("id", count="exact").eq("session_id", s["id"]).execute()
            total_messages += msg_res.count if msg_res.count else 0
    except Exception:
        pass

    # User profile
    try:
        profile_res = sb.table("profiles").select("*").eq("id", user_id).single().execute()
        profile = profile_res.data
    except Exception:
        profile = None

    return {
        "user_id": user_id,
        "total_scans": local_scans,
        "total_fraud_scans": len(fraud_scans),
        "total_chat_sessions": len(chat_sessions),
        "total_messages": total_messages,
        "credits": profile.get("credits", 0) if profile else 0,
        "recent_fraud_scans": fraud_scans[:10],
        "recent_chat_sessions": chat_sessions[:10],
    }


# ── Add/Set Credits ──────────────────────────────────────

@router.post("/users/{user_id}/credits")
async def update_user_credits(
    user_id: str,
    body: CreditUpdate,
    admin: User = Depends(require_admin),
):
    """Set credits for a user."""
    sb = get_supabase()

    try:
        sb.table("profiles").update({"credits": body.credits}).eq("id", user_id).execute()
        print(f"🔑 Admin set credits to {body.credits} for user {user_id}")
        return {"success": True, "credits": body.credits}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update credits: {str(e)}")


# ── Ban / Unban ──────────────────────────────────────────

@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    body: BanUpdate,
    admin: User = Depends(require_admin),
):
    """Ban or unban a user."""
    sb = get_supabase()

    try:
        if body.banned:
            # Ban by setting banned_until far in the future
            sb.auth.admin.update_user_by_id(user_id, {"ban_duration": "876000h"})  # ~100 years
            print(f"🚫 Admin banned user {user_id}")
        else:
            sb.auth.admin.update_user_by_id(user_id, {"ban_duration": "none"})
            print(f"✅ Admin unbanned user {user_id}")

        return {"success": True, "banned": body.banned}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ban/unban user: {str(e)}")


# ── Delete User ──────────────────────────────────────────

@router.delete("/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: completely delete a user and all their data."""
    sb = get_supabase()

    try:
        # Delete chat messages via sessions
        try:
            sessions = sb.table("chat_sessions").select("id").eq("user_id", user_id).execute()
            for s in (sessions.data or []):
                sb.table("chat_messages").delete().eq("session_id", s["id"]).execute()
        except Exception:
            pass

        # Delete from all tables
        for table in ["chat_sessions", "extracted_finance_data", "fraud_scans", "documents", "imagekit_files", "reviews"]:
            try:
                sb.table(table).delete().eq("user_id", user_id).execute()
            except Exception:
                pass

        # Delete profile (uses 'id')
        try:
            sb.table("profiles").delete().eq("id", user_id).execute()
        except Exception:
            pass

        # Delete local DB entries
        try:
            db.query(Scan).filter(Scan.user_id == user_id).delete()
            local_user = db.query(User).filter(User.id == user_id).first()
            if local_user:
                db.delete(local_user)
            db.commit()
        except Exception:
            db.rollback()

        # Delete from Supabase Auth
        try:
            sb.auth.admin.delete_user(user_id)
        except Exception:
            pass

        print(f"🗑️ Admin deleted user {user_id}")
        return {"success": True, "message": "User deleted successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")


# ── Extend Data Retention ────────────────────────────────

@router.post("/users/{user_id}/extend-retention")
async def extend_retention(
    user_id: str,
    body: RetentionUpdate,
    admin: User = Depends(require_admin),
):
    """Extend data retention period for a user (adds days before auto-cleanup)."""
    sb = get_supabase()

    try:
        # Update profile with retention extension
        sb.table("profiles").update({
            "retention_extended_until": (datetime.utcnow() + timedelta(days=body.extra_days)).isoformat()
        }).eq("id", user_id).execute()

        print(f"📅 Admin extended retention for user {user_id} by {body.extra_days} days")
        return {"success": True, "extra_days": body.extra_days}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extend retention: {str(e)}")
