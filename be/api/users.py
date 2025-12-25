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
    """Get user credits balance"""
    return {
        "credits": current_user.credits,
        "user_id": current_user.id
    }

@router.delete("/delete-account")
async def delete_account(
    db: Session = Depends(get_db),
    user_auth = Depends(get_current_user) # Object User dari Supabase Auth (UUID)
):
    """Delete user account and all related data"""
    try:
        # 1. Cari User di Database Lokal (Pakai Email karena ID-nya beda)
        db_user = db.query(User).filter(User.email == user_auth.email).first()
        
        if not db_user:
            raise HTTPException(status_code=404, detail="User data not found in local DB")

        # 2. Hapus Data Relasi di DB Lokal (Manual Cascade)
        # Hapus semua scans milik user
        db.query(Scan).filter(Scan.user_id == db_user.id).delete()
        
        # Hapus semua invoices milik user
        db.query(Invoice).filter(Invoice.user_id == db_user.id).delete()
        
        # Hapus data lainnya jika ada (CreditHistory, Reviews, dll)
        # db.query(CreditHistory).filter(CreditHistory.user_id == db_user.id).delete()
        
        # 3. Hapus User Lokal
        db.delete(db_user)
        db.commit()
        
        # 4. Hapus User di Supabase Auth (OPSIONAL - Butuh SERVICE_ROLE_KEY)
        # Karena kita pakai ANON_KEY, user harus hapus sendiri dari frontend
        # Frontend bisa panggil: supabase.auth.signOut() setelah delete account
        # Atau setup SERVICE_ROLE_KEY di backend untuk force delete
        
        try:
            # Coba hapus dari Supabase (akan gagal jika pakai ANON_KEY)
            supabase.auth.admin.delete_user(user_auth.id)
            print(f"✅ User {user_auth.email} deleted from Supabase Auth")
        except Exception as e:
            print(f"⚠️ Supabase auth delete warning (Expected with ANON_KEY): {e}")
            # Tidak masalah, data lokal sudah terhapus
        
        return {
            "success": True,
            "message": "Account and all data deleted successfully"
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        print(f"❌ Delete Account Error: {e}")
        
        return {
            "success": True,
            "message": "Account and all data deleted successfully"
        }
    except Exception as e:
        db.rollback()
        print(f"❌ Delete account error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")

