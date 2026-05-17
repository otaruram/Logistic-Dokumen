"""
OtaruChain Partner Audit API — Comprehensive User Audit Endpoint

Endpoints:
  GET /api/partner/v1/user-audit/{email}
  GET /api/partner/v1/user-audit-by-nik/{nik}
  Header: x-api-key: sk-xxxx

Returns a comprehensive JSON containing:
- KYC Identity (name, NIK, KTP photo, selfie, address, etc.)
- Log History
- Lifetime Credit Score + Current Cycle Score
- Total Transactions (by period)
- Risk Level (Probability of Default)
- Integrity Seal Status
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from services.scan_helpers import get_supabase_admin
from services.scoring_service import get_scoring_summary, compute_and_sync_cycles
from services.risk_service import calculate_risk_level
from services.ledger_service import verify_row_integrity
from utils.api_key import validate_api_key as _validate_api_key

router = APIRouter()


def _deduct_credit_for_api_key_owner(sb, api_key_owner: str) -> None:
    """Deduct 1 credit from the API key owner's profile. Raises 402 if none left."""
    try:
        res = sb.table("api_keys").select("user_id").eq("key_value", api_key_owner).eq("is_active", True).limit(1).execute()
        rows = getattr(res, "data", None) or []
        if not rows:
            return  # key owner not found, skip silently
        owner_uid = rows[0]["user_id"]
        prof_res = sb.table("profiles").select("credits").eq("id", owner_uid).limit(1).execute()
        prof_rows = getattr(prof_res, "data", None) or []
        current = int((prof_rows[0].get("credits") or 0)) if prof_rows else 0
        if current <= 0:
            raise HTTPException(status_code=402, detail="Kredit habis. Top-up kredit untuk melanjutkan.")
        sb.table("profiles").update({"credits": current - 1}).eq("id", owner_uid).execute()
    except HTTPException:
        raise
    except Exception:
        pass  # Non-blocking credit deduction — don't break the request


def _assert_api_key_owner(target_user_id: str, api_key_owner: str, *, key_type: str = "individual") -> None:
    """Check ownership. Partner keys (key_type='partner') have read_all_users and skip this check."""
    if key_type == "partner":
        return  # Partners (Koperasi) can access any user's data
    if str(target_user_id) != str(api_key_owner):
        raise HTTPException(
            status_code=403,
            detail="API key hanya bisa mengakses data milik pemilik key",
        )


def _validate_nik(nik: str) -> str:
    clean = (nik or "").strip()
    if not clean.isdigit() or len(clean) != 16:
        raise HTTPException(status_code=422, detail="NIK harus 16 digit angka")
    return clean


# ── Response Models ───────────────────────────────────────────────────────────

class KycIdentity(BaseModel):
    """KYC identity data from profiles table — KTP-based verification."""
    full_name: Optional[str] = None
    nik: Optional[str] = None
    birth_place: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    rt_rw: Optional[str] = None
    kelurahan: Optional[str] = None
    kecamatan: Optional[str] = None
    religion: Optional[str] = None
    marital_status: Optional[str] = None
    occupation: Optional[str] = None
    nationality: Optional[str] = None
    ktp_photo_url: Optional[str] = None
    selfie_photo_url: Optional[str] = None
    kyc_verified: bool = False
    kyc_submitted_at: Optional[str] = None


class CreditScoreInfo(BaseModel):
    current_cycle: int
    current_cycle_score: int
    cycle_max: int
    lifetime_score: int
    completed_cycles: int


class FinancialCreditScore(BaseModel):
    final_score: int
    grade: str
    formula: str
    components: dict
    metrics: dict
    grade_ranges: list[dict]


class RiskInfo(BaseModel):
    risk_level: str
    risk_score: int
    factors: list[dict]


class PeriodSummary(BaseModel):
    count: int
    nominal: float


class TransactionInfo(BaseModel):
    total: int
    verified: int
    tampered: int
    processing: int
    total_nominal: float
    by_period: dict[str, PeriodSummary]


class IntegrityInfo(BaseModel):
    total_sealed: int
    verified_seals: int
    tampered_seals: int
    unsealed: int
    integrity_rate: float


class AuditLogEntry(BaseModel):
    scan_id: str
    status: str
    nominal: float
    doc_type: Optional[str] = None
    vendor_name: Optional[str] = None
    created_at: str
    integrity_status: str


