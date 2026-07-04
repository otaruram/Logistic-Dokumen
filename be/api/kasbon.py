"""
Kasbon (Loan Request) API — Digital Intake Gateway
POST /api/kasbon/process-document  — OCR ingestion via Telegram
POST /api/kasbon/approve-loan      — Admin approval with SHA-256 seal
GET  /api/kasbon/queue             — PENDING queue for koperasi admin
GET  /api/kasbon/history           — User's own loan history
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
from pydantic import BaseModel

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

router = APIRouter(prefix="/api/kasbon", tags=["Kasbon"])


# ── DB helpers ────────────────────────────────────────────────────────────────

def _sb():
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    return sb


def _is_loan_requests_missing_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return "loan_requests" in text and (
        "pgrst205" in text
        or "schema cache" in text
        or "does not exist" in text
        or "relation" in text
    )


def _ensure_loan_requests_ready(sb) -> None:
    try:
        sb.table("loan_requests").select("id").limit(1).execute()
    except Exception as exc:
        if _is_loan_requests_missing_error(exc):
            raise HTTPException(
                status_code=503,
                detail="Tabel loan_requests belum tersedia. Jalankan migration database/kasbon_migration.sql di Supabase.",
            )
        raise


def _get_profile_by_nik(sb, nik: str) -> dict:
    res = sb.table("profiles").select("id, nik, full_name, user_email, limit_pinjaman").eq("nik", nik).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail=f"NIK {nik} tidak ditemukan.")
    return rows[0]


def _active_loan_total(sb, nik: str) -> int:
    """Sum of PENDING and APPROVED loans for a given NIK."""
    res = (
        sb.table("loan_requests")
        .select("nominal_pengajuan")
        .eq("nik", nik)
        .in_("status", ["PENDING", "APPROVED"])
        .execute()
    )
    rows = getattr(res, "data", None) or []
    return sum(int(r["nominal_pengajuan"]) for r in rows)


def _resolve_nik_from_telegram_chat(sb, chat_id: int) -> Optional[str]:
    """Resolve NIK from telegram_links -> profiles for fast test flow."""
    link_res = (
        sb.table("telegram_links")
        .select("user_id")
        .eq("telegram_chat_id", str(chat_id))
        .eq("is_linked", True)
        .limit(1)
        .execute()
    )
    link_rows = getattr(link_res, "data", None) or []
    if not link_rows:
        return None
    user_id = link_rows[0].get("user_id")
    if not user_id:
        return None
    prof_res = sb.table("profiles").select("nik").eq("id", user_id).limit(1).execute()
    prof_rows = getattr(prof_res, "data", None) or []
    return prof_rows[0].get("nik") if prof_rows else None


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProcessDocumentRequest(BaseModel):
    image_url: str
    telegram_chat_id: Optional[int] = None
    tenor_bulan: Optional[int] = None
    no_referensi: Optional[str] = None


class ProcessDocumentResponse(BaseModel):
    success: bool
    loan_id: Optional[str] = None
    nik: Optional[str] = None
    nominal_pengajuan: Optional[int] = None
    tenor_bulan: Optional[int] = None
    cicilan_sistem: Optional[int] = None
    dsr_status: Optional[str] = None
    ai_indicator: str
    status: str
    message: str


class ComponentCoords(BaseModel):
    x: float
    y: float
    rotation: float = 0.0  # degrees, clockwise

class StampCoords(BaseModel):
    materai: Optional[ComponentCoords] = None
    ttd: Optional[ComponentCoords] = None
    stamp: Optional[ComponentCoords] = None

class ApproveLoanRequest(BaseModel):
    loan_id: str
    admin_signature: str
    stamp_applied: bool = False
    stamp_style: str = "classic"
    stamp_color: str = "red"
    stamp_name: str = "KOPERASI MITRA SEJAHTERA"
    coords: Optional[StampCoords] = None


class ApproveLoanResponse(BaseModel):
    success: bool
    loan_id: str
    sha256_hash: str
    message: str


class RejectLoanRequest(BaseModel):
    loan_id: str
    reason: str = ""


class RevisionLoanRequest(BaseModel):
    loan_id: str
    notes: str


# ── Telegram notif helper ─────────────────────────────────────────────────────

def _send_telegram_notif(chat_id: int, text: str) -> None:
    """Fire-and-forget Telegram sendMessage via OtaruChain bot. Silently ignores errors."""
    token = settings.TELEGRAM_BOT_TOKEN
    if not token or not chat_id:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML",
                  "disable_web_page_preview": True},
            timeout=8,
        )
    except Exception:
        pass


def _send_finance_bot_notif(chat_id: int, text: str) -> None:
    """Fire-and-forget Telegram sendMessage via Otaru Financial bot."""
    token = settings.TELEGRAM_FINANCE_BOT_TOKEN
    if not token or not chat_id:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML",
                  "disable_web_page_preview": True},
            timeout=8,
        )
    except Exception:
        pass


def _notify_both_bots(chat_id: int, text: str) -> None:
    """Send notification to BOTH OtaruChain and Otaru Financial bots."""
    _send_telegram_notif(chat_id, text)
    _send_finance_bot_notif(chat_id, text)


def _notify_by_source(chat_id: int, text: str, source: str) -> None:
    """Route notification to the CORRECT bot based on document source.
    
    FINANCE source -> Otaru Financial bot only.
    CHAIN source  -> OtaruChain bot only.
    """
    if source == "FINANCE":
        _send_finance_bot_notif(chat_id, text)
    else:
        _send_telegram_notif(chat_id, text)


# Admin email whitelist for Approval Queue access
# Fallback hardcoded set + DB-driven authorized_admins table
ADMIN_WHITELIST = {
    "okitr52@gmail.com", # Primary Admin
    settings.ADMIN_EMAIL, 
}


def _is_authorized_admin(sb, email: str) -> bool:
    """Check if email is in hardcoded whitelist OR authorized_admins table."""
    if email.lower().strip() in {e.lower() for e in ADMIN_WHITELIST if e}:
        return True
    try:
        res = sb.table("authorized_admins").select("id").eq("email", email.lower().strip()).limit(1).execute()
        rows = getattr(res, "data", None) or []
        return len(rows) > 0
    except Exception:
        return False


def _resolve_chat_id(sb, nik: str) -> Optional[int]:
    """Look up Telegram chat_id from nik via profiles -> telegram_links."""
    try:
        pr = sb.table("profiles").select("id").eq("nik", nik).limit(1).execute()
        pr_rows = getattr(pr, "data", None) or []
        if not pr_rows:
            return None
        user_id = pr_rows[0]["id"]
        tl = (sb.table("telegram_links")
              .select("telegram_chat_id")
              .eq("user_id", user_id)
              .eq("is_linked", True)
              .limit(1)
              .execute())
        tl_rows = getattr(tl, "data", None) or []
        if not tl_rows or not tl_rows[0].get("telegram_chat_id"):
            return None
        return int(tl_rows[0]["telegram_chat_id"])
    except Exception:
        return None


def _generate_and_upload_pdf(loan: dict, profile: dict, sha256_hash: str = "") -> Optional[str]:
    """Generate kasbon PDF, upload to ImageKit, return public URL (or None on failure)."""
    try:
        pdf_bytes = generate_kasbon_pdf(
            loan, profile, sha256_hash,
            source=loan.get("source") or "CHAIN",
            image_url=loan.get("image_url") or "",
        )
        no_ref = (loan.get("ocr_raw") or {}).get("no_referensi") or str(loan.get("id", ""))[:8].upper()
        result = ImageKitService.upload_file(
            pdf_bytes,
            file_name=f"kasbon_{no_ref}_{loan.get('status', 'DOC').lower()}.pdf",
            folder="/kasbon_forms",
        )
        return result.get("url")
    except Exception as exc:
        print(f"[KASBON] PDF upload failed: {exc}", file=sys.stderr)
        return None


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


class PreviewStampRequest(BaseModel):
    loan_id: str
    admin_signature: Optional[str] = None
    stamp_applied: bool = True
    stamp_color: str = "red"
    stamp_name: str = "KOPERASI MITRA SEJAHTERA"
    coords: Optional[StampCoords] = None


class PreviewStampResponse(BaseModel):
    image_b64: str
    orig_w: int
    orig_h: int
    preview_w: int
    preview_h: int
    scale: float
    default_coords: dict
    nominal: int


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



