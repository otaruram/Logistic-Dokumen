"""Telegram linking API — email-based, no NIK required."""

from __future__ import annotations

import hashlib
from typing import Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel

from config.settings import settings
from models.models import User
from services.scan_helpers import get_supabase_admin
from services.telegram_service import generate_tele_key
from utils.auth import get_current_active_user

router = APIRouter()


class ConnectBody(BaseModel):
    phone_number: Optional[str] = None


class PhoneAutoFillResponse(BaseModel):
    phone_number: str
    source: Literal["existing", "generated"]
    message: str


def _resolve_bot_username(bot: str) -> tuple[str, str]:
    return "otaruchain", settings.TELEGRAM_BOT_USERNAME


def _build_deep_links(tele_key: str) -> dict[str, str]:
    main_username = settings.TELEGRAM_BOT_USERNAME
    return {
        "otaruchain": f"https://t.me/{main_username}?start={tele_key}"
    }


def _generate_unique_beta_phone(sb, user_id: str) -> str:
    """Generate deterministic-yet-unique beta phone number (08xxxxxxxxxx) per user."""
    # Try existing first to keep identity stable across Telegram and Partner API flows.
    try:
        existing_res = (
            sb.table("profiles")
            .select("phone_number")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        existing_rows = getattr(existing_res, "data", None) or []
        existing_phone = (existing_rows[0].get("phone_number") if existing_rows else None) or ""
        if isinstance(existing_phone, str) and existing_phone.startswith("0") and existing_phone[1:].isdigit() and 10 <= len(existing_phone) <= 13:
            return existing_phone
    except Exception:
        pass

    for attempt in range(50):
        digest = hashlib.sha256(f"{user_id}:beta-phone:{attempt}".encode("utf-8")).hexdigest()
        numeric = int(digest[:15], 16) % 10_000_000_000
        candidate = "08" + str(numeric).zfill(10)

        # Ensure uniqueness across users.
        check_res = (
            sb.table("profiles")
            .select("id")
            .eq("phone_number", candidate)
            .neq("id", user_id)
            .limit(1)
            .execute()
        )
        check_rows = getattr(check_res, "data", None) or []
        if not check_rows:
            return candidate

    raise HTTPException(status_code=500, detail="Gagal generate nomor HP unik beta")


@router.get("/phone/autofill", response_model=PhoneAutoFillResponse)
async def autofill_phone_for_telegram():
    """
    Auto-fill helper for Telegram - returns dummy test phone number.
    No authentication required. Returns a test phone number for initial Telegram linking.
    """
    test_phone = "081234567890"
    return PhoneAutoFillResponse(
        phone_number=test_phone,
        source="generated",
        message="Nomor HP beta siap dipakai untuk Telegram key dan API key.",
    )


@router.post("/connect")
@router.get("/connect/init")
async def connect_telegram(
    bot: Literal["otaruchain"] = Query("otaruchain"),
    body: Optional[ConnectBody] = Body(None),
    current_user: User = Depends(get_current_active_user),
):
    """
    Auto-generate (or return existing) tele key for the authenticated user.
    Accepts optional phone_number in body — saved to profiles as primary identity.
    """
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase admin is not configured")

    # ── Save phone_number to profiles if provided ──
    phone_number = None
    if body and body.phone_number:
        import re
        cleaned = re.sub(r"[^\d]", "", body.phone_number)
        # Normalize: strip leading +62 or 62
        if cleaned.startswith("62") and len(cleaned) > 10:
            cleaned = "0" + cleaned[2:]
        if not cleaned.startswith("0"):
            cleaned = "0" + cleaned
        if len(cleaned) >= 10 and len(cleaned) <= 14:
            phone_number = cleaned
            try:
                # Check uniqueness
                check_res = sb.table("profiles").select("id").eq("phone_number", phone_number).neq("id", str(current_user.id)).limit(1).execute()
                if check_res.data:
                    raise HTTPException(status_code=400, detail="Nomor telepon sudah digunakan oleh akun lain. Silakan gunakan nomor lain.")

                sb.table("profiles").update(
                    {"phone_number": phone_number}
                ).eq("id", str(current_user.id)).execute()
            except HTTPException:
                raise
            except Exception:
                pass  # Non-blocking — don't fail key generation

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

    selected_bot, bot_username = _resolve_bot_username(bot)
    deep_links = _build_deep_links(tele_key)

    return {
        "message": "Telegram key generated",
        "tele_key": tele_key,
        "is_linked": is_linked,
        "telegram_chat_id": chat_id,
        "phone_number": phone_number,
        "bot_username": bot_username,
        "selected_bot": selected_bot,
        "available_bots": ["otaruchain"],
        "start_command": f"/start {tele_key}",
        "deep_link": deep_links[selected_bot],
        "deep_links": deep_links,
        "has_key": True,
    }


@router.get("/connect/status")
async def telegram_connect_status(
    bot: Literal["otaruchain"] = Query("otaruchain"),
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

    selected_bot, bot_username = _resolve_bot_username(bot)

    data = getattr(res, "data", None) or []
    if not data:
        # Auto-init key if none exists yet (convenient for first visit)
        return {
            "connected": False,
            "has_key": False,
            "bot_username": bot_username,
            "selected_bot": selected_bot,
            "available_bots": ["otaruchain"],
        }

    row = data[0]
    tele_key = row.get("tele_key", "")
    deep_links = _build_deep_links(tele_key)

    phone_number = None
    try:
        prof_res = (
            sb.table("profiles")
            .select("phone_number")
            .eq("id", str(current_user.id))
            .limit(1)
            .execute()
        )
        prof_rows = getattr(prof_res, "data", None) or []
        if prof_rows:
            phone_number = prof_rows[0].get("phone_number")
    except Exception:
        phone_number = None

    return {
        "connected": bool(row.get("is_linked")),
        "has_key": bool(tele_key),
        "tele_key": tele_key,
        "telegram_chat_id": row.get("telegram_chat_id"),
        "phone_number": phone_number,
        "linked_at": row.get("linked_at"),
        "updated_at": row.get("updated_at"),
        "bot_username": bot_username,
        "selected_bot": selected_bot,
        "available_bots": ["otaruchain"],
        "deep_link": deep_links[selected_bot],
        "deep_links": deep_links,
    }
