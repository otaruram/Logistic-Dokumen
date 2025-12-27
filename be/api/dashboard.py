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
    Get user's dashboard statistics - Only DGTNZ feature
    """
    try:
        user_id = str(user.id) if hasattr(user, 'id') else str(user.get('id'))
        
        # Get user's current credits and created_at date
        user_data = supabase_admin.table("users").select("credits, created_at").eq("id", user_id).execute()
        credits = user_data.data[0].get("credits", 10) if user_data.data else 10
        
        # Get user's join date for cleanup calculation
        user_created_at = user_data.data[0].get("created_at") if user_data.data else None
        
        # Count total activities from activities table (only dgtnz now)
        activities_count = supabase_admin.table("activities")\
            .select("id", count="exact")\
            .eq("user_id", user_id)\
            .in_("feature", ["dgtnz"])\
            .execute()
        total_activities = activities_count.count or 0
        
        # Calculate next data cleanup (30 days from user join date)
        if user_created_at:
            join_date = datetime.fromisoformat(user_created_at.replace("Z", "+00:00"))
            # Calculate next cleanup as 30 days cycle from join date
            now = datetime.now()
            days_since_join = (now - join_date).days
            days_in_current_cycle = days_since_join % 30
            days_until_cleanup = 30 - days_in_current_cycle
            next_cleanup = now + timedelta(days=days_until_cleanup)
        else:
            # Fallback if no join date
            now = datetime.now()
            days_until_cleanup = 30
            next_cleanup = now + timedelta(days=30)
        
        return {
            "totalActivities": total_activities,
            "credits": credits,
            "maxCredits": 10,
            "nextCleanupDays": days_until_cleanup,
            "nextCleanupDate": next_cleanup.strftime("%d %b %Y"),
        }
        
    except Exception as e:
        print(f"❌ Dashboard Stats Error: {e}")
        return {
            "totalActivities": 0,
            "credits": 10,
            "maxCredits": 10,
            "nextCleanupDays": 30,
            "nextCleanupDate": (datetime.now() + timedelta(days=30)).strftime("%d %b %Y"),
        }

# --- GET WEEKLY ACTIVITY DATA ---
@router.get("/weekly")
async def get_weekly_activity(user = Depends(get_current_user)):
    """
    Get user's activity data for the last 7 days - Only DGTNZ feature
    """
    try:
        user_id = str(user.id) if hasattr(user, 'id') else str(user.get('id'))
        
        # Calculate date range (last 7 days including today)
        today = datetime.now().date()
        week_ago = today - timedelta(days=6)
        
        # Get all activities for last 7 days (only dgtnz now)
        activities = supabase_admin.table("activities")\
            .select("created_at, feature")\
            .eq("user_id", user_id)\
            .in_("feature", ["dgtnz"])\
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
