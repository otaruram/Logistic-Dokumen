"""
Pricing API Endpoints
File: be/pricing_endpoints.py
"""

from fastapi import HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from pricing_service import CreditService, SubscriptionService, ImageCleanupService

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

# Pricing Endpoints (Tambahkan ke main.py)
def add_pricing_endpoints(app, prisma, get_user_email_from_token):
    
    @app.get("/api/pricing")
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
                    user_plan = await CreditService.get_user_plan_info(user_email, prisma)
                    if "error" not in user_plan:
                        pricing_data["user_current_plan"] = user_plan
                except:
                    pass  # User tidak login atau token invalid, skip
            
            return {"status": "success", "data": pricing_data}
            
        except Exception as e:
            return {"status": "error", "message": f"Failed to get pricing info: {str(e)}"}

    @app.get("/api/user/credits")
    async def get_user_credits(authorization: str = Header(None)):
        """Get credit balance dan info paket user"""
        try:
            user_email = get_user_email_from_token(authorization)
            plan_info = await CreditService.get_user_plan_info(user_email, prisma)
            
            if "error" in plan_info:
                raise HTTPException(status_code=404, detail=plan_info["error"])
            
            return {"status": "success", "data": plan_info}
            
        except HTTPException as he:
            raise he
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get credits: {str(e)}")

    @app.post("/api/topup")
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

    @app.post("/api/subscribe")
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

    @app.post("/api/admin/simulate-payment")
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
            
            if order_type == "topup":
                # Simulasi top up berhasil
                # Parse package dari order_id atau hardcode untuk testing
                await prisma.user.update(
                    where={"email": user_email},
                    data={"creditBalance": {"increment": 50}}  # Simulasi +50 credits
                )
                
                await prisma.credittransaction.create(
                    data={
                        "userId": (await prisma.user.find_unique(where={"email": user_email})).id,
                        "amount": 50,
                        "description": f"Top Up - {order_id}"
                    }
                )
                
            elif order_type == "subscription":
                # Simulasi subscribe PRO berhasil
                end_date = datetime.now() + timedelta(days=30)
                
                await prisma.user.update(
                    where={"email": user_email},
                    data={
                        "planType": "PRO",
                        "subscriptionEndDate": end_date,
                        "creditBalance": 200  # Reset ke 200 credits
                    }
                )
                
                await prisma.credittransaction.create(
                    data={
                        "userId": (await prisma.user.find_unique(where={"email": user_email})).id,
                        "amount": 200,
                        "description": f"Upgrade PRO - {order_id}"
                    }
                )
            
            return {"status": "success", "message": "Payment simulation completed"}
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")

    @app.post("/api/admin/cleanup")
    async def manual_cleanup(authorization: str = Header(None)):
        """ADMIN ONLY: Manual trigger cleanup expired images"""
        try:
            # TODO: Add admin authorization check
            cleanup_count = await ImageCleanupService.cleanup_expired_images(prisma)
            return {"status": "success", "cleaned_files": cleanup_count}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

    @app.post("/api/admin/reset-credits")
    async def manual_reset_credits(authorization: str = Header(None)):
        """ADMIN ONLY: Manual trigger reset credits for PRO users"""
        try:
            # TODO: Add admin authorization check
            reset_count = await SubscriptionService.process_monthly_reset(prisma)
            return {"status": "success", "reset_users": reset_count}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")