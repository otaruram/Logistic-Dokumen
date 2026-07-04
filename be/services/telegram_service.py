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
import requests
from datetime import datetime, timedelta
from typing import Any, Optional

def send_telegram_notif(chat_id: int, text: str) -> None:
    token = settings.TELEGRAM_BOT_TOKEN
    if not token or not chat_id:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True},
            timeout=8,
        )
    except Exception:
        pass

from fastapi import HTTPException
from openai import AsyncOpenAI
from config.settings import settings
from config.redis_client import RedisClient

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


def unlink_chat(chat_id: int) -> bool:
    """Unlink a Telegram chat from any associated web account.

    Clears ``telegram_chat_id`` and sets ``is_linked=False`` for every
    ``telegram_links`` row currently bound to this chat.  Used by /reset.
    """
    sb = get_supabase_admin()
    if not sb:
        return False
    try:
        sb.table("telegram_links") \
            .update({"is_linked": False, "telegram_chat_id": None}) \
            .eq("telegram_chat_id", str(chat_id)) \
            .execute()
        return True
    except Exception as e:
        print(f"âŒ [Telegram] unlink_chat failed for chat_id={chat_id}: {e}")
        return False


def link_chat_to_user(*, tele_key: str, chat_id: int, telegram_user_id: Optional[int], username: Optional[str], phone_number: Optional[str] = None) -> dict[str, Any]:
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase admin is not configured")

    link = get_link_by_key(tele_key)
    if not link:
        raise HTTPException(status_code=404, detail="Invalid tele key")

    # Detach this chat from ANY previous account before binding to the new one.
    # This prevents the same Telegram chat from appearing linked to two different
    # web users simultaneously, which would cause the wrong user's data to appear.
    try:
        sb.table("telegram_links") \
            .update({"is_linked": False, "telegram_chat_id": None}) \
            .eq("telegram_chat_id", str(chat_id)) \
            .neq("id", link["id"]) \
            .execute()
    except Exception as e:
        print(f"âš ï¸ [Telegram] Could not clear old chat_id bindings: {e}")

    payload = {
        "is_linked": True,
        "telegram_chat_id": str(chat_id),
        "telegram_user_id": str(telegram_user_id) if telegram_user_id is not None else None,
        "telegram_username": username,
        "linked_at": "now()",
    }

    # Store phone_number if provided
    if phone_number:
        clean_phone = phone_number.strip().replace("+62", "0").replace("-", "").replace(" ", "")
        payload["phone_number"] = clean_phone
        # Also update the user's profile with the verified phone number
        user_id = link.get("user_id")
        if user_id:
            try:
                sb.table("profiles").update({"phone_number": clean_phone}).eq("id", user_id).execute()
            except Exception as e:
                print(f"âš ï¸ [Telegram] Could not update profile phone_number: {e}")

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
    print(f"âœ… [Telegram] sync_to_supabase completed for user={user_id}, file={filename}, status={fraud_status}")

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
                print(f"âœ… [Telegram] Fallback fraud_scans insert for user={user_id}, rows={len(getattr(res, 'data', None) or [])}")
            else:
                print(f"â„¹ï¸ [Telegram] fraud_scans row already exists for hash={content_hash[:16]}...")
        except Exception as e:
            print(f"âŒ [Telegram] Fallback fraud_scans insert FAILED for user={user_id}: {e}")

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

    # Only count verified/tampered if admin has reviewed â€” prevents auto-classified counts
    verified = sum(1 for s in scans if s.get("status") == "verified" and s.get("admin_reviewed") is True)
    processing = sum(1 for s in scans if s.get("status") == "processing")
    tampered = sum(1 for s in scans if s.get("status") == "tampered" and s.get("admin_reviewed") is True)
    # Legacy fallback: also count rows without admin_reviewed flag (pre-migration)
    verified += sum(1 for s in scans if s.get("status") == "verified" and s.get("admin_reviewed") is None and s.get("reviewed_at"))
    tampered += sum(1 for s in scans if s.get("status") == "tampered" and s.get("admin_reviewed") is None and s.get("reviewed_at"))
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


