"""
Kasbon (Loan Request) API — Digital Intake Gateway
POST /api/kasbon/process-document  — OCR ingestion via Telegram
POST /api/kasbon/approve-loan      — Admin approval with SHA-256 seal
GET  /api/kasbon/queue             — PENDING queue for koperasi admin
GET  /api/kasbon/history           — User's own loan history
POST /api/kasbon/ai-recommendation — Gemini Vision comprehensive analysis
"""
from __future__ import annotations

import hashlib
from html import escape
import os
import sys
import tempfile
from datetime import datetime, timezone
from typing import Optional

import requests

from fastapi import APIRouter, Depends, HTTPException, Query

from schemas.kasbon import (
    ProcessDocumentRequest,
    ProcessDocumentResponse,
    ComponentCoords,
    StampCoords,
    ApproveLoanRequest,
    ApproveLoanResponse,
    RejectLoanRequest,
    RevisionLoanRequest,
    PreviewStampRequest,
    PreviewStampResponse,
    AiRecommendationRequest
)

from config.settings import settings
from services.scan_helpers import get_supabase_admin
from services.ocr_service import OCRService
from services.pdf_service import generate_kasbon_pdf
from services.imagekit_service import ImageKitService
from services.kasbon_sop import (
    DSR_LIMIT,
    detect_tampering_sop,
    extract_cicilan_from_ocr,
    extract_nik_and_nominal,
    extract_tenor,
    update_credit_score,
)

from utils.auth import get_supabase_bearer_user
from services.kasbon_service import (
    kasbon_process_document,
    kasbon_approve_loan,
    kasbon_reject_loan,
    kasbon_need_revision,
)
from services.kasbon_helpers import (
    _sb,
    _is_loan_requests_missing_error,
    _ensure_loan_requests_ready,
    _get_profile_by_nik,
    _active_loan_total,
    _resolve_nik_from_telegram_chat,
    _send_telegram_notif,
    _send_finance_bot_notif,
    _notify_both_bots,
    _notify_by_source,
    _is_authorized_admin,
    _resolve_chat_id,
    _generate_and_upload_pdf,
    _build_ai_context,
)

router = APIRouter(prefix="/api/kasbon", tags=["Kasbon"])




# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/process-document", response_model=ProcessDocumentResponse)
async def process_document(body: ProcessDocumentRequest):
    """
    Receive image URL (from Telegram bot / any source).
    1. Run OCR to extract NIK & Nominal.
    2. Validate limit.
    3. Validate SOP DSR + Flat Interest.
    4. Insert loan_request with PENDING status.
    """
    sb = _sb()
    _ensure_loan_requests_ready(sb)

    res = await kasbon_process_document(
        sb=sb,
        image_url=body.image_url,
        telegram_chat_id=body.telegram_chat_id,
        tenor_bulan=body.tenor_bulan,
        no_referensi=body.no_referensi
    )

    if not res.get("success"):
        # We handle failures but keep the return type ProcessDocumentResponse
        pass

    return ProcessDocumentResponse(**res)