class LoanHistoryEntry(BaseModel):
    id: str
    nik: str
    nominal_pengajuan: int
    image_url: Optional[str] = None
    status: str
    ai_indicator: Optional[str] = None
    sha256_hash: Optional[str] = None
    submitted_at: Optional[str] = None
    reviewed_at: Optional[str] = None
    # SOP enrichment
    tenor_bulan: Optional[int] = None
    cicilan_sistem: Optional[int] = None
    dsr_status: Optional[str] = None
    no_referensi: Optional[str] = None


class DsrHealth(BaseModel):
    cicilan_aktif_total: int
    dsr_limit: int
    dsr_pct: float  # percentage of DSR limit used
    status: str  # 'AMAN' | 'OVER'


class UserInfo(BaseModel):
    email: str
    user_id: str


class AuditResponse(BaseModel):
    user: UserInfo
    identity: Optional[KycIdentity] = None
    credit_score: CreditScoreInfo
    financial_credit_score: Optional[FinancialCreditScore] = None
    risk: RiskInfo
    transactions: TransactionInfo
    integrity: IntegrityInfo
    audit_log: list[AuditLogEntry]
    loan_history: list[LoanHistoryEntry] = []
    # SOP additions
    dsr_health: Optional[DsrHealth] = None
    fraud_flags: int = 0


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_email_to_uid(sb, email: str) -> str:
    """Resolve an email to a Supabase user_id."""
    profile_res = (
        sb.table("profiles")
        .select("id, user_email")
        .eq("user_email", email)
        .limit(1)
        .execute()
    )
    profiles = getattr(profile_res, "data", None) or []
    if profiles:
        return profiles[0]["id"]

    # Fallback: search auth.users
    try:
        page = 1
        while True:
            resp = sb.auth.admin.list_users(page=page, per_page=50)
            user_list = resp if isinstance(resp, list) else getattr(resp, "users", []) or []
            if not user_list:
                break
            for u in user_list:
                u_email = getattr(u, "email", None) or (u.get("email") if isinstance(u, dict) else None)
                u_id = getattr(u, "id", None) or (u.get("id") if isinstance(u, dict) else None)
                if u_email and u_email.lower() == email.lower() and u_id:
                    uid = str(u_id)
                    # Backfill profile
                    try:
                        sb.table("profiles").upsert(
                            {"id": uid, "user_email": u_email},
                            on_conflict="id",
                        ).execute()
                    except Exception:
                        pass
                    return uid
            if len(user_list) < 50:
                break
            page += 1
    except Exception:
        pass

    raise HTTPException(status_code=404, detail=f"User with email '{email}' not found")


def _resolve_nik_to_uid(sb, nik: str) -> tuple[str, str]:
    """Resolve a NIK to (user_id, email). Returns (uid, email)."""
    profile_res = (
        sb.table("profiles")
        .select("id, user_email, nik")
        .eq("nik", nik)
        .limit(1)
        .execute()
    )
    profiles = getattr(profile_res, "data", None) or []
    if not profiles:
        raise HTTPException(status_code=404, detail=f"User dengan NIK '{nik}' tidak ditemukan")
    return profiles[0]["id"], profiles[0].get("user_email", "")