def analyze_signature(image_bytes: bytes) -> dict[str, Any]:
    """Analyze a document image for TTD (tanda tangan) and stempel authenticity.

    Uses OpenAI vision if available, falls back to a basic heuristic via PIL.

    Returns a dict with:
      - found: bool â€” whether a signature/stempel region was detected
      - stempel: bool â€” whether an official stamp (cap/stempel) was detected
      - verdict: str â€” "asli" | "mencurigakan" | "tidak ada TTD"
      - detail: str â€” human-readable explanation (Indonesian)
      - confidence: str â€” "high" | "medium" | "low"
    """
    from config.settings import settings

    # â”€â”€ Try OpenAI / Groq vision â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try:
        import base64
        from openai import OpenAI
        import httpx

        api_key = settings.OPENAI_API_KEY or ""
        base_url = getattr(settings, "OPENAI_BASE_URL", "https://api.openai.com/v1") or "https://api.openai.com/v1"

        # Fall back to first Groq key if no OpenAI key
        if not api_key and getattr(settings, "groq_api_keys", None):
            api_key = settings.groq_api_keys[0]
            base_url = getattr(settings, "GROQ_BASE_URL", "https://api.groq.com/openai/v1")

        if api_key:
            b64 = base64.b64encode(image_bytes).decode()
            client = OpenAI(
                api_key=api_key,
                base_url=base_url,
                http_client=httpx.Client(timeout=30.0),
            )
            prompt = (
                "Analisis gambar dokumen ini untuk verifikasi tanda tangan (TTD) dan stempel/cap. "
                "Jawab HANYA dalam JSON valid dengan field berikut (tidak ada teks lain):\n"
                "{\n"
                '  "found": true/false,\n'
                '  "stempel": true/false,\n'
                '  "verdict": "asli" | "mencurigakan" | "tidak ada TTD",\n'
                '  "detail": "<penjelasan singkat 1-2 kalimat dalam Bahasa Indonesia>",\n'
                '  "confidence": "high" | "medium" | "low"\n'
                "}\n\n"
                "Kriteria:\n"
                "- found: ada TTD berupa goresan tangan (bukan teks cetak)\n"
                "- stempel: ada cap/stempel berbentuk lingkaran/kotak berwarna\n"
                "- verdict 'asli': TTD dan/atau stempel terlihat asli, tidak ada anomali\n"
                "- verdict 'mencurigakan': TTD terlihat copy-paste, blur inkonsisten, stempel palsu, "
                "atau tanda tangan tidak ada tapi dokumen seharusnya memilikinya\n"
                "- verdict 'tidak ada TTD': tidak ada tanda tangan sama sekali"
            )
            # Use a vision-capable model; fall back gracefully if 404
            for model in ("gpt-4o-mini", "llava-v1.5-7b-4096-preview", "meta-llama/llama-4-scout-17b-16e-instruct"):
                try:
                    response = client.chat.completions.create(
                        model=model,
                        messages=[
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": prompt},
                                    {
                                        "type": "image_url",
                                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                                    },
                                ],
                            }
                        ],
                        max_tokens=300,
                        temperature=0,
                    )
                    raw = (response.choices[0].message.content or "").strip()
                    # strip markdown fences
                    if raw.startswith("```"):
                        raw = raw.strip("`").lstrip("json").strip()
                    import json as _json
                    parsed = _json.loads(raw)
                    return {
                        "found": bool(parsed.get("found", False)),
                        "stempel": bool(parsed.get("stempel", False)),
                        "verdict": str(parsed.get("verdict", "tidak ada TTD")),
                        "detail": str(parsed.get("detail", "")),
                        "confidence": str(parsed.get("confidence", "low")),
                    }
                except Exception:
                    continue
    except Exception as e:
        print(f"âš ï¸ [TTD] Vision API error: {e}")

    # â”€â”€ Heuristic fallback via PIL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try:
        import io
        from PIL import Image, ImageFilter
        import numpy as np  # type: ignore[import]

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        # Downscale for speed
        img.thumbnail((400, 400))
        arr = np.array(img, dtype=np.float32)

        # Blue ink detection (common for TTD in Indonesia): high B, lower R+G delta
        b_channel = arr[:, :, 2]
        r_channel = arr[:, :, 0]
        g_channel = arr[:, :, 1]
        blue_ink = (b_channel > 100) & (b_channel > r_channel + 20) & (b_channel > g_channel + 20)
        blue_ratio = float(blue_ink.sum()) / float(arr.shape[0] * arr.shape[1])

        # Red ink (stempel is often red)
        red_ink = (r_channel > 130) & (r_channel > b_channel + 40) & (r_channel > g_channel + 30)
        red_ratio = float(red_ink.sum()) / float(arr.shape[0] * arr.shape[1])

        found = blue_ratio > 0.005
        stempel = red_ratio > 0.005

        if found or stempel:
            verdict = "asli"
            detail = "TTD dan/atau stempel terdeteksi via analisis warna tinta."
            confidence = "medium"
        else:
            verdict = "tidak ada TTD"
            detail = "Tidak terdeteksi tinta tanda tangan atau stempel pada dokumen."
            confidence = "low"

        return {"found": found, "stempel": stempel, "verdict": verdict, "detail": detail, "confidence": confidence}
    except Exception as e:
        print(f"âš ï¸ [TTD] PIL fallback error: {e}")

    # â”€â”€ Last resort: unknown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return {
        "found": False,
        "stempel": False,
        "verdict": "tidak ada TTD",
        "detail": "Gagal menganalisis gambar.",
        "confidence": "low",
    }


