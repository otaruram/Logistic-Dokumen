"""
Cleanup API routes - Monthly data cleanup
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from utils.auth import supabase_admin
from datetime import datetime, timedelta
from typing import Optional
import os
from pathlib import Path

router = APIRouter()

# Secret key for cleanup endpoint (set in .env)
CLEANUP_SECRET = "your-secret-cleanup-key-here"  # Change this!

@router.post("/monthly-cleanup")
async def trigger_monthly_cleanup(authorization: Optional[str] = Header(None)):
    """
    Trigger monthly cleanup job manually or via external cron
    Requires authorization header with secret key
    """
    try:
        # Verify authorization
        if not authorization or authorization != f"Bearer {CLEANUP_SECRET}":
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        cleanup_date = datetime.now() - timedelta(days=30)  # 30 days = 1 month
        results = {
            "timestamp": datetime.now().isoformat(),
            "cleanup_date": cleanup_date.isoformat(),
            "deleted": {}
        }
        
        # 1. Delete old DGTNZ scans (older than 30 days)
        try:
            scans_result = supabase_admin.table("scans")\
                .delete()\
                .lt("created_at", cleanup_date.isoformat())\
                .execute()
            results["deleted"]["scans"] = len(scans_result.data) if scans_result.data else 0
        except Exception as e:
            results["deleted"]["scans"] = f"Error: {str(e)}"
        
        # 2. Delete old ImageKit file tracking (older than 30 days)
        try:
            imagekit_result = supabase_admin.table("imagekit_files")\
                .delete()\
                .lt("created_at", cleanup_date.isoformat())\
                .execute()
            results["deleted"]["imagekit_files"] = len(imagekit_result.data) if imagekit_result.data else 0
        except Exception as e:
            results["deleted"]["imagekit_files"] = f"Error: {str(e)}"
        
        # 3. Delete expired PPT history (past expires_at date)
        try:
            now = datetime.now()
            ppt_result = supabase_admin.table("ppt_history")\
                .delete()\
                .lt("expires_at", now.isoformat())\
                .execute()
            results["deleted"]["ppt_history"] = len(ppt_result.data) if ppt_result.data else 0
        except Exception as e:
            results["deleted"]["ppt_history"] = f"Error: {str(e)}"
        
        # 4. Delete old audit activities (older than 30 days)
        try:
            audit_result = supabase_admin.table("activities")\
                .delete()\
                .eq("feature", "audit")\
                .lt("created_at", cleanup_date.isoformat())\
                .execute()
            results["deleted"]["audit_activities"] = len(audit_result.data) if audit_result.data else 0
        except Exception as e:
            results["deleted"]["audit_activities"] = f"Error: {str(e)}"
        
        # 5. Delete old general activities (older than 60 days for analytics)
        try:
            activities_cutoff = datetime.now() - timedelta(days=60)
            activities_result = supabase_admin.table("activities")\
                .delete()\
                .lt("created_at", activities_cutoff.isoformat())\
                .execute()
            results["deleted"]["activities"] = len(activities_result.data) if activities_result.data else 0
        except Exception as e:
            results["deleted"]["activities"] = f"Error: {str(e)}"
        
        # 6. Delete old PDF/PPTX files from static/exports (older than 30 days)
        try:
            deleted_files = 0
            exports_dir = Path("static/exports")
            
            if exports_dir.exists():
                cutoff_time = datetime.now() - timedelta(days=30)
                
                for file_path in exports_dir.iterdir():
                    if file_path.is_file():
                        # Check file age
                        file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                        
                        if file_mtime < cutoff_time:
                            try:
                                file_path.unlink()  # Delete file
                                deleted_files += 1
                            except Exception as file_error:
                                print(f"⚠️ Failed to delete {file_path}: {file_error}")
            
            results["deleted"]["export_files"] = deleted_files
            print(f"🗑️ Deleted {deleted_files} old files from static/exports/")
            
        except Exception as e:
            results["deleted"]["export_files"] = f"Error: {str(e)}"
        
        # 7. Delete old PDF files from uploads/ (older than 30 days)
        try:
            deleted_files = 0
            uploads_dir = Path("uploads")
            
            if uploads_dir.exists():
                cutoff_time = datetime.now() - timedelta(days=30)
                
                # Scan all subdirectories in uploads/
                for user_folder in uploads_dir.iterdir():
                    if user_folder.is_dir():
                        for file_path in user_folder.iterdir():
                            if file_path.is_file():
                                # Check file age
                                file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                                
                                if file_mtime < cutoff_time:
                                    try:
                                        file_path.unlink()  # Delete file
                                        deleted_files += 1
                                    except Exception as file_error:
                                        print(f"⚠️ Failed to delete {file_path}: {file_error}")
                        
                        # Remove empty user folders
                        try:
                            if not any(user_folder.iterdir()):
                                user_folder.rmdir()
                        except:
                            pass
            
            results["deleted"]["upload_files"] = deleted_files
            print(f"🗑️ Deleted {deleted_files} old PDF files from uploads/")
            
        except Exception as e:
            results["deleted"]["upload_files"] = f"Error: {str(e)}"
        
        print(f"✅ Monthly cleanup completed: {results}")
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Monthly cleanup error: {e}")
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
        cleanup_date = datetime.now() - timedelta(days=30)  # Monthly cleanup
        
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
        
        # Count expired PPT history
        now = datetime.now()
        ppt_count = supabase_admin.table("ppt_history")\
            .select("id", count="exact")\
            .lt("expires_at", now.isoformat())\
            .execute()
        
        # Count old activities (60 days)
        activities_cutoff = datetime.now() - timedelta(days=60)
        activities_count = supabase_admin.table("activities")\
            .select("id", count="exact")\
            .lt("created_at", activities_cutoff.isoformat())\
            .execute()
        
        # Calculate next 1st of month
        today = datetime.now()
        if today.month == 12:
            next_cleanup = datetime(today.year + 1, 1, 1)
        else:
            next_cleanup = (today.replace(day=1) + timedelta(days=32)).replace(day=1)
        
        days_until_cleanup = (next_cleanup - today).days
        
        return {
            "next_cleanup_date": next_cleanup.strftime("%Y-%m-%d"),
            "days_until_cleanup": days_until_cleanup,
            "to_be_deleted": {
                "scans": scans_count.count or 0,
                "imagekit_files": imagekit_count.count or 0,
                "ppt_history": ppt_count.count or 0,
                "activities": activities_count.count or 0
            }
        }
        
    except Exception as e:
        print(f"❌ Cleanup stats error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get cleanup stats")
