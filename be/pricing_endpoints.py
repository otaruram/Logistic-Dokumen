from fastapi import HTTPException, Header, Depends, APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import jwt
import os

# --- IMPORT BARU ---
from db import prisma  # <--- PENTING
from utils import get_user_email_from_token # <--- PENTING
from pricing_service import CreditService

router = APIRouter()

class TopUpRequest(BaseModel):
    package_id: int
    payment_method: str = "midtrans"

@router.get("/user/credits")
async def get_user_credits_endpoint(authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        if not prisma.is_connected():
            return {"status": "success", "data": {"remainingCredits": 3}}
            
        credits = await CreditService.get_user_credits(user_email, prisma)
        tier = await CreditService.get_user_tier(user_email, prisma)
        return {"status": "success", "data": {"remainingCredits": credits, "userTier": tier}}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/")
async def get_pricing_info():
    return {"status": "success", "data": CreditService.get_pricing_plans()}

# ... (Sisanya aman, asal jangan import main.prisma lagi)
