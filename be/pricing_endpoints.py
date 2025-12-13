"""
Pricing API Endpoints
File: be/pricing_endpoints.py
"""

from fastapi import HTTPException, Header, Depends, APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from pricing_service import CreditService, SubscriptionService, ImageCleanupService
import jwt
import os

# Create router instance
router = APIRouter()

# Pydantic Models untuk Request/Response
class TopUpRequest(BaseModel):
    package_id: int  # 0=20 credits, 1=50 credits, 2=100 credits
    payment_method: str = "midtrans"

class SubscriptionRequest(BaseModel):
    plan: str = "PRO"
    payment_method: str = "midtrans"

class PricingResponse(BaseModel):
    packages: List[Dict[str, Any]]
    pro_plan: Dict[str, Any]
    user_current_plan: Optional[Dict[str, Any]] = None

# Helper function for user token validation
def get_user_email_from_token(authorization: str):
    """Extract user email from JWT token"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.split(' ')[1]
    try:
        payload = jwt.decode(token, os.getenv("SECRET_KEY", "your-secret-key"), algorithms=["HS256"])
        return payload.get("sub")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/user/credits")
async def get_user_credits_endpoint(authorization: str = Header(None)):
    """Get user credit info"""
    try:
        from main import prisma, credit_service
        
        user_email = get_user_email_from_token(authorization)
        
        if not credit_service or not prisma:
            return {
                "status": "success",
                "data": {
                    "remainingCredits": 10,
                    "userTier": "starter",
                    "upgradeAvailable": True
                }
            }
        
        # Get current credits
        remaining_credits = await credit_service.get_user_credits(user_email, prisma)
        user_tier = await credit_service.get_user_tier(user_email, prisma)
        
        return {
            "status": "success",
            "data": {
                "remainingCredits": remaining_credits,
                "userTier": user_tier,
                "upgradeAvailable": True
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        return {
            "status": "success", 
            "data": {
                "remainingCredits": 10,
                "userTier": "starter", 
                "upgradeAvailable": True
            }
        }

@router.get("/")
async def get_pricing_info(authorization: str = Header(None)):
    """Get informasi pricing dan paket yang tersedia"""
    try:
        pricing_data = {
            "packages": CreditService.PRICING_CONFIG["topup_packages"],
            "pro_plan": CreditService.PRICING_CONFIG["pro_subscription"]
        }
        
        # Jika user login, tampilkan info paket current
        if authorization:
            try:
                user_email = get_user_email_from_token(authorization)
                # Note: This would need prisma instance, will implement later
                # user_plan = await CreditService.get_user_plan_info(user_email, prisma)
                # if "error" not in user_plan:
                #     pricing_data["user_current_plan"] = user_plan
            except:
                pass  # User tidak login atau token invalid, skip
        
        return {"status": "success", "data": pricing_data}
        
    except Exception as e:
        return {"status": "error", "message": f"Failed to get pricing info: {str(e)}"}

@router.get("/user/credits")
async def get_user_credits(authorization: str = Header(None)):
    """Get credit balance dan info paket user"""
    try:
        user_email = get_user_email_from_token(authorization)
        # Note: Need prisma instance for actual implementation
        # plan_info = await CreditService.get_user_plan_info(user_email, prisma)
        # if "error" in plan_info:
        #     raise HTTPException(status_code=404, detail=plan_info["error"])
        # return {"status": "success", "data": plan_info}
        
        # Mock response for now
        mock_data = {
            "creditBalance": 10,
            "planType": "starter",
            "subscriptionEndDate": None
        }
        return {"status": "success", "data": mock_data}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get credits: {str(e)}")

@router.post("/topup")
async def create_topup_order(request: TopUpRequest, authorization: str = Header(None)):
    """Buat order top up credit (belum aktifkan payment gateway)"""
    try:
        user_email = get_user_email_from_token(authorization)
        
        # Validasi package_id
        packages = CreditService.PRICING_CONFIG["topup_packages"]
        if request.package_id < 0 or request.package_id >= len(packages):
            raise HTTPException(status_code=400, detail="Invalid package ID")
        
        selected_package = packages[request.package_id]
        
        # TODO: Integrasi dengan payment gateway (Midtrans/etc)
        # Untuk sekarang return mock response
        order_data = {
            "order_id": f"TOPUP_{user_email}_{int(datetime.now().timestamp())}",
            "package": selected_package,
            "total_price": selected_package["price"],
            "payment_url": "#", # TODO: Real payment URL
            "status": "pending"
        }
        
        return {"status": "success", "data": order_data}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create topup order: {str(e)}")

@router.post("/subscribe")
async def create_subscription_order(request: SubscriptionRequest, authorization: str = Header(None)):
    """Buat order langganan PRO (belum aktifkan payment gateway)"""
    try:
        user_email = get_user_email_from_token(authorization)
        
        pro_config = CreditService.PRICING_CONFIG["pro_subscription"]
        
        # TODO: Integrasi dengan payment gateway
        order_data = {
            "order_id": f"SUB_{user_email}_{int(datetime.now().timestamp())}",
            "plan": "PRO",
            "monthly_price": pro_config["monthly_price"],
            "credits_per_month": pro_config["credits_per_month"],
            "payment_url": "#", # TODO: Real payment URL
            "status": "pending"
        }
        
        return {"status": "success", "data": order_data}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create subscription order: {str(e)}")

@router.post("/admin/simulate-payment")
async def simulate_payment_success(
    order_id: str,
    order_type: str,  # "topup" or "subscription"
    authorization: str = Header(None)
):
    """
    ADMIN ONLY: Simulasi pembayaran berhasil untuk testing
    Hapus endpoint ini di production!
    """
    try:
        # TODO: Add admin authorization check
        user_email = get_user_email_from_token(authorization)
        
        # For now, just return success without actual database operations
        # TODO: Implement with proper prisma instance
        
        return {"status": "success", "message": "Payment simulation completed (mock)"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")

@router.post("/admin/cleanup")
async def manual_cleanup(authorization: str = Header(None)):
    """ADMIN ONLY: Manual trigger cleanup expired images"""
    try:
        # TODO: Add admin authorization check
        # cleanup_count = await ImageCleanupService.cleanup_expired_images(prisma)
        # return {"status": "success", "cleaned_files": cleanup_count}
        return {"status": "success", "message": "Cleanup completed (mock)"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

@router.post("/admin/reset-credits")
async def manual_reset_credits(authorization: str = Header(None)):
    """ADMIN ONLY: Manual trigger reset credits for PRO users"""
    try:
        # TODO: Add admin authorization check
        # reset_count = await SubscriptionService.process_monthly_reset(prisma)
        # return {"status": "success", "reset_users": reset_count}
        return {"status": "success", "message": "Reset completed (mock)"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")

@router.get("/monthly-cleanup-warning")
async def get_monthly_cleanup_warning(authorization: str = Header(None)):
    """Get monthly data cleanup warning if approaching user's monthly anniversary"""
    try:
        from main import prisma
        user_email = get_user_email_from_token(authorization)
        
        if not prisma:
            return {"status": "success", "data": {"warning": False}}
        
        warning_data = await CreditService.check_monthly_cleanup_warning(user_email, prisma)
        
        return {"status": "success", "data": warning_data}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Warning check failed: {str(e)}")