@router.post("/preview-stamp", response_model=PreviewStampResponse)
async def preview_stamp(
    body: PreviewStampRequest,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """
    Return a base64-encoded preview JPEG of the document with stamp overlay.
    Used by the drag-and-drop UI so admins can adjust positions before final approval.
    """
    sb = _sb()
    user_email = (current_user.get("email") or "").lower().strip()

    loan_res = sb.table("loan_requests").select("image_url, nominal_pengajuan").eq("id", body.loan_id).limit(1).execute()
    loan_rows = getattr(loan_res, "data", None) or []
    if not loan_rows:
        raise HTTPException(status_code=404, detail="loan_not_found")

    loan = loan_rows[0]
    image_url = loan.get("image_url") or ""
    nominal = int(loan.get("nominal_pengajuan") or 0)

    if not image_url:
        raise HTTPException(status_code=400, detail="no_image_url")

    from services.stamp_service import stamp_preview_image
    result = stamp_preview_image(
        original_image_url=image_url,
        admin_signature_b64=body.admin_signature,
        stamp_applied=body.stamp_applied,
        nominal=nominal,
        coords=body.coords.dict() if body.coords else None,
        stamp_color=body.stamp_color,
        stamp_name=body.stamp_name,
    )
    if result is None:
        raise HTTPException(status_code=502, detail="failed_to_load_original_image")

    return PreviewStampResponse(
        image_b64=result["image_b64"],
        orig_w=result["orig_w"],
        orig_h=result["orig_h"],
        preview_w=result["preview_w"],
        preview_h=result["preview_h"],
        scale=result["scale"],
        default_coords=result["default_coords"],
        nominal=nominal,
    )


@router.post("/approve-loan", response_model=ApproveLoanResponse)
async def approve_loan(
    body: ApproveLoanRequest,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """
    Called by Web Partner (koperasi admin) after digital signature.
    Generates SHA-256 seal and marks the loan APPROVED.
    """
    sb = _sb()
    _ensure_loan_requests_ready(sb)

    res = await kasbon_approve_loan(
        sb=sb,
        current_user=current_user,
        loan_id=body.loan_id,
        admin_signature=body.admin_signature,
        stamp_applied=body.stamp_applied,
        stamp_style=body.stamp_style,
        stamp_color=body.stamp_color,
        stamp_name=body.stamp_name,
        coords=body.coords.dict() if body.coords else None
    )

    return ApproveLoanResponse(**res)


@router.get("/queue")
async def get_approval_queue(current_user: dict = Depends(get_supabase_bearer_user)):
    """Return PENDING loan_requests for koperasi admin — enriched with user limit info.
    
    Access restricted to ADMIN_WHITELIST emails only.
    """
    # ── Access Control: Open to all logged in users ──
    user_email = (current_user.get("email") or "").lower().strip()
    sb = _sb()

    _ensure_loan_requests_ready(sb)

    res = (
        sb.table("loan_requests")
        .select("id, nik, nominal_pengajuan, image_url, ai_indicator, submitted_at, status, ocr_raw, source, doc_type, ai_fraud_status, ai_fraud_reason")
        .eq("status", "PENDING")
        .order("submitted_at", desc=False)
        .execute()
    )
    rows = getattr(res, "data", None) or []

    nik_list = list({r.get("nik") for r in rows if r.get("nik")})
    profile_map: dict[str, dict] = {}
    approved_totals: dict[str, int] = {}
    pending_totals: dict[str, int] = {}
    if nik_list:
        prof_res = (
            sb.table("profiles")
            .select("id, nik, full_name, limit_pinjaman, credits, created_at")
            .in_("nik", nik_list)
            .execute()
        )
        prof_rows = getattr(prof_res, "data", None) or []
        profile_map = {p.get("nik"): p for p in prof_rows if p.get("nik")}

        active_res = (
            sb.table("loan_requests")
            .select("nik, nominal_pengajuan, status")
            .in_("nik", nik_list)
            .in_("status", ["PENDING", "APPROVED"])
            .execute()
        )
        active_rows = getattr(active_res, "data", None) or []
        for a in active_rows:
            n = a.get("nik")
            if not n:
                continue
            nominal = int(a.get("nominal_pengajuan") or 0)
            st = str(a.get("status") or "").upper()
            if st == "APPROVED":
                approved_totals[n] = approved_totals.get(n, 0) + nominal
            elif st == "PENDING":
                pending_totals[n] = pending_totals.get(n, 0) + nominal

        # Gamification badges for the current month
        user_ids = [p.get("id") for p in prof_rows if p.get("id")]
        badges_map: dict[str, list[str]] = {}
        if user_ids:
            from datetime import datetime, timezone
            current_month = datetime.now(timezone.utc).strftime("%Y-%m")
            b_res = (
                sb.table("gamification_badges")
                .select("user_id, badge_type")
                .in_("user_id", user_ids)
                .eq("month_year", current_month)
                .execute()
            )
            b_rows = getattr(b_res, "data", None) or []
            for b in b_rows:
                uid = b.get("user_id")
                if uid not in badges_map:
                    badges_map[uid] = []
                badges_map[uid].append(b.get("badge_type"))

    result = []
    for r in rows:
        nik = r.get("nik")
        prof = profile_map.get(nik, {})
        limit_pinjaman = int(prof.get("limit_pinjaman") or 0)
        kasbon_aktif_total = int(approved_totals.get(nik, 0))
        kasbon_pending_total = int(pending_totals.get(nik, 0))
        ocr_raw = r.get("ocr_raw") or {}

        # Determine badge tier
        _prof_id = prof.get("id")
        badges = badges_map.get(str(_prof_id), []) if _prof_id is not None else []
        badge_tier = None
        if "platinum_integrity" in badges:
            badge_tier = "PLATINUM"
        elif "gold_integrity" in badges:
            badge_tier = "GOLD"
        elif "silver_integrity" in badges:
            badge_tier = "SILVER"

        # Compute confidence percentage from ai_indicator + ai_fraud_status
        ai_ind = r.get("ai_indicator", "PROCESSING")
        fraud_st = r.get("ai_fraud_status")
        if ai_ind == "VERIFIED":
            if fraud_st == "TRUSTED":
                confidence_pct = 95
            elif fraud_st == "NEEDS_REVIEW":
                confidence_pct = 65
            elif fraud_st == "FRAUD":
                confidence_pct = 20
            else:
                confidence_pct = 85
        elif ai_ind == "TAMPERED":
            confidence_pct = 15
        else:  # PROCESSING
            confidence_pct = 50

        result.append({
            **{k: v for k, v in r.items() if k != "ocr_raw"},
            "nama_lengkap": ocr_raw.get("recipient_name") or prof.get("full_name") or "-",
            "limit_pinjaman": limit_pinjaman,
            "kasbon_aktif": kasbon_aktif_total,
            "kasbon_pending": kasbon_pending_total,
            "sisa_limit": max(0, limit_pinjaman - kasbon_aktif_total),
            "sisa_kredit": int(prof.get("credits") or 0),
            "member_since": prof.get("created_at"),
            "tenor_bulan": ocr_raw.get("tenor_bulan"),
            "cicilan_sistem": ocr_raw.get("cicilan_sistem"),
            "dsr_status": ocr_raw.get("dsr_status", "AMAN"),
            "no_referensi": ocr_raw.get("no_referensi") or r.get("id", "")[:8].upper(),
            "source": r.get("source") or "CHAIN",
            "doc_type": r.get("doc_type") or ocr_raw.get("doc_type") or "receipt",
            "badge_tier": badge_tier,
            "ai_fraud_status": r.get("ai_fraud_status"),
            "ai_fraud_reason": r.get("ai_fraud_reason"),
            "confidence_pct": confidence_pct,
        })

    return {"queue": result, "total": len(result)}


@router.post("/reject-loan")
async def reject_loan(
    body: RejectLoanRequest,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """Called by koperasi admin to reject a pending loan request."""
    sb = _sb()
    _ensure_loan_requests_ready(sb)

    res = await kasbon_reject_loan(
        sb=sb,
        current_user=current_user,
        loan_id=body.loan_id,
        reason=body.reason or ""
    )
    return res


@router.post("/need-revision")
async def need_revision(
    body: RevisionLoanRequest,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """Ask the applicant to revise their submission. Sends Telegram notification."""
    try:
        sb = _sb()
        _ensure_loan_requests_ready(sb)

        res = await kasbon_need_revision(
            sb=sb,
            current_user=current_user,
            loan_id=body.loan_id,
            notes=body.notes
        )
        return res
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[need-revision FATAL] {exc}")
        raise HTTPException(status_code=500, detail=f"Revision error: {str(exc)[:100]}")


@router.get("/history")
async def get_loan_history(current_user: dict = Depends(get_supabase_bearer_user)):
    """Return last 10 loan_requests for the authenticated user (by their NIK)."""
    sb = _sb()
    _ensure_loan_requests_ready(sb)
    user_id = str(current_user["id"])

    prof = sb.table("profiles").select("nik").eq("id", user_id).limit(1).execute()
    prof_rows = getattr(prof, "data", None) or []
    if not prof_rows or not prof_rows[0].get("nik"):
        return {"history": []}

    nik = prof_rows[0]["nik"]
    res = (
        sb.table("loan_requests")
        .select("id, nominal_pengajuan, status, ai_indicator, sha256_hash, submitted_at, reviewed_at")
        .eq("nik", nik)
        .order("submitted_at", desc=True)
        .limit(10)
        .execute()
    )
    return {"history": getattr(res, "data", None) or []}


@router.get("/audit-trail")
async def get_audit_trail(
    scope: str = Query(None),
    current_user: dict = Depends(get_supabase_bearer_user)
):
    """Return all loan_requests (Audit Trail) enriched with profile info.
    
    Open to all logged-in users.
    """
    sb = _sb()
    user_id = str(current_user["id"])
        
    _ensure_loan_requests_ready(sb)
    
    prof = sb.table("profiles").select("nik").eq("id", user_id).limit(1).execute()
    prof_rows = getattr(prof, "data", None) or []
    user_nik = prof_rows[0].get("nik") if prof_rows else None
    
    if scope != "all" and not user_nik:
        return {"history": []}
    
    query = (
        sb.table("loan_requests")
        .select("id, nik, nominal_pengajuan, image_url, ai_indicator, sha256_hash, submitted_at, status")
    )
    
    if scope != "all":
        query = query.eq("nik", user_nik)
        
    res = query.order("submitted_at", desc=True).limit(100).execute()
    rows = getattr(res, "data", None) or []
    
    nik_list = list({r.get("nik") for r in rows if r.get("nik")})
    profile_map = {}
    if nik_list:
        prof_res = sb.table("profiles").select("nik, full_name, phone_number").in_("nik", nik_list).execute()
        prof_rows = getattr(prof_res, "data", None) or []
        profile_map = {p.get("nik"): p for p in prof_rows if p.get("nik")}
        
    transactions = []
    for r in rows:
        nik = r.get("nik")
        prof = profile_map.get(nik, {})
        
        # Mapping final status just like UI for consistency
        final_status = r.get("status")
        ai_indicator = r.get("ai_indicator")
        if ai_indicator == "TAMPERED" or final_status == "REJECTED":
            final_status = "REJECTED"
        elif ai_indicator == "UNCLEAR_BLURRY" or final_status == "NEED_REVISION":
            final_status = "REVISION"
        
        transactions.append({
            "id": r.get("id"),
            "date": r.get("submitted_at"),
            "workerName": prof.get("full_name") or nik or "Unknown Worker",
            "phone": prof.get("phone_number") or "-",
            "nominal": int(r.get("nominal_pengajuan") or 0),
            "status": final_status,
            "fileUrl": r.get("image_url") or "",
            "hash": r.get("sha256_hash") or "Menunggu verifikasi..."
        })
        
    return {"transactions": transactions}



# ── AI Recommendation — Gemini Vision Comprehensive Analysis ──────────────────

import json as _json
import re as _re
from functools import lru_cache

# In-memory cache for AI recommendations (keyed by loan_id)
_ai_rec_cache: dict[str, dict] = {}






AI_REC_SYSTEM_PROMPT = (
    "Kamu adalah analis kredit senior untuk lembaga keuangan Indonesia (koperasi). "
    "Tugas kamu: menganalisis dokumen pengajuan kasbon (foto struk/invoice/slip gaji) "
    "DAN konteks keuangan pemohon, lalu memberikan rekomendasi kepada admin.\n\n"
    "ANALISIS YANG HARUS DILAKUKAN:\n"
    "1. Analisis FOTO DOKUMEN: Periksa keaslian, tanda manipulasi, kualitas cetak, "
    "   konsistensi font, format tanggal, cap/tanda tangan, dan tanda-tanda pemalsuan.\n"
    "2. Analisis KEUANGAN: Periksa apakah nominal pengajuan wajar terhadap limit, "
    "   sisa kuota, DSR status, riwayat kredit, dan badge tier pemohon.\n"
    "3. Analisis RISIKO: Gabungkan temuan dari foto + keuangan untuk penilaian risiko.\n\n"
    "ATURAN PENTING:\n"
    "- Jika nominal pengajuan > sisa kuota validasi = risiko TINGGI\n"
    "- Jika DSR status = OVER = risiko TINGGI\n"
    "- Jika AI Fraud Status = FRAUD = risiko KRITIS\n"
    "- Jika badge tier PLATINUM + dokumen bersih = risiko RENDAH\n\n"
    "Berikan respons HANYA dalam format JSON tanpa markdown:\n"
    '{"verdict": "APPROVE" | "REJECT" | "REVISI", '
    '"risk": "RENDAH" | "SEDANG" | "TINGGI" | "KRITIS", '
    '"confidence_pct": <integer 0-100, seberapa yakin kamu dengan rekomendasi ini>, '
    '"text": "Penjelasan detail dalam Bahasa Indonesia, mencakup temuan dari foto DAN analisis keuangan. '
    'Sebutkan poin-poin penting yang ditemukan."}'
)

_VALID_VERDICTS = {"APPROVE", "REJECT", "REVISI"}
_VALID_RISKS = {"RENDAH", "SEDANG", "TINGGI", "KRITIS"}


@router.post("/ai-recommendation")
async def ai_recommendation(
    body: AiRecommendationRequest,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """Gemini 2.5 Flash Vision — comprehensive document + financial analysis.

    Analyses the uploaded document image AND all contextual financial data
    to produce an actionable recommendation for the admin.
    """
    # Check cache first
    if body.loan_id in _ai_rec_cache:
        cached = _ai_rec_cache[body.loan_id]
        return {"success": True, "recommendation": cached, "cached": True}

    sb = _sb()
    _ensure_loan_requests_ready(sb)

    # Fetch full loan record
    loan_res = (
        sb.table("loan_requests")
        .select("id, nik, nominal_pengajuan, image_url, ai_indicator, submitted_at, status, ocr_raw, source, doc_type, ai_fraud_status, ai_fraud_reason")
        .eq("id", body.loan_id)
        .limit(1)
        .execute()
    )
    loan_rows = getattr(loan_res, "data", None) or []
    if not loan_rows:
        raise HTTPException(status_code=404, detail="Loan not found")

    loan_raw = loan_rows[0]
    nik = loan_raw.get("nik", "")
    ocr_raw = loan_raw.get("ocr_raw") or {}

    # Fetch profile
    profile = {}
    if nik:
        prof_res = sb.table("profiles").select("id, nik, full_name, limit_pinjaman, credits, created_at").eq("nik", nik).limit(1).execute()
        prof_rows = getattr(prof_res, "data", None) or []
        if prof_rows:
            profile = prof_rows[0]

    # Calculate active/pending totals
    approved_total = 0
    pending_total = 0
    if nik:
        active_res = (
            sb.table("loan_requests")
            .select("nominal_pengajuan, status")
            .eq("nik", nik)
            .in_("status", ["PENDING", "APPROVED"])
            .execute()
        )
        active_rows = getattr(active_res, "data", None) or []
        for a in active_rows:
            nominal = int(a.get("nominal_pengajuan") or 0)
            st = str(a.get("status") or "").upper()
            if st == "APPROVED":
                approved_total += nominal
            elif st == "PENDING":
                pending_total += nominal

    # Determine badge tier
    badge_tier = None
    _prof_id = profile.get("id")
    if _prof_id:
        from datetime import datetime, timezone
        current_month = datetime.now(timezone.utc).strftime("%Y-%m")
        try:
            b_res = (
                sb.table("gamification_badges")
                .select("badge_type")
                .eq("user_id", str(_prof_id))
                .eq("month_year", current_month)
                .execute()
            )
            b_rows = getattr(b_res, "data", None) or []
            badge_types = [b.get("badge_type") for b in b_rows]
            if "platinum_integrity" in badge_types:
                badge_tier = "PLATINUM"
            elif "gold_integrity" in badge_types:
                badge_tier = "GOLD"
            elif "silver_integrity" in badge_types:
                badge_tier = "SILVER"
        except Exception:
            pass

    # Build enriched loan context
    enriched_loan = {
        **loan_raw,
        "nama_lengkap": ocr_raw.get("recipient_name") or profile.get("full_name") or "-",
        "no_referensi": ocr_raw.get("no_referensi") or loan_raw.get("id", "")[:8].upper(),
        "dsr_status": ocr_raw.get("dsr_status", "AMAN"),
        "tenor_bulan": ocr_raw.get("tenor_bulan"),
        "cicilan_sistem": ocr_raw.get("cicilan_sistem"),
        "badge_tier": badge_tier,
    }

    context_text = _build_ai_context(enriched_loan, profile, approved_total, pending_total)
    image_url = loan_raw.get("image_url") or ""

    # Call AI via OpenAI proxy
    try:
        import openai

        _GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
        _GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "")
        _GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

        if not _GEMINI_API_KEY:
            raise HTTPException(status_code=503, detail="GEMINI_API_KEY tidak dikonfigurasi.")

        client = openai.OpenAI(
            api_key=_GEMINI_API_KEY,
            base_url=_GEMINI_BASE_URL if _GEMINI_BASE_URL else None
        )

        messages = [
            {"role": "system", "content": AI_REC_SYSTEM_PROMPT},
            {"role": "user", "content": []}
        ]

        img_included = False
        if image_url:
            messages[1]["content"].append({
                "type": "image_url",
                "image_url": {"url": image_url}
            })
            img_included = True
        else:
            messages[1]["content"].append({
                "type": "text",
                "text": "\n[CATATAN: Foto dokumen tidak dapat dimuat. Analisis hanya berdasarkan konteks keuangan.]\n"
            })

        messages[1]["content"].append({
            "type": "text",
            "text": f"\n\n{context_text}"
        })

        response = client.chat.completions.create(
            model=_GEMINI_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=800,
        )

        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        raw = _re.sub(r"^```(?:json)?\s*", "", raw)
        raw = _re.sub(r"\s*```$", "", raw)

        json_match = _re.search(r"\{.*\}", raw, _re.DOTALL)
        if not json_match:
            raise ValueError(f"No JSON in response: {raw[:200]}")

        parsed = _json.loads(json_match.group())

        verdict = str(parsed.get("verdict", "REVISI")).upper().strip()
        if verdict not in _VALID_VERDICTS:
            verdict = "REVISI"

        risk = str(parsed.get("risk", "SEDANG")).upper().strip()
        if risk not in _VALID_RISKS:
            risk = "SEDANG"

        confidence = int(parsed.get("confidence_pct", 70))
        confidence = max(0, min(100, confidence))

        text = str(parsed.get("text", "Analisis tidak tersedia."))

        recommendation = {
            "verdict": verdict,
            "risk": risk,
            "confidence_pct": confidence,
            "text": text,
            "image_analyzed": img_included,
        }

        # Cache the result
        _ai_rec_cache[body.loan_id] = recommendation

        return {"success": True, "recommendation": recommendation, "cached": False}

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[AI-Rec] Gemini error: {exc}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=502,
            detail=f"AI analysis failed: {type(exc).__name__}: {str(exc)[:150]}",
        )