async def answer_finance_question_with_context(user_id: str, question: str) -> str:
    """Answer a financial question as Otaru Financial Consultant Expert.

    Uses Gemini 2.0 Flash with:
    â€¢ strict 200 token cap for cost-efficient, blunt responses
    â€¢ Redis cache keyed on user_id + hash(financial_data)
    â€¢ auto-follow-up question at the end of each response
    â€¢ clean formatting (no markdown asterisks)
    """
    q = (question or "").strip()
    if not q:
        return "Ketik pertanyaan dulu ya, Otaru siap membantu."

    # â”€â”€ Gather UNIFIED context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    context_lines: list[str] = []
    try:
        from services.scan_helpers import get_supabase_admin
        from services.otaru_finance_service import calculate_otaru_index
        sb = get_supabase_admin()
        if sb:
            # 1. Profile data
            prof_res = sb.table("profiles").select(
                "full_name,nik,phone_number,credit_score,fraud_flags,salary,plan"
            ).eq("id", user_id).limit(1).execute()
            prof = (getattr(prof_res, "data", None) or [{}])[0] or {}
            context_lines.append(f"Nama: {prof.get('full_name') or 'N/A'}")
            context_lines.append(f"No. HP: {prof.get('phone_number') or 'N/A'}")
            context_lines.append(f"Trust Score (OtaruChain): {prof.get('credit_score') or 0}/1000")
            context_lines.append(f"Fraud Flags: {prof.get('fraud_flags') or 0}")
            context_lines.append(f"Plan: {prof.get('plan') or 'launch'}")
            salary_raw = float(prof.get('salary') or 0)
            if salary_raw > 0:
                context_lines.append(f"Gaji (dari profil): Rp {int(salary_raw):,}")

            # 2. Finance metrics (Otaru Index, DSR, etc.)
            try:
                score = calculate_otaru_index(user_id)
                context_lines.append(f"\n--- OTARU FINANCIAL METRICS ---")
                context_lines.append(f"Otaru Index: {score['otaru_index']}/1000")
                context_lines.append(f"Grade: {score['credit_grade']}")
                context_lines.append(f"DSR: {score['dsr_percent']}% (target <30%)")
                context_lines.append(f"Gaji Verified: Rp {int(score['salary']):,} (sumber: {score['salary_source']})")
                context_lines.append(f"Cicilan Aktif Total: Rp {int(score['cicilan_aktif_total']):,}")
                context_lines.append(f"Sisa Plafon Aman: Rp {int(score['sisa_plafon_aman']):,}")
                context_lines.append(f"Integrity Level: {score['integrity_level']}")
                context_lines.append(f"Tampered Attempts: {score['tampered_attempts']}")
                context_lines.append(f"Jumlah Cicilan Aktif: {score.get('active_installments_count', 0)} item")
                
                # Calculate daily spending suggestion
                net_monthly = int(score['salary']) - int(score['cicilan_aktif_total'])
                if net_monthly > 0:
                    daily_budget = int(net_monthly * 0.6 / 30)  # 60% for living expenses
                    context_lines.append(f"Budget Harian Disarankan: Rp {daily_budget:,}")
            except Exception:
                pass

            # 3. OtaruChain Work History (consistency + integrity)
            try:
                scan_res = sb.table("fraud_scans").select(
                    "id,ai_indicator,created_at"
                ).eq("user_id", user_id).order("created_at", desc=True).limit(30).execute()
                scans = getattr(scan_res, "data", None) or []
                if scans:
                    total = len(scans)
                    verified = sum(1 for s in scans if s.get("ai_indicator") == "VERIFIED")
                    tampered = sum(1 for s in scans if s.get("ai_indicator") == "TAMPERED")
                    context_lines.append(f"\n--- OTARUCHAIN WORK HISTORY (30 terakhir) ---")
                    context_lines.append(f"Total Dokumen: {total}")
                    context_lines.append(f"Verified: {verified} | Tampered: {tampered}")
                    context_lines.append(f"Consistency Rate: {verified/total*100:.0f}%")
            except Exception:
                pass

            # 4. Gamification Badges
            try:
                badge_res = sb.table("gamification_badges").select(
                    "badge_type,month_year,unlocked_at"
                ).eq("user_id", user_id).order("unlocked_at", desc=True).limit(5).execute()
                badges = getattr(badge_res, "data", None) or []
                if badges:
                    context_lines.append(f"\n--- GAMIFICATION ---")
                    for b in badges:
                        context_lines.append(f"ðŸ… {b['badge_type']} ({b['month_year']})")
                    has_gold = any(b['badge_type'] == 'gold' for b in badges)
                    if has_gold:
                        context_lines.append("âœ¨ Aktif mendapat 0.5% diskon bunga + Rp 1jt bonus plafon")
            except Exception:
                pass

            # 5. Family Sharing Status
            try:
                fam_res = sb.table("family_sharing").select(
                    "id,role,status"
                ).eq("user_id", user_id).eq("status", "active").execute()
                fam = getattr(fam_res, "data", None) or []
                if fam:
                    context_lines.append(f"\n--- FAMILY SHARING ---")
                    context_lines.append(f"Family Members Connected: {len(fam)}")
            except Exception:
                pass

            # 6. Active Loans
            try:
                loans_res = sb.table("loan_requests").select(
                    "nominal_pengajuan,status,created_at,ai_indicator"
                ).eq("user_id", user_id).in_("status", ["PENDING", "APPROVED"]).limit(5).execute()
                loans = getattr(loans_res, "data", None) or []
                if loans:
                    context_lines.append(f"\n--- PINJAMAN AKTIF ---")
                    context_lines.append(f"Jumlah: {len(loans)} transaksi")
                    for ln in loans:
                        context_lines.append(
                            f"  - Rp {int(ln.get('nominal_pengajuan') or 0):,} [{ln.get('status')}] ({ln.get('ai_indicator', 'N/A')})"
                        )
            except Exception:
                pass
    except Exception:
        pass

    user_context = "\n".join(context_lines) if context_lines else "Data profil tidak tersedia."
    
    # â”€â”€ Redis Cache: user_id + hash(financial_data) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    import json as _json
    q_hash = hashlib.md5(q.encode()).hexdigest()[:10]
    ctx_hash = hashlib.md5(user_context.encode()).hexdigest()[:12]
    cache_key = f"otaru_ai:{user_id}:{q_hash}"
    
    try:
        cached_raw = RedisClient.get_cache(cache_key)
        if cached_raw and isinstance(cached_raw, dict):
            if cached_raw.get("ctx_hash") == ctx_hash:
                return cached_raw.get("answer", "")
    except Exception:
        pass

    # â”€â”€ System Prompt (Gemini 2.0 Flash optimized) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    system_prompt = (
        "Kamu adalah OTARU, Financial Consultant Expert untuk OtaruChain & Otaru Financial.\n\n"
        "ATURAN KETAT:\n"
        "â€¢ Proaktif dan blak-blakan. SELALU berikan saran spesifik berdasarkan DATA user di bawah.\n"
        "â€¢ Data-driven: gunakan angka real dari profil, bukan nasihat generik.\n"
        "â€¢ Actionable: berikan langkah konkret yang bisa dilakukan HARI INI.\n"
        "â€¢ Jujur: jangan sugarcoat kondisi finansial yang buruk.\n\n"
        "DATA USER (RAHASIA, hanya untuk konteks):\n"
        f"{user_context}\n\n"
        "TUGAS:\n"
        "1. Jawab pertanyaan user secara SINGKAT, PADAT, dan TO-THE-POINT.\n"
        "2. Jika ada DSR >30%, PERINGATKAN dengan tegas.\n"
        "3. Jika ada Tampered Attempts >0, JELASKAN dampaknya.\n"
        "4. Berikan budget harian berdasarkan gaji - cicilan.\n\n"
        "FORMAT (DILARANG DILANGGAR):\n"
        "â€¢ DILARANG menggunakan asterisk (*), bold (**), heading (#), atau format markdown.\n"
        "â€¢ Gunakan HANYA simbol bullet \u2022 untuk daftar.\n"
        "â€¢ Jawaban MAKSIMAL 3-4 kalimat pendek.\n\n"
        "WAJIB: Setiap jawaban HARUS diakhiri dengan 1 pertanyaan lanjutan yang kontekstual "
        "dan engaging untuk menjaga percakapan. Contoh: "
        "'Apakah ada cicilan lain yang belum kamu laporkan ke sistem?'"
    )

    # â”€â”€ Try Gemini 2.0 Flash first â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    gemini_api_key = settings.GEMINI_API_KEY or ""
    if gemini_api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_api_key)
            model = genai.GenerativeModel("gemini-2.0-flash")

            response = model.generate_content(
                [
                    {"role": "user", "parts": [{"text": system_prompt}]},
                    {"role": "model", "parts": [{"text": "Dipahami. Saya siap menjawab berdasarkan data user secara singkat, blak-blakan, dan tanpa markdown. Setiap jawaban akan diakhiri pertanyaan lanjutan."}]},
                    {"role": "user", "parts": [{"text": q}]},
                ],
                generation_config={
                    "temperature": 0.3,
                    "max_output_tokens": 200,
                },
            )

            content = (response.text or "").strip()
            # Strict formatting cleanup
            clean = content.replace("**", "").replace("*", "").replace("# ", "").replace("## ", "")
            
            if clean:
                # Cache the response
                try:
                    RedisClient.set_cache(cache_key, {"answer": clean, "ctx_hash": ctx_hash}, ttl=3600)
                except Exception:
                    pass
                return clean
        except Exception as e:
            print(f"[Otaru AI] Gemini 2.0 Flash error, falling back to OpenAI: {e}")

    # â”€â”€ Fallback: OpenAI proxy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    api_key = getattr(settings, "OPENAI_API_KEY", "") or ""
    if not api_key:
        return "Otaru sedang offline untuk konsultasi saat ini. Coba lagi sebentar."

    base_url = getattr(settings, "OPENAI_BASE_URL", "https://ai.sumopod.com/v1")
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    try:
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": q},
            ],
            temperature=0.3,
            max_tokens=200,
        )
        content = (resp.choices[0].message.content or "").strip()
        clean_content = content.replace("**", "").replace("*", "").replace("# ", "").replace("## ", "")
        
        # Cache the response
        try:
            RedisClient.set_cache(cache_key, {"answer": clean_content, "ctx_hash": ctx_hash}, ttl=3600)
        except Exception:
            pass
            
        return clean_content or "Otaru tidak dapat menghasilkan jawaban saat ini. Coba ulangi pertanyaannya."
    except Exception:
        return "Otaru lagi gangguan sesaat. Coba kirim ulang pertanyaan dalam beberapa detik."



