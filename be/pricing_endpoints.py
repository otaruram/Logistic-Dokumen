from fastapi import HTTPException, Header, Depends, APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import jwt
import os

# --- UPDATE IMPORT INI (PENTING) ---
from db import prisma  
from utils import get_user_email_from_token 
from pricing_service import CreditService

router = APIRouter()

class TopUpRequest(BaseModel):
    package_id: int
    payment_method: str = "midtrans"

class SubscriptionRequest(BaseModel):
    plan: str = "PRO"
    payment_method: str = "midtrans"

@router.get("/user/credits")
async def get_user_credits_endpoint(authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        if not prisma.is_connected():
            return {"status": "success", "data": {"remainingCredits": 3, "userTier": "starter"}}
            
        credits = await CreditService.get_user_credits(user_email, prisma)
        tier = await CreditService.get_user_tier(user_email, prisma)
        return {"status": "success", "data": {"remainingCredits": credits, "userTier": tier, "upgradeAvailable": True}}
    except Exception as e:
        return {"status": "success", "data": {"remainingCredits": 3, "userTier": "starter", "error": str(e)}}

@router.get("/")
async def get_pricing_info(authorization: str = Header(None)):
    return {"status": "success", "data": CreditService.get_pricing_plans()}

@router.post("/topup")
async def create_topup_order(request: TopUpRequest, authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        # Mock Response
        return {"status": "success", "data": {"order_id": f"TOPUP_{int(datetime.now().timestamp())}", "status": "pending"}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/subscribe")
async def create_subscription_order(request: SubscriptionRequest, authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        # Mock Response
        return {"status": "success", "data": {"order_id": f"SUB_{int(datetime.now().timestamp())}", "status": "pending"}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ... endpoint admin lainnya bisa lu keep atau hapus kalau gak butuh