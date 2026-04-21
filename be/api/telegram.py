"""Telegram linking API — email-based, no NIK required."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config.settings import settings
from models.models import User
from services.scan_helpers import get_supabase_admin
from services.telegram_service import generate_tele_key
from utils.auth import get_current_active_user

router = APIRouter()


@router.post("/connect")
@router.get("/connect/init")
async def connect_telegram(
    current_user: User = Depends(get_current_active_user),
):
    """
    Auto-generate (or return existing) tele key for the authenticated user.
    No NIK input required — identity comes from the logged-in web session.
    Each call with a new key will reset the Telegram session for this account.
    """
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase admin is not configured")

    try:
        existing_res = (
            sb.table("telegram_links")
            .select("id, tele_key, is_linked, telegram_chat_id")
            .eq("user_id", str(current_user.id))
            .limit(1)
            .execute()
        )
        existing = getattr(existing_res, "data", None) or []
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to access telegram_links: {str(e)}",
        )

    tele_key = generate_tele_key()

    if existing:
        row = existing[0]
        # Always issue a NEW key — this resets any prior Telegram session
        (
            sb.table("telegram_links")
            .update({"tele_key": tele_key, "is_linked": False,
                     "telegram_chat_id": None, "telegram_user_id": None,
                     "telegram_username": None, "linked_at": None,
                     "updated_at": "now()"})
            .eq("id", row["id"])
            .execute()
        )
        chat_id = None
        is_linked = False
    else:
        sb.table("telegram_links").insert({
            "user_id": str(current_user.id),
            "tele_key": tele_key,
            "is_linked": False,
        }).execute()
        chat_id = None
        is_linked = False

    bot_username = settings.TELEGRAM_BOT_USERNAME
    deep_link = f"https://t.me/{bot_username}?start={tele_key}"

    return {
        "message": "Telegram key generated",
        "tele_key": tele_key,
        "is_linked": is_linked,
        "telegram_chat_id": chat_id,
        "bot_username": bot_username,
        "start_command": f"/start {tele_key}",
        "deep_link": deep_link,
        "has_key": True,
    }


@router.get("/connect/status")
async def telegram_connect_status(
    current_user: User = Depends(get_current_active_user),
):
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase admin is not configured")

    try:
        res = (
            sb.table("telegram_links")
            .select("tele_key, is_linked, telegram_chat_id, linked_at, updated_at")
            .eq("user_id", str(current_user.id))
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to access telegram_links: {str(e)}")

    data = getattr(res, "data", None) or []
    if not data:
        # Auto-init key if none exists yet (convenient for first visit)
        return {
            "connected": False,
            "has_key": False,
            "bot_username": settings.TELEGRAM_BOT_USERNAME,
        }

    row = data[0]
    return {
        "connected": bool(row.get("is_linked")),
        "has_key": bool(row.get("tele_key")),
        "tele_key": row.get("tele_key"),
        "telegram_chat_id": row.get("telegram_chat_id"),
        "linked_at": row.get("linked_at"),
        "updated_at": row.get("updated_at"),
        "bot_username": settings.TELEGRAM_BOT_USERNAME,
        "deep_link": f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start={row.get('tele_key', '')}",
    }