async def answer_freeform_question(
    question: str,
    *,
    max_input_words: int = 120,
    max_output_words: int = 90,
) -> str:
    """Answer random Telegram questions with concise Otaru persona (no credit deduction)."""
    q = (question or "").strip()
    if not q:
        return "Tulis pertanyaannya dulu, nanti Otaru jawab singkat dan jelas."

    words = q.split()
    if len(words) > max_input_words:
        return (
            f"Pertanyaannya kepanjangan. Maksimal {max_input_words} kata. "
            "Ringkas dulu ya, biar Otaru jawab cepat dan tepat."
        )

    api_key = getattr(settings, "OPENAI_API_KEY", "") or ""
    if not api_key:
        return "Otaru sedang offline untuk Q&A saat ini. Coba lagi sebentar lagi."

    base_url = getattr(settings, "OPENAI_BASE_URL", "https://ai.sumopod.com/v1")
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    system_prompt = (
        "Kamu adalah Otaru, asisten Telegram OtaruChain. "
        "Karakter: to-the-point, praktis, profesional, tidak bertele-tele. "
        "Jawab dalam Bahasa Indonesia. "
        f"Batas jawaban MAKSIMAL {max_output_words} kata. "
        "Fokus langsung ke inti jawaban dan langkah aksi singkat bila perlu."
    )

    try:
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": q},
            ],
            temperature=0.3,
            max_tokens=240,
        )
        content = (resp.choices[0].message.content or "").strip()
        out_words = content.split()
        if len(out_words) > max_output_words:
            content = " ".join(out_words[:max_output_words]).rstrip(".,;: ") + "..."
        return content or "Belum ada jawaban yang valid. Coba ulangi pertanyaannya secara lebih spesifik."
    except Exception:
        return "Otaru lagi gangguan sesaat. Coba kirim ulang pertanyaan dalam beberapa detik."


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



