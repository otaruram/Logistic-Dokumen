"""
Reviews API routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from config.database import get_db
from models.models import User
from schemas.schemas import ReviewCreate, ReviewResponse
from utils.auth import get_current_active_user
from supabase import create_client, Client
from config.settings import settings

router = APIRouter()

# Supabase client untuk reviews (public table)
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

# Supabase admin client (bypass RLS)
from utils.auth import supabase_admin

@router.get("/", response_model=List[ReviewResponse])
async def get_reviews():
    """Get approved reviews for landing page (default endpoint)"""
    try:
        result = supabase.table("reviews")\
            .select("*")\
            .eq("is_approved", True)\
            .order("created_at", desc=True)\
            .limit(50)\
            .execute()
        
        return result.data
    except Exception as e:
        print(f"❌ Get reviews error: {e}")
        return []

@router.post("/submit", response_model=ReviewResponse)
async def submit_review(
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_active_user)
):
    """Submit user review to be displayed on landing page"""
    try:
        # Handle username for OAuth users (might be None)
        username = current_user.username if current_user.username else current_user.email.split('@')[0]
        
        # Insert review to Supabase public.reviews table
        review = {
            "user_id": str(current_user.id),
            "user_name": username,
            "user_email": current_user.email,
            "rating": review_data.rating,
            "feedback": review_data.feedback,
            "is_approved": True  # Auto-approve for immediate display
        }
        
        print(f"📝 Submitting review: {review}")
        
        # Use admin client to bypass RLS
        result = supabase_admin.table("reviews").insert(review).execute()
        
        print(f"✅ Review result: {result.data}")
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to submit review")
        
        return {
            "id": result.data[0]["id"],
            "user_name": username,
            "rating": review_data.rating,
            "feedback": review_data.feedback,
            "created_at": result.data[0]["created_at"]
        }
    except Exception as e:
        print(f"❌ Review submission error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to submit review: {str(e)}")

@router.get("/all", response_model=List[ReviewResponse])
async def get_all_reviews():
    """Get all approved reviews for landing page"""
    try:
        result = supabase.table("reviews")\
            .select("*")\
            .eq("is_approved", True)\
            .order("created_at", desc=True)\
            .limit(50)\
            .execute()
        
        return result.data
    except Exception as e:
        print(f"❌ Get reviews error: {e}")
        return []

@router.get("/recent")
async def get_recent_reviews():
    """Get recent approved reviews for landing page (limit 6)"""
    try:
        result = supabase_admin.table("reviews")\
            .select("*")\
            .eq("is_approved", True)\
            .order("created_at", desc=True)\
            .limit(6)\
            .execute()
        
        return result.data
    except Exception as e:
        print(f"❌ Get recent reviews error: {e}")
        return []