@router.get("/credit-status/{credits}")
async def get_credit_status(credits: int):
    """Get credit exhaustion message based on remaining credits"""
    try:
        credit_message = CreditService.get_credit_exhaustion_message(credits)
        
        return {"status": "success", "data": credit_message}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Credit status check failed: {str(e)}")

@router.post("/manual-monthly-cleanup")
async def manual_monthly_cleanup(authorization: str = Header(None)):
    """ADMIN ONLY: Manual trigger monthly data cleanup for specific user"""
    try:
        from main import prisma
        user_email = get_user_email_from_token(authorization)
        
        if not prisma:
            return {"status": "error", "message": "Database not available"}
        
        cleanup_result = await CreditService.perform_monthly_cleanup_for_user(user_email, prisma)
        
        if cleanup_result:
            return {"status": "success", "message": f"Monthly cleanup completed for {user_email}"}
        else:
            return {"status": "success", "message": "No cleanup needed (not user's monthly anniversary)"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

@router.post("/admin/check-all-cleanup")
async def admin_check_all_cleanup(authorization: str = Header(None)):
    """ADMIN ONLY: Check and perform cleanup for all users who reached monthly anniversary"""
    try:
        from main import prisma
        # TODO: Add admin authorization check
        user_email = get_user_email_from_token(authorization)
        
        if not prisma:
            return {"status": "error", "message": "Database not available"}
        
        cleanup_count = await CreditService.check_all_users_cleanup(prisma)
        
        return {"status": "success", "message": f"Checked all users, performed cleanup for {cleanup_count} users"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Admin cleanup check failed: {str(e)}")

@router.get("/monthly-cleanup-warning")
async def get_monthly_cleanup_warning(authorization: str = Header(None)):
    """Check if monthly data cleanup is approaching"""
    try:
        from main import prisma
        
        user_email = get_user_email_from_token(authorization)
        warning_info = await CreditService.check_monthly_cleanup_warning(prisma)
        
        return {
            "status": "success",
            "data": warning_info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check cleanup warning: {str(e)}")

@router.post("/perform-monthly-cleanup")
async def perform_monthly_cleanup(authorization: str = Header(None)):
    """ADMIN ONLY: Perform monthly data cleanup"""
    try:
        from main import prisma
        
        user_email = get_user_email_from_token(authorization)
        # TODO: Add admin check
        
        cleanup_result = await CreditService.perform_monthly_cleanup(prisma)
        
        return {
            "status": "success", 
            "cleanup_performed": cleanup_result,
            "message": "Monthly cleanup completed" if cleanup_result else "No cleanup needed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

@router.get("/credit-status/{credits}")
async def get_credit_status_message(credits: int):
    """Get credit status message based on remaining credits"""
    try:
        message_info = CreditService.get_credit_exhaustion_message(credits)
        
        return {
            "status": "success",
            "data": message_info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get credit status: {str(e)}")

@router.get("/user/profile")
async def get_user_profile(authorization: str = Header(None)):
    """Get comprehensive user profile data for profile card"""
    try:
        from main import prisma
        from datetime import date, timedelta
        import calendar
        
        print(f"🔍 PROFILE REQUEST - Starting profile fetch...")
        
        user_email = get_user_email_from_token(authorization)
        print(f"👤 USER EMAIL - {user_email}")
        
        if not prisma:
            print("❌ DATABASE NOT AVAILABLE")
            return {"status": "error", "message": "Database not available"}
        
        # Get user data with better error handling
        try:
            user = await prisma.user.find_unique(
                where={"email": user_email}
            )
            print(f"📊 USER FOUND - {user.email if user else 'None'}")
        except Exception as db_error:
            print(f"💥 DATABASE ERROR getting user: {db_error}")
            return {"status": "error", "message": "Database connection error"}
        
        if not user:
            # Create user if not exists
            print(f"🆕 CREATING NEW USER - {user_email}")
            try:
                user = await prisma.user.create(
                    data={
                        "email": user_email,
                        "creditBalance": 3,
                        "tier": "starter"
                    }
                )
                print(f"✅ NEW USER CREATED - {user_email}")
            except Exception as create_error:
                print(f"💥 ERROR creating user: {create_error}")
                return {"status": "error", "message": "Could not create user"}
        
        # Calculate statistics
        try:
            # Get recent activity
            recent_logs = await prisma.logs.find_many(
                where={"userId": user_email},
                order_by={"timestamp": "desc"},
                take=1
            )
            
            # Get credit transactions count
            total_usage_count = await prisma.logs.count(
                where={"userId": user_email}
            )
            
            last_activity = recent_logs[0].timestamp if recent_logs else user.createdAt
        except Exception as stats_error:
            print(f"Error calculating stats: {stats_error}")
            total_usage_count = 0
            last_activity = user.createdAt
        
        # Calculate next cleanup date based on registration - USING SAFE FUNCTION
        from date_utils import calculate_cleanup_info_safe
        cleanup_data = calculate_cleanup_info_safe(user.createdAt)
        
        # Get current credits
        current_credits = await CreditService.get_user_credits(user_email, prisma)
        
        profile_data = {
            "user_info": {
                "email": user.email,
                "name": user.email.split('@')[0].upper(),  # Extract name from email
                "joined_date": user.createdAt.strftime("%d %B %Y"),
                "tier": user.tier or "starter"
            },
            "statistics": {
                "total_usage_count": total_usage_count,
                "credits_remaining": current_credits,
                "last_activity": last_activity.strftime("%d Desember %Y pukul %H.%M") if last_activity else "Belum ada aktivitas"
            },
            "cleanup_info": {
                "next_cleanup_date": cleanup_data["next_cleanup_date"],
                "days_until_cleanup": cleanup_data["days_until_cleanup"],
                "cleanup_warning": cleanup_data["days_until_cleanup"] <= 7
            }
        }
        
        return {"status": "success", "data": profile_data}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profile fetch failed: {str(e)}")

@router.post("/test/reset-credits")
async def test_reset_credits(authorization: str = Header(None)):
    """TEST ONLY: Manual reset credits to test daily reset functionality"""
    try:
        from main import prisma
        user_email = get_user_email_from_token(authorization)
        
        if not prisma:
            return {"status": "error", "message": "Database not available"}
        
        # Force reset user credits to 3
        await CreditService.ensure_default_credits(user_email, prisma)
        updated_credits = await CreditService.get_user_credits(user_email, prisma)
        
        return {
            "status": "success", 
            "message": f"Credits reset to {updated_credits} for testing",
            "data": {"credits": updated_credits}
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Credit reset failed: {str(e)}")

@router.post("/test/trigger-cleanup")
async def test_trigger_cleanup(authorization: str = Header(None)):
    """TEST ONLY: Trigger monthly cleanup for current user"""
    try:
        from main import prisma
        user_email = get_user_email_from_token(authorization)
        
        if not prisma:
            return {"status": "error", "message": "Database not available"}
        
        # Force cleanup for this user
        cleanup_result = await CreditService.perform_monthly_cleanup_for_user(user_email, prisma)
        
        return {
            "status": "success",
            "message": "Cleanup test completed",
            "data": {"cleanup_performed": cleanup_result}
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup test failed: {str(e)}")

@router.post("/test/reset-all-credits")
async def test_reset_all_credits(authorization: str = Header(None)):
    """TEST ONLY: Manual reset all users credits for testing"""
    try:
        from main import prisma
        from datetime import datetime, date
        
        user_email = get_user_email_from_token(authorization)
        print(f"🔧 Manual credit reset triggered by: {user_email}")
        
        if not prisma:
            return {"status": "error", "message": "Database not available"}
        
        # Get all users
        users = await prisma.user.find_many()
        reset_count = 0
        
        for user in users:
            try:
                # Force reset credits to 3 regardless of last reset date
                await prisma.user.update(
                    where={"id": user.id},
                    data={
                        "creditBalance": CreditService.DAILY_CREDIT_LIMIT,
                        "lastCreditReset": datetime.now()
                    }
                )
                
                # Log manual reset transaction
                await prisma.credittransaction.create(
                    data={
                        "userId": user.id,
                        "amount": CreditService.DAILY_CREDIT_LIMIT,
                        "description": f"Manual credit reset - {date.today()}"
                    }
                )
                
                reset_count += 1
                print(f"💳 Manual reset credits for: {user.email}")
                
            except Exception as e:
                print(f"❌ Error resetting credits for user {user.id}: {e}")
                continue
        
        return {
            "status": "success",
            "message": f"Manual credit reset completed for {reset_count} users",
            "data": {
                "users_updated": reset_count,
                "credit_amount": CreditService.DAILY_CREDIT_LIMIT
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Manual credit reset failed: {str(e)}")

@router.get("/scheduler/status")
async def get_scheduler_status():
    """Get current scheduler status and timezone"""
    try:
        from datetime import datetime
        import pytz
        
        jakarta_tz = pytz.timezone('Asia/Jakarta')
        current_time_jakarta = datetime.now(jakarta_tz)
        
        return {
            "status": "success",
            "data": {
                "current_time_utc": datetime.utcnow().isoformat(),
                "current_time_jakarta": current_time_jakarta.isoformat(),
                "next_credit_reset": "00:01 WIB daily",
                "next_maintenance": "00:00 WIB daily",
                "timezone": "Asia/Jakarta"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scheduler status check failed: {str(e)}")
