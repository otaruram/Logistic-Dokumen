"""Telegram linking API (NIK + permanent tele key)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config.settings import settings
from models.models import User
from services.scan_helpers import get_supabase_admin
from services.telegram_service import (
    generate_tele_key,
    hash_nik,
    validate_nik,
)
from utils.auth import get_current_active_user

router = APIRouter()


class TelegramConnectRequest(BaseModel):
    nik: str


@router.post("/connect")
async def connect_telegram(
    body: TelegramConnectRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Create or refresh Telegram connection profile with permanent tele key."""
    if not validate_nik(body.nik):
        raise HTTPException(status_code=400, detail="NIK must be 16 numeric digits")

    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase admin is not configured")

    nik_hash = hash_nik(body.nik, salt=settings.JWT_SECRET)
    nik_last4 = body.nik[-4:]

    try:
        existing_res = (
            sb.table("telegram_links")
            .select("id, tele_key, is_linked, telegram_chat_id, nik_last4")
            .eq("user_id", str(current_user.id))
            .limit(1)
            .execute()
        )
        existing = (getattr(existing_res, "data", None) or [])
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to access telegram_links table. "
                "Please run latest database/schema.sql migration. "
                f"Error: {str(e)}"
            ),
        )

    if existing:
        row = existing[0]
        tele_key = row.get("tele_key") or generate_tele_key()
        payload = {
            "nik_hash": nik_hash,
            "nik_last4": nik_last4,
            "tele_key": tele_key,
            "updated_at": "now()",
        }
        (
            sb.table("telegram_links")
            .update(payload)
            .eq("id", row["id"])
            .execute()
        )
        is_linked = bool(row.get("is_linked"))
        chat_id = row.get("telegram_chat_id")
    else:
        tele_key = generate_tele_key()
        payload = {
            "user_id": str(current_user.id),
            "tele_key": tele_key,
            "nik_hash": nik_hash,
            "nik_last4": nik_last4,
            "is_linked": False,
        }
        (
            sb.table("telegram_links")
            .insert(payload)
            .execute()
        )
        is_linked = False
        chat_id = None

    bot_username = settings.TELEGRAM_BOT_USERNAME
    deep_link = f"https://t.me/{bot_username}?start={tele_key}"

    return {
        "message": "Telegram key ready",
        "nik_last4": nik_last4,
        "tele_key": tele_key,
        "is_linked": is_linked,
        "telegram_chat_id": chat_id,
        "bot_username": bot_username,
        "start_command": f"/start {tele_key}",
        "deep_link": deep_link,
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
            .select("tele_key, nik_last4, is_linked, telegram_chat_id, linked_at, updated_at")
            .eq("user_id", str(current_user.id))
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to access telegram_links table. "
                "Please run latest database/schema.sql migration. "
                f"Error: {str(e)}"
            ),
        )

    data = getattr(res, "data", None) or []
    if not data:
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
        "nik_last4": row.get("nik_last4"),
        "telegram_chat_id": row.get("telegram_chat_id"),
        "linked_at": row.get("linked_at"),
        "updated_at": row.get("updated_at"),
        "bot_username": settings.TELEGRAM_BOT_USERNAME,
        "deep_link": f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start={row.get('tele_key', '')}",
    }
