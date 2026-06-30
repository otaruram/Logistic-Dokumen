"""
Payment proxy — wraps Louvin payment gateway.
Keeps Louvin API key server-side, never exposed to the browser.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx
import logging

from config.settings import settings
from utils.auth import get_supabase_bearer_user

logger = logging.getLogger(__name__)
router = APIRouter()


def _extract_payment_url(payload: object) -> str | None:
    """Find checkout URL recursively from unknown gateway response shapes."""
    if isinstance(payload, str):
        return payload if payload.startswith(("http://", "https://")) else None

    if isinstance(payload, dict):
        preferred_keys = (
            "payment_url",
            "redirect_url",
            "checkout_url",
            "invoice_url",
            "transaction_url",
            "payment_link",
            "url",
            "qr_url",
            "deeplink",
        )
        for key in preferred_keys:
            value = payload.get(key)
            if isinstance(value, str) and value.startswith(("http://", "https://")):
                return value

        for value in payload.values():
            found = _extract_payment_url(value)
            if found:
                return found

    if isinstance(payload, list):
        for item in payload:
            found = _extract_payment_url(item)
            if found:
                return found

    return None


async def _resolve_payment_url_from_followup(
    client: httpx.AsyncClient,
    transaction_id: str | None,
    reference: str | None,
) -> str | None:
    """Try common Louvin follow-up endpoints to obtain payment URL."""
    candidates: list[tuple[str, str]] = []
    if transaction_id:
        candidates.extend([
            ("GET", f"{settings.LOUVIN_BASE_URL}/transaction/{transaction_id}"),
            ("GET", f"{settings.LOUVIN_BASE_URL}/transactions/{transaction_id}"),
        ])
    if reference:
        candidates.extend([
            ("GET", f"{settings.LOUVIN_BASE_URL}/transaction/reference/{reference}"),
            ("GET", f"{settings.LOUVIN_BASE_URL}/transactions/reference/{reference}"),
        ])

    headers = {
        "Authorization": f"Bearer {settings.LOUVIN_API_KEY}",
        "x-api-key": settings.LOUVIN_API_KEY,
        "Content-Type": "application/json",
    }

    for method, url in candidates:
        try:
            resp = await client.request(method, url, headers=headers)
            if resp.status_code not in (200, 201):
                continue
            data = resp.json()
            found = _extract_payment_url(data)
            if found:
                return found
        except Exception:
            continue

    return None

PLANS = {
    "launch": {"amount": 599000, "description": "OtaruChain Launch Partner — 1 bulan"},
    "growth": {"amount": 1499000, "description": "OtaruChain Scale Partner — 1 bulan"},
    "enterprise": {"amount": 3999000, "description": "OtaruChain Enterprise Partner — 1 bulan"},
    "topup": {"amount": 300000, "description": "OtaruChain Top-up 100 Requests"},
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
    frontend_base = (settings.PROD_FE_URL or "https://otaruchain.id").rstrip("/")
    api_base = (settings.API_URL or "https://api-ocr.xyz").rstrip("/")
    payload = {
        "slug": settings.LOUVIN_SLUG,
        "amount": plan_info["amount"],
        "description": plan_info["description"],
        "customer_email": current_user["email"],
        "customer_name": current_user.get("email", ""),
        "email": current_user["email"],
        "name": current_user.get("email", ""),
        "payment_type": "qris",  # Default to QRIS (universal QR code payment)
        "redirect_url": f"{frontend_base}/dashboard?payment=success",
        "callback_url": f"{api_base}/api/v1/payment/callback",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{settings.LOUVIN_BASE_URL}/create-transaction",
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.LOUVIN_API_KEY}",
                "x-api-key": settings.LOUVIN_API_KEY,
                "Content-Type": "application/json",
            },
        )

    if resp.status_code not in (200, 201):
        detail_text = ""
        try:
            detail_text = str(resp.json())
        except Exception:
            detail_text = (resp.text or "")[:500]
        logger.error(f"Louvin API error: status={resp.status_code}, body={detail_text}")
        raise HTTPException(
            status_code=502,
            detail=f"Gagal membuat transaksi via payment gateway (status={resp.status_code}): {detail_text}",
        )

    data = resp.json()
    logger.info(f"Louvin response: {data}")

    transaction = data.get("transaction") if isinstance(data.get("transaction"), dict) else {}
    payment_url = _extract_payment_url(data)

    if not payment_url:
        transaction_id = str(transaction.get("id") or "") or None
        reference = str(transaction.get("reference") or "") or None
        async with httpx.AsyncClient(timeout=15.0) as followup_client:
            payment_url = await _resolve_payment_url_from_followup(
                followup_client,
                transaction_id,
                reference,
            )

    if not payment_url:
        logger.error(
            "No payment URL found in Louvin response. Root keys=%s transaction_keys=%s",
            list(data.keys()),
            list(transaction.keys()),
        )
        raise HTTPException(
            status_code=502,
            detail=f"Payment gateway tidak mengembalikan URL. Response: {str(data)[:200]}"
        )

    return {"payment_url": payment_url, "plan": plan, "amount": plan_info["amount"]}


@router.post("/api/v1/payment/callback")
async def payment_callback(request: dict):
    """
    Receive payment confirmation from Louvin and activate subscription.
    Louvin may send: status, transaction_id, customer_email, plan, amount, timestamp
    """
    logger.info(f"Payment callback received: {request}")
    
    try:
        # Extract fields from callback payload
        status = request.get("status", "").lower()
        customer_email = request.get("customer_email") or request.get("email")
        transaction_id = request.get("transaction_id") or request.get("id")
        
        if status != "success":
            logger.warning(f"Payment callback status not success: {status}, tx={transaction_id}")
            return {"ok": False, "reason": f"Payment status: {status}"}
        
        if not customer_email:
            logger.error(f"No customer_email in callback: {request}")
            return {"ok": False, "reason": "Missing customer_email"}
        
        # TODO: Verify signature with Louvin (if they provide HMAC in callback)
        # TODO: Update partner_subscriptions table with activated plan + expiry
        # For now, just log successful payment
        logger.info(f"Payment successful for {customer_email}, tx={transaction_id}")
        
        return {"ok": True, "message": "Payment confirmed"}
        
    except Exception as e:
        logger.error(f"Error processing payment callback: {str(e)}")
        return {"ok": False, "error": str(e)}
