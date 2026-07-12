import sys
import requests
from typing import Optional
from fastapi import HTTPException
from config.settings import settings
from services.scan_helpers import get_supabase_admin
from services.pdf_service import generate_kasbon_pdf
from services.imagekit_service import ImageKitService

# Admin email whitelist for Approval Queue access
ADMIN_WHITELIST = {
    "okitr52@gmail.com",
    settings.ADMIN_EMAIL, 
}

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


def _build_ai_context(loan: dict, profile: dict, approved_total: int, pending_total: int) -> str:
    """Build a comprehensive financial context string for the AI."""
    limit = int(profile.get("limit_pinjaman") or 0)
    sisa_limit = max(0, limit - approved_total)
    lines = [
        f"=== KONTEKS KEUANGAN PEMOHON ===",
        f"Nama Lengkap: {loan.get('nama_lengkap', '-')}",
        f"Nominal Pengajuan: Rp {int(loan.get('nominal_pengajuan', 0)):,}",
        f"Kuota Sistem (Limit): Rp {limit:,}",
        f"Dokumen Aktif (Approved): Rp {approved_total:,}",
        f"Sisa Kuota Validasi: Rp {sisa_limit:,}",
        f"Sisa Kredit (poin): {profile.get('credits', 0)}",
        f"Reservasi Pending: Rp {pending_total:,} (ikut mengurangi sisa kuota sementara)",
        f"Sisa Kuota Setelah Pending: Rp {max(0, sisa_limit - pending_total):,}",
        f"No. Referensi: {loan.get('no_referensi', '-')}",
        f"Tanggal Bergabung: {profile.get('created_at', '-')}",
        f"DSR Status: {loan.get('dsr_status', '-')}",
        f"Sumber Dokumen: {loan.get('source', 'CHAIN')}",
        f"Jenis Dokumen: {loan.get('doc_type', 'receipt')}",
    ]

    # Badge tier
    if loan.get("badge_tier"):
        lines.append(f"Badge Tier (Gamifikasi): {loan['badge_tier']}")

    # AI Fraud pre-analysis
    if loan.get("ai_fraud_status"):
        lines.append(f"AI Fraud Status: {loan['ai_fraud_status']}")
        lines.append(f"AI Fraud Reason: {loan.get('ai_fraud_reason', '-')}")

    # AI indicator
    lines.append(f"AI Indicator (OCR): {loan.get('ai_indicator', 'PROCESSING')}")

    # Tenor & cicilan
    if loan.get("tenor_bulan"):
        lines.append(f"Tenor: {loan['tenor_bulan']} bulan")
    if loan.get("cicilan_sistem"):
        lines.append(f"Cicilan Sistem: Rp {int(loan['cicilan_sistem']):,}/bulan")

    return "\n".join(lines)