def _get_kyc_identity(sb, user_id: str) -> Optional[KycIdentity]:
    """Fetch KYC identity data from profiles table."""
    res = (
        sb.table("profiles")
        .select(
            "full_name, nik, birth_place, birth_date, gender, address, "
            "rt_rw, kelurahan, kecamatan, religion, marital_status, "
            "occupation, nationality, ktp_photo_url, selfie_photo_url, "
            "kyc_verified, kyc_submitted_at"
        )
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows:
        return None

    p = rows[0]
    # Only return identity if KYC is verified
    if not p.get("kyc_verified"):
        return None

    return KycIdentity(
        full_name=p.get("full_name"),
        nik=p.get("nik"),
        birth_place=p.get("birth_place"),
        birth_date=p.get("birth_date"),
        gender=p.get("gender"),
        address=p.get("address"),
        rt_rw=p.get("rt_rw"),
        kelurahan=p.get("kelurahan"),
        kecamatan=p.get("kecamatan"),
        religion=p.get("religion"),
        marital_status=p.get("marital_status"),
        occupation=p.get("occupation"),
        nationality=p.get("nationality"),
        ktp_photo_url=p.get("ktp_photo_url"),
        selfie_photo_url=p.get("selfie_photo_url"),
        kyc_verified=True,
        kyc_submitted_at=p.get("kyc_submitted_at"),
    )


def _build_audit_response(
    sb, user_id: str, email: str, limit: int
) -> AuditResponse:
    from services.audit_service import build_audit_response
    return build_audit_response(
        sb, user_id, email, limit,
        CreditScoreInfo, FinancialCreditScore, RiskInfo, PeriodSummary,
        TransactionInfo, IntegrityInfo, AuditLogEntry, LoanHistoryEntry,
        DsrHealth, UserInfo, AuditResponse,
        compute_and_sync_cycles, calculate_risk_level, verify_row_integrity, _get_kyc_identity
    )


# ── Main Endpoints ────────────────────────────────────────────────────────────

@router.get(
    "/api/partner/v1/user-audit/{email}",
    response_model=AuditResponse,
    tags=["Partner Audit"],
)
async def get_user_audit(
    email: str,
    limit: int = Query(default=50, ge=1, le=200),
    api_key_owner: str = Depends(_validate_api_key),
):
    """
    Comprehensive user audit for banking partners (search by email).
    Requires a valid API key via x-api-key header.
    """
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")

    user_id = _resolve_email_to_uid(sb, email)
    # Partner keys skip self-only assertion (read_all_users)
    # _assert_api_key_owner(user_id, api_key_owner)
    _deduct_credit_for_api_key_owner(sb, api_key_owner)
    return _build_audit_response(sb, user_id, email, limit)


@router.get(
    "/api/partner/v1/user-audit-by-nik/{nik}",
    response_model=AuditResponse,
    tags=["Partner Audit"],
)
async def get_user_audit_by_nik(
    nik: str,
    limit: int = Query(default=50, ge=1, le=200),
    api_key_owner: str = Depends(_validate_api_key),
):
    """
    Comprehensive user audit for banking partners (search by NIK).
    Requires a valid API key via x-api-key header.
    Returns full KYC identity + credit score + transaction history.
    """
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")

    nik = _validate_nik(nik)
    user_id, email = _resolve_nik_to_uid(sb, nik)
    # Partner keys skip self-only assertion (read_all_users)
    # _assert_api_key_owner(user_id, api_key_owner)
    _deduct_credit_for_api_key_owner(sb, api_key_owner)
    return _build_audit_response(sb, user_id, email, limit)


def _validate_phone(phone: str) -> str:
    """Validate Indonesian mobile number: 08xxxxxxxxxx (10-13 digits)."""
    clean = (phone or "").strip().replace("+62", "0").replace("-", "").replace(" ", "")
    if not clean.isdigit() or len(clean) < 10 or len(clean) > 13 or not clean.startswith("0"):
        raise HTTPException(status_code=422, detail="Nomor HP harus format 08xxxxxxxxxx (10-13 digit)")
    return clean


@router.get(
    "/api/partner/v1/user-audit-by-phone/{phone}",
    response_model=AuditResponse,
    tags=["Partner Audit"],
)
async def get_user_audit_by_phone(
    phone: str,
    limit: int = Query(default=50, ge=1, le=200),
    api_key_owner: str = Depends(_validate_api_key),
):
    """
    Comprehensive user audit for banking partners (search by mobile number).
    Requires a valid API key via x-api-key header.
    Returns full KYC identity + credit score + transaction history.
    """
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")

    phone = _validate_phone(phone)
    phone_variants = [
        phone,
        f"+62{phone[1:]}" if phone.startswith("0") else f"+62{phone}",
        phone[1:] if phone.startswith("0") else phone,
    ]
    
    prof_data = None
    # Resolve phone to user_id
    prof_res = sb.table("profiles").select("id, user_email").in_("phone_number", phone_variants).limit(1).execute()
    rows = getattr(prof_res, "data", None) or []
    if rows:
        prof_data = rows[0]
    else:
        tl_res = sb.table("telegram_links").select("user_id").in_("phone_number", phone_variants).limit(1).execute()
        tl_data = getattr(tl_res, "data", None) or []
        if tl_data and tl_data[0].get("user_id"):
            prof2 = sb.table("profiles").select("id, user_email").eq("id", tl_data[0]["user_id"]).limit(1).execute()
            rows2 = getattr(prof2, "data", None) or []
            if rows2:
                prof_data = rows2[0]

    if not prof_data:
        raise HTTPException(status_code=404, detail=f"User dengan nomor HP '{phone}' tidak ditemukan")
    
    user_id = prof_data["id"]
    email = prof_data.get("user_email", "")

    _deduct_credit_for_api_key_owner(sb, api_key_owner)
    return _build_audit_response(sb, user_id, email, limit)
