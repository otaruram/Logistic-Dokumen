"""
Payment proxy — wraps Louvin payment gateway.
Keeps Louvin API key server-side, never exposed to the browser.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx

from config.settings import settings
from utils.auth import get_supabase_bearer_user

router = APIRouter()

PLANS = {
    "koperasi": {"amount": 499000, "description": "OtaruChain Koperasi — 1 bulan"},
    "enterprise": {"amount": 999000, "description": "OtaruChain Enterprise — 1 bulan"},
}


class CheckoutRequest(BaseModel):
    plan: str


@router.post("/api/v1/payment/checkout")
async def create_checkout(
    body: CheckoutRequest,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    if not settings.LOUVIN_API_KEY:
        raise HTTPException(status_code=503, detail="LOUVIN_API_KEY belum dikonfigurasi di environment backend")

    plan = body.plan.lower()
    if plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Plan tidak dikenal: {plan}")

    plan_info = PLANS[plan]
    payload = {
        "slug": settings.LOUVIN_SLUG,
        "amount": plan_info["amount"],
        "description": plan_info["description"],
        "customer_email": current_user["email"],
        "customer_name": current_user.get("email", ""),
        "redirect_url": "https://otaruchain.vercel.app/dashboard?payment=success",
        "callback_url": "https://api-ocr.xyz/api/v1/payment/callback",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{settings.LOUVIN_BASE_URL}/create-transaction",
            json=payload,
            headers={"Authorization": f"Bearer {settings.LOUVIN_API_KEY}", "Content-Type": "application/json"},
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail="Gagal membuat transaksi via payment gateway.")

    data = resp.json()
    payment_url = data.get("payment_url") or data.get("redirect_url") or data.get("url")
    if not payment_url:
        raise HTTPException(status_code=502, detail="Payment gateway tidak mengembalikan URL.")

    return {"payment_url": payment_url, "plan": plan, "amount": plan_info["amount"]}


@router.post("/api/v1/payment/callback")
async def payment_callback(request: dict):
    """
    Receive payment confirmation from Louvin and activate subscription.
    TODO: verify signature, update partner_subscriptions table.
    """
    return {"ok": True}
