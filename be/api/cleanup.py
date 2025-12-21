"""
Cleanup API routes - Weekly data cleanup
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from utils.auth import supabase_admin
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter()

# Secret key for cleanup endpoint (set in .env)
CLEANUP_SECRET = "your-secret-cleanup-key-here"  # Change this!

@router.post("/weekly-cleanup")
async def trigger_weekly_cleanup(authorization: Optional[str] = Header(None)):
    """
    Trigger weekly cleanup job manually or via external cron
    Requires authorization header with secret key
    """
    try:
        # Verify authorization
        if not authorization or authorization != f"Bearer {CLEANUP_SECRET}":
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        cleanup_date = datetime.now() - timedelta(days=7)
        results = {
            "timestamp": datetime.now().isoformat(),
            "cleanup_date": cleanup_date.isoformat(),
            "deleted": {}
        }
        
        # 1. Delete old DGTNZ scans (older than 7 days)
        try:
            scans_result = supabase_admin.table("scans")\
                .delete()\
                .lt("created_at", cleanup_date.isoformat())\
                .execute()
            results["deleted"]["scans"] = len(scans_result.data) if scans_result.data else 0
        except Exception as e:
            results["deleted"]["scans"] = f"Error: {str(e)}"
        
        # 2. Delete old ImageKit file tracking (older than 7 days)
        try:
            imagekit_result = supabase_admin.table("imagekit_files")\
                .delete()\
                .lt("created_at", cleanup_date.isoformat())\
                .execute()
            results["deleted"]["imagekit_files"] = len(imagekit_result.data) if imagekit_result.data else 0
        except Exception as e:
            results["deleted"]["imagekit_files"] = f"Error: {str(e)}"
        
        # 3. Delete old activities (older than 30 days for analytics)
        try:
            activities_cutoff = datetime.now() - timedelta(days=30)
            activities_result = supabase_admin.table("activities")\
                .delete()\
                .lt("created_at", activities_cutoff.isoformat())\
                .execute()
            results["deleted"]["activities"] = len(activities_result.data) if activities_result.data else 0
        except Exception as e:
            results["deleted"]["activities"] = f"Error: {str(e)}"
        
        print(f"✅ Weekly cleanup completed: {results}")
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Weekly cleanup error: {e}")
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

@router.post("/daily-credit-reset")
async def trigger_daily_credit_reset(authorization: Optional[str] = Header(None)):
    """
    Reset all user credits to 10 daily at 00:00 UTC
    Requires authorization header with secret key
    """
    try:
        # Verify authorization
        if not authorization or authorization != f"Bearer {CLEANUP_SECRET}":
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Reset all users' credits to 10
        result = supabase_admin.table("users")\
            .update({"credits": 10})\
            .lt("credits", 10)\
            .execute()
        
        updated_count = len(result.data) if result.data else 0
        
        response = {
            "timestamp": datetime.now().isoformat(),
            "users_updated": updated_count,
            "new_credit_value": 10,
            "message": "Daily credit reset completed"
        }
        
        print(f"✅ Daily credit reset: {updated_count} users updated to 10 credits")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Daily credit reset error: {e}")
        raise HTTPException(status_code=500, detail=f"Credit reset failed: {str(e)}")

@router.get("/cleanup-stats")
async def get_cleanup_stats():
    """
    Get statistics about data that will be cleaned up next
    Public endpoint for dashboard display
    """
    try:
        cleanup_date = datetime.now() - timedelta(days=7)
        
        # Count old scans
        scans_count = supabase_admin.table("scans")\
            .select("id", count="exact")\
            .lt("created_at", cleanup_date.isoformat())\
            .execute()
        
        # Count old ImageKit files
        imagekit_count = supabase_admin.table("imagekit_files")\
            .select("id", count="exact")\
            .lt("created_at", cleanup_date.isoformat())\
            .execute()
        
        # Count old activities (30 days)
        activities_cutoff = datetime.now() - timedelta(days=30)
        activities_count = supabase_admin.table("activities")\
            .select("id", count="exact")\
            .lt("created_at", activities_cutoff.isoformat())\
            .execute()
        
        # Calculate next Sunday
        today = datetime.now()
        days_until_sunday = (6 - today.weekday()) % 7
        if days_until_sunday == 0:
            days_until_sunday = 7
        next_cleanup = today + timedelta(days=days_until_sunday)
        
        return {
            "next_cleanup_date": next_cleanup.strftime("%Y-%m-%d"),
            "days_until_cleanup": days_until_sunday,
            "to_be_deleted": {
                "scans": scans_count.count or 0,
                "imagekit_files": imagekit_count.count or 0,
                "activities": activities_count.count or 0
            }
        }
        
    except Exception as e:
        print(f"❌ Cleanup stats error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get cleanup stats")
