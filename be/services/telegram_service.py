"""
Telegram integration service helpers.

Handles:
- Telegram link lookup/update in Supabase table `telegram_links`
- Fraud scan processing from Telegram photo uploads
- Dashboard summary retrieval for Telegram bot commands
"""

from __future__ import annotations

import hashlib
import secrets
import time
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import HTTPException

from services.scan_helpers import (
    confidence_to_status,
    get_supabase_admin,
    sync_to_supabase,
    upload_and_ocr,
    SCAN_COST,
)


_DASHBOARD_CACHE_TTL = 60
_dashboard_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def generate_tele_key() -> str:
    """Generate a permanent connection key for Telegram linking."""
    return secrets.token_urlsafe(24)


def validate_nik(nik: str) -> bool:
    """Basic Indonesian NIK validation: 16 numeric digits."""
    return isinstance(nik, str) and nik.isdigit() and len(nik) == 16


def hash_nik(nik: str, *, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{nik}".encode("utf-8")).hexdigest()


def get_link_by_key(tele_key: str) -> Optional[dict[str, Any]]:
    sb = get_supabase_admin()
    if not sb:
        return None

    res = (
        sb.table("telegram_links")
        .select("id,user_id,tele_key,is_linked,telegram_chat_id,nik_last4")
        .eq("tele_key", tele_key)
        .limit(1)
        .execute()
    )
    data = getattr(res, "data", None) or []
    return data[0] if data else None


def get_link_by_chat_id(chat_id: int) -> Optional[dict[str, Any]]:
    sb = get_supabase_admin()
    if not sb:
        return None

    res = (
        sb.table("telegram_links")
        .select("id,user_id,tele_key,is_linked,telegram_chat_id,nik_last4")
        .eq("telegram_chat_id", str(chat_id))
        .eq("is_linked", True)
        .limit(1)
        .execute()
    )
    data = getattr(res, "data", None) or []
    return data[0] if data else None


def link_chat_to_user(*, tele_key: str, chat_id: int, telegram_user_id: Optional[int], username: Optional[str]) -> dict[str, Any]:
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase admin is not configured")

    link = get_link_by_key(tele_key)
    if not link:
        raise HTTPException(status_code=404, detail="Invalid tele key")

    payload = {
        "is_linked": True,
        "telegram_chat_id": str(chat_id),
        "telegram_user_id": str(telegram_user_id) if telegram_user_id is not None else None,
        "telegram_username": username,
        "linked_at": "now()",
    }

    (
        sb.table("telegram_links")
        .update(payload)
        .eq("id", link["id"])
        .execute()
    )

    updated = get_link_by_key(tele_key)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update telegram link")
    return updated


def _get_profile_credits(user_id: str) -> int:
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase admin is not configured")

    profile = (
        sb.table("profiles")
        .select("credits")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(profile, "data", None) or []
    if not rows:
        return 0
    data = rows[0] if isinstance(rows[0], dict) else {}
    return int(data.get("credits", 0) or 0)


def _ensure_profile_credits(user_id: str) -> int:
    """Ensure profile exists and has at least default credits for Telegram flow."""
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase admin is not configured")

    profile = (
        sb.table("profiles")
        .select("id,credits")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(profile, "data", None) or []
    if not rows:
        try:
            sb.table("profiles").insert({"id": user_id, "credits": 10}).execute()
        except Exception:
            # If profile has additional required fields, keep default for Telegram flow
            # and let web profile sync populate it later.
            return 10
        return 10

    data = rows[0] if isinstance(rows[0], dict) else {}
    credits = data.get("credits")
    if credits is None:
        sb.table("profiles").update({"credits": 10}).eq("id", user_id).execute()
        return 10
    return int(credits or 0)


def _set_profile_credits(user_id: str, credits: int) -> None:
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase admin is not configured")
    res = sb.table("profiles").update({"credits": credits}).eq("id", user_id).execute()
    rows = getattr(res, "data", None) or []
    if not rows:
        try:
            sb.table("profiles").insert({"id": user_id, "credits": credits}).execute()
        except Exception:
            pass


async def process_fraud_scan_from_telegram(*, user_id: str, recipient_name: str, signature_url: str, content: bytes, filename: str) -> dict[str, Any]:
    """Run fraud OCR pipeline from Telegram photo bytes and sync to Supabase tables."""
    content_hash = hashlib.sha256(content).hexdigest()

    credits = _ensure_profile_credits(user_id)
    if credits < SCAN_COST:
        raise HTTPException(status_code=402, detail=f"Insufficient credits. Need {SCAN_COST}, available {credits}")

    new_balance = credits - SCAN_COST
    _set_profile_credits(user_id, new_balance)

    image_url, extracted, ocr_result = await upload_and_ocr(content, filename, folder="/telegram-fraud")
    structured = ocr_result.get("structured_fields", {})
    confidence = structured.get("confidence", "low")
    fraud_status = confidence_to_status(confidence)

    sync_to_supabase(
        user_id=user_id,
        filename=filename,
        image_url=image_url,
        content_hash=content_hash,
        recipient_name=recipient_name,
        signature_url=signature_url,
        structured=structured,
        ocr_result=ocr_result,
        is_fraud=True,
    )
    print(f"✅ [Telegram] sync_to_supabase completed for user={user_id}, file={filename}, status={fraud_status}")

    # Ensure a fraud history row exists even if sync helper insert is skipped by DB constraints.
    sb = get_supabase_admin()
    if sb:
        try:
            existing = (
                sb.table("fraud_scans")
                .select("id")
                .eq("user_id", user_id)
                .eq("doc_hash", content_hash)
                .limit(1)
                .execute()
            )
            existing_rows = getattr(existing, "data", None) or []
            if not existing_rows:
                nominal_amount = structured.get("nominal_total") or 0
                fallback_payload = {
                    "user_id": user_id,
                    "original_filename": filename,
                    "file_url": image_url,
                    "imagekit_url": image_url,
                    "signature_url": signature_url,
                    "recipient_name": recipient_name,
                    "extracted_text": ocr_result.get("enhanced_text") or "",
                    "confidence_score": ocr_result.get("confidence_score", 0),
                    "processing_time": ocr_result.get("processing_time", 0),
                    "nominal_total": nominal_amount,
                    "nama_klien": structured.get("nama_klien"),
                    "nomor_surat_jalan": structured.get("nomor_surat_jalan"),
                    "tanggal_jatuh_tempo": structured.get("tanggal_jatuh_tempo"),
                    "field_confidence": confidence,
                    "doc_hash": content_hash,
                    "status": fraud_status,
                }
                res = sb.table("fraud_scans").insert(fallback_payload).execute()
                print(f"✅ [Telegram] Fallback fraud_scans insert for user={user_id}, rows={len(getattr(res, 'data', None) or [])}")
            else:
                print(f"ℹ️ [Telegram] fraud_scans row already exists for hash={content_hash[:16]}...")
        except Exception as e:
            print(f"❌ [Telegram] Fallback fraud_scans insert FAILED for user={user_id}: {e}")

    result = {
        "status": fraud_status,
        "confidence": confidence,
        "credits_remaining": new_balance,
        "image_url": image_url,
        "nominal_total": structured.get("nominal_total"),
        "nama_klien": structured.get("nama_klien"),
        "nomor_surat_jalan": structured.get("nomor_surat_jalan"),
        "tanggal_jatuh_tempo": structured.get("tanggal_jatuh_tempo"),
        "excerpt": (extracted or "")[:240],
        "cached": False,
    }
    _dashboard_cache.pop(user_id, None)
    return result


def get_dashboard_summary(user_id: str) -> dict[str, Any]:
    """Read fraud-focused dashboard summary for Telegram bot.

    Uses the same base metrics as web dashboard realtime endpoint
    so Telegram and web values stay consistent.
    """
    now = time.time()
    cached = _dashboard_cache.get(user_id)
    if cached and now - cached[0] <= _DASHBOARD_CACHE_TTL:
        return dict(cached[1])

    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase admin is not configured")

    scans_res = (
        sb.table("fraud_scans")
        .select("status,nominal_total,created_at")
        .eq("user_id", user_id)
        .execute()
    )
    scans = getattr(scans_res, "data", None) or []

    verified = sum(1 for s in scans if s.get("status") == "verified")
    processing = sum(1 for s in scans if s.get("status") == "processing")
    tampered = sum(1 for s in scans if s.get("status") == "tampered")
    total_fraud_scans = len(scans)

    # Keep web parity: web card sums nominal_total from fraud_scans.
    total_revenue_valid = sum(float(s.get("nominal_total") or 0) for s in scans)

    trust_score = 0
    total_docs = verified + processing + tampered
    if total_docs > 0:
        raw_score = (verified * 100 + processing * 50 + tampered * 50) / total_docs
        trust_score = min(int(raw_score * 10), 1000)

    # Weekly usage (Mon-Sun) for future Telegram/web consistency checks.
    weekly_counts = [0] * 7
    week_start = datetime.utcnow() - timedelta(days=datetime.utcnow().weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    for s in scans:
        ts = s.get("created_at")
        if not ts:
            continue
        try:
            dt_str = ts[:-1] + "+00:00" if isinstance(ts, str) and ts.endswith("Z") else ts
            dt = datetime.fromisoformat(dt_str).replace(tzinfo=None)
            if week_start <= dt <= week_end:
                weekly_counts[dt.weekday()] += 1
        except Exception:
            continue

    profile_credits = _ensure_profile_credits(user_id)

    result = {
        "trust_score": trust_score,
        "total_revenue_valid": total_revenue_valid,
        "verified_documents": verified,
        "processing_documents": processing,
        "tampered_documents": tampered,
        "total_fraud_scans": total_fraud_scans,
        "credits": profile_credits,
        "weekly_usage": weekly_counts,
    }
    _dashboard_cache[user_id] = (now, dict(result))
    return result


def get_recent_fraud_history(user_id: str, *, limit: int = 5) -> list[dict[str, Any]]:
    """Get recent fraud scan logs for Telegram history command."""
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase admin is not configured")

    res = (
        sb.table("fraud_scans")
        .select("id,created_at,status,nominal_total,nama_klien,nomor_surat_jalan,field_confidence")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    result: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        result.append(
            {
                "id": row.get("id"),
                "created_at": row.get("created_at"),
                "status": row.get("status") or "processing",
                "nominal_total": row.get("nominal_total") or 0,
                "nama_klien": row.get("nama_klien") or "-",
                "nomor_surat_jalan": row.get("nomor_surat_jalan") or "-",
                "field_confidence": row.get("field_confidence") or "low",
            }
        )
    return result
