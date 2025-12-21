"""
Dashboard API routes - User statistics and analytics
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from utils.auth import get_current_user, supabase, supabase_admin

router = APIRouter()

# --- GET DASHBOARD STATS ---
@router.get("/stats")
async def get_dashboard_stats(user = Depends(get_current_user)):
    """
    Get user's dashboard statistics - Only main features (dgtnz, invoice, pdf, quiz)
    """
    try:
        user_id = user.id if hasattr(user, 'id') else int(user.get('id'))
        
        # Get user's current credits
        user_data = supabase_admin.table("users").select("credits").eq("id", user_id).execute()
        credits = user_data.data[0].get("credits", 10) if user_data.data else 10
        
        # Count total activities from activities table (only main features: dgtnz, invoice, pdf, quiz)
        activities_count = supabase_admin.table("activities")\
            .select("id", count="exact")\
            .eq("user_id", user_id)\
            .in_("feature", ["dgtnz", "invoice", "compressor", "quiz"])\
            .execute()
        total_activities = activities_count.count or 0
        
        # Calculate next data cleanup (every Sunday)
        now = datetime.now()
        days_until_sunday = (6 - now.weekday()) % 7  # 0=Mon, 6=Sun
        if days_until_sunday == 0:  # Today is Sunday
            days_until_sunday = 7
        next_cleanup = now + timedelta(days=days_until_sunday)
        next_cleanup = next_cleanup.replace(hour=0, minute=0, second=0, microsecond=0)
        
        return {
            "totalActivities": total_activities,
            "credits": credits,
            "maxCredits": 10,
            "nextCleanupDays": days_until_sunday,
            "nextCleanupDate": next_cleanup.strftime("%d %b %Y"),
        }
        
    except Exception as e:
        print(f"❌ Dashboard Stats Error: {e}")
        return {
            "totalActivities": 0,
            "credits": 10,
            "maxCredits": 10,
            "nextCleanupDays": 7,
            "nextCleanupDate": (datetime.now() + timedelta(days=7)).strftime("%d %b %Y"),
        }

# --- GET WEEKLY ACTIVITY DATA ---
@router.get("/weekly")
async def get_weekly_activity(user = Depends(get_current_user)):
    """
    Get user's activity data for the last 7 days - ALL features included
    """
    try:
        user_id = user.id if hasattr(user, 'id') else int(user.get('id'))
        
        # Calculate date range (last 7 days including today)
        today = datetime.now().date()
        week_ago = today - timedelta(days=6)
        
        # Get all activities for last 7 days (only main features: dgtnz, invoice, pdf, quiz)
        activities = supabase_admin.table("activities")\
            .select("created_at, feature")\
            .eq("user_id", user_id)\
            .in_("feature", ["dgtnz", "invoice", "compressor", "quiz"])\
            .gte("created_at", week_ago.isoformat())\
            .execute()
        
        # Initialize daily counts for last 7 days
        daily_counts = {}
        for i in range(6, -1, -1):
            date = today - timedelta(days=i)
            daily_counts[date.strftime("%a")] = 0
        
        # Count activities per day
        for activity in (activities.data or []):
            created_date = datetime.fromisoformat(activity["created_at"].replace("Z", "+00:00")).date()
            day_name = created_date.strftime("%a")
            if day_name in daily_counts:
                daily_counts[day_name] += 1
        
        # Format for frontend chart (maintains order: Mon-Sun sliding window)
        chart_data = [
            {"day": day, "count": count}
            for day, count in daily_counts.items()
        ]
        
        return chart_data
        
    except Exception as e:
        print(f"❌ Weekly Activity Error: {e}")
        # Return empty 7-day data
        today = datetime.now().date()
        return [
            {"day": (today - timedelta(days=6-i)).strftime("%a"), "count": 0}
            for i in range(7)
        ]

# --- DEDUCT CREDIT ---
@router.post("/credits/deduct")
async def deduct_credit(user = Depends(get_current_user)):
    """
    Deduct 1 credit from user's balance
    """
    try:
        user_id = str(user.id)
        
        # Get current credits
        user_data = supabase.table("users").select("credits").eq("id", user_id).execute()
        current_credits = user_data.data[0].get("credits", 10) if user_data.data else 10
        
        if current_credits <= 0:
            raise HTTPException(status_code=403, detail="Insufficient credits")
        
        # Deduct 1 credit
        new_credits = current_credits - 1
        supabase.table("users").update({"credits": new_credits}).eq("id", user_id).execute()
        
        return {
            "success": True,
            "remainingCredits": new_credits
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Deduct Credit Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to deduct credit")
