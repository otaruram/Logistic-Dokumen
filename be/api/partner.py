"""
Partner API — B2B scoring endpoint + API key management.

Endpoints:
  POST /api/v1/apikeys/generate   — authenticated user generates/rotates their API key
  GET  /api/v1/apikeys/me         — get user's current API key
  DELETE /api/v1/apikeys/me       — revoke API key
  GET  /api/v1/partner/stats      — global platform stats (public, for landing page)
  GET  /api/v1/scoring/{email}    — score a user by email (requires x-api-key header)
"""
from __future__ import annotations

import hashlib
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel

from utils.auth import get_supabase_bearer_user, supabase_admin
from utils.api_key import validate_api_key as _validate_api_key, validate_api_key_full as _validate_api_key_full
from services.otaru_finance_service import verify_partner_api_key

router = APIRouter()

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_sb():
    """Return a supabase_admin client; raises 503 if not configured."""
    if not supabase_admin:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")
    return supabase_admin


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


def _validate_phone(phone: str) -> str:
    """Validate Indonesian mobile number: 08xxxxxxxxxx (10-13 digits)."""
    clean = (phone or "").strip().replace("+62", "0").replace("-", "").replace(" ", "")
    if not clean.isdigit() or len(clean) < 10 or len(clean) > 13 or not clean.startswith("0"):
        raise HTTPException(status_code=422, detail="Nomor HP harus format 08xxxxxxxxxx (10-13 digit)")
    return clean


def _deduct_credit_for_api_key_owner(sb, api_key_owner: str) -> None:
    """Deduct 1 credit from the API key owner's profile (api_key_owner is user_id). Raises 402 if none left."""
    try:
        # api_key_owner from _validate_api_key is already the user_id
        owner_uid = api_key_owner
        prof_res = sb.table("profiles").select("partner_api_credits").eq("id", owner_uid).limit(1).execute()
        prof_rows = getattr(prof_res, "data", None) or []
        current = int((prof_rows[0].get("partner_api_credits") or 0)) if prof_rows else 0
        if current <= 0:
            raise HTTPException(status_code=402, detail="Kredit API Partner habis. Upgrade plan untuk melanjutkan.")
        sb.table("profiles").update({"partner_api_credits": current - 1}).eq("id", owner_uid).execute()
    except HTTPException:
        raise
    except Exception:
        pass  # Non-blocking credit deduction — don't break the request


# ---------------------------------------------------------------------------
# API Key Management (authenticated endpoints)
# ---------------------------------------------------------------------------

class ApiKeyOut(BaseModel):
    key_value: str
    name: str
    is_active: bool
    created_at: str
    last_used_at: Optional[str] = None


class GenerateKeyRequest(BaseModel):
    key_type: Optional[str] = "individual"  # 'individual' or 'partner'


@router.post("/api/v1/apikeys/generate", response_model=ApiKeyOut, tags=["Partner"])
async def generate_api_key(
    body: Optional[GenerateKeyRequest] = None,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """
    Generate (or rotate) the caller's API key.
    Only one active key per user — calling again rotates the key.
    Pass key_type='partner' for Koperasi keys with read_all_users permission.
    """
    sb = _get_sb()
    new_key = "sk-" + secrets.token_urlsafe(32)
    requested_type = (body.key_type if body else None) or "individual"
    if requested_type not in ("individual", "partner"):
        requested_type = "individual"

    # Deactivate existing keys first
    sb.table("api_keys").update({"is_active": False}).eq("user_id", str(current_user["id"])).execute()

    # Insert new key
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    res = (
        sb.table("api_keys")
        .insert({
            "user_id": str(current_user["id"]),
            "key_value": new_key,
            "name": "Default Key",
            "is_active": True,
            "key_type": requested_type,
            "created_at": now_iso,
        })
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Failed to create API key")
    row = rows[0]
    return ApiKeyOut(
        key_value=row["key_value"],
        name=row.get("name", "Default Key"),
        is_active=row.get("is_active", True),
        created_at=row.get("created_at", now_iso),
        last_used_at=row.get("last_used_at"),
    )


@router.get("/api/v1/apikeys/me", response_model=Optional[ApiKeyOut], tags=["Partner"])
async def get_my_api_key(
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """Return the caller's active API key, or null if none."""
    sb = _get_sb()
    res = (
        sb.table("api_keys")
        .select("key_value, name, is_active, created_at, last_used_at")
        .eq("user_id", str(current_user["id"]))
        .eq("is_active", True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows:
        return None
    r = rows[0]
    return ApiKeyOut(
        key_value=r["key_value"],
        name=r.get("name", "Default Key"),
        is_active=r.get("is_active", True),
        created_at=r.get("created_at", ""),
        last_used_at=r.get("last_used_at"),
    )


@router.delete("/api/v1/apikeys/me", status_code=204, tags=["Partner"])
async def revoke_api_key(
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """Revoke all active API keys for the caller."""
    sb = _get_sb()
    sb.table("api_keys").update({"is_active": False}).eq("user_id", str(current_user["id"])).execute()


# ---------------------------------------------------------------------------
# Decision Gate API Key Management
# ---------------------------------------------------------------------------

class DecisionApiKeyOut(BaseModel):
    key_value: str
    name: str
    partner_name: str
    is_active: bool
    created_at: str
    last_used_at: Optional[str] = None

def _decision_api_key_owner_label(current_user: dict) -> str:
    return str(current_user.get("email") or current_user.get("user_metadata", {}).get("email") or "partner")

@router.post("/api/v1/decision/apikeys/generate", response_model=DecisionApiKeyOut, tags=["Partner"])
async def generate_decision_api_key(current_user: dict = Depends(get_supabase_bearer_user)):
    sb = _get_sb()
    raw_key = "dk-" + secrets.token_urlsafe(32)
    import hashlib
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    owner_label = _decision_api_key_owner_label(current_user)
    
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()

    res = (
        sb.table("partner_api_keys")
        .upsert({
            "partner_name": "Otaru Decision Gate",
            "email": owner_label,
            "api_key_hash": key_hash,
            "plan": "launch",
            "rate_limit_per_day": 30,
            "scopes": ["chain_read", "financial_read", "decision_gate", "unified"],
            "is_active": True,
            "created_at": now_iso,
        }, on_conflict="email,partner_name")
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Failed to create decision API key")
    row = rows[0]
    return DecisionApiKeyOut(
        key_value=raw_key,
        name="Otaru Decision Key",
        partner_name=row.get("partner_name", "Otaru Decision Gate"),
        is_active=row.get("is_active", True),
        created_at=row.get("created_at", now_iso),
        last_used_at=row.get("last_used_at"),
    )

@router.get("/api/v1/decision/apikeys/me", response_model=Optional[DecisionApiKeyOut], tags=["Partner"])
async def get_my_decision_api_key(current_user: dict = Depends(get_supabase_bearer_user)):
    sb = _get_sb()
    owner_label = _decision_api_key_owner_label(current_user)
    res = (
        sb.table("partner_api_keys")
        .select("api_key_hash, partner_name, email, is_active, created_at, last_used_at")
        .eq("email", owner_label)
        .eq("partner_name", "Otaru Decision Gate")
        .eq("is_active", True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows:
        return None
    row = rows[0]
    masked = "dk-" + str(row.get("api_key_hash", ""))[:10] + "..."
    return DecisionApiKeyOut(
        key_value=masked,
        name="Otaru Decision Key",
        partner_name=row.get("partner_name", "Otaru Decision Gate"),
        is_active=row.get("is_active", True),
        created_at=row.get("created_at", ""),
        last_used_at=row.get("last_used_at"),
    )

@router.delete("/api/v1/decision/apikeys/me", status_code=204, tags=["Partner"])
async def revoke_decision_api_key(current_user: dict = Depends(get_supabase_bearer_user)):
    sb = _get_sb()
    owner_label = _decision_api_key_owner_label(current_user)
    sb.table("partner_api_keys").update({"is_active": False}).eq("email", owner_label).eq("partner_name", "Otaru Decision Gate").execute()


# ---------------------------------------------------------------------------
# Unified Key Generation — Phone Number Triggered
# ---------------------------------------------------------------------------

class PhoneSyncRequest(BaseModel):
    phone_number: str  # 08xxxxxxxxxx

class PhoneSyncResponse(BaseModel):
    phone_number: str
    message: str = "Phone number saved successfully."


class PhoneAutoFillResponse(BaseModel):
    phone_number: str
    source: str
    message: str


def _generate_unique_phone_for_user(sb, user_id: str) -> tuple[str, str]:
    """Return (phone_number, source), preferring existing profile phone for stable identity."""
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
            return existing_phone, "existing"
    except Exception:
        pass

    for attempt in range(50):
        digest = hashlib.sha256(f"{user_id}:beta-phone:{attempt}".encode("utf-8")).hexdigest()
        numeric = int(digest[:15], 16) % 10_000_000_000
        candidate = "08" + str(numeric).zfill(10)

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
            return candidate, "generated"

    raise HTTPException(status_code=500, detail="Gagal generate nomor HP unik beta")


@router.post("/api/v1/profiles/phone", response_model=PhoneSyncResponse, tags=["Partner"])
async def sync_phone_number(
    body: PhoneSyncRequest,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """
    Save or update the user's phone number in their profile.
    Existing API keys become active/fully linked once this is saved.
    """
    sb = _get_sb()
    phone = _validate_phone(body.phone_number)
    user_id = str(current_user["id"])

    try:
        # Update phone_number in profiles
        res = sb.table("profiles").update({"phone_number": phone}).eq("id", user_id).execute()
        # Fallback if profile doesn't exist? Typically created via trigger.
        if not getattr(res, "data", None):
            # Attempt to upsert
            sb.table("profiles").upsert({
                "id": user_id,
                "phone_number": phone,
                "user_email": current_user.get("email"),
                "full_name": current_user.get("user_metadata", {}).get("name") or "User"
            }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save phone number: {str(e)}")

    return PhoneSyncResponse(
        phone_number=phone,
        message=f"Phone number {phone} saved successfully.",
    )


@router.get("/api/v1/profiles/phone/autofill", response_model=PhoneAutoFillResponse, tags=["Partner"])
async def autofill_phone_number(request: Request):
    """
    Auto-fill helper for Partner API - returns the user's actual phone number from their profile.
    Falls back to a generated test number if no profile phone is found.
    """
    # Try to get user's phone from their profile
    try:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            sb = supabase_admin
            user_res = sb.auth.get_user(token)
            if user_res and user_res.user:
                user_id = str(user_res.user.id)
                profile = sb.table("profiles").select("phone_number").eq("id", user_id).limit(1).execute()
                if profile.data and profile.data[0].get("phone_number"):
                    return PhoneAutoFillResponse(
                        phone_number=profile.data[0]["phone_number"],
                        source="profile",
                        message="Nomor HP dari profil akun Anda.",
                    )
    except Exception:
        pass

    # Fallback: generate random test phone
    import random
    prefixes = ["0812", "0813", "0821", "0822", "0852", "0853", "0857", "0858", "0878", "0877"]
    prefix = random.choice(prefixes)
    suffix = "".join([str(random.randint(0, 9)) for _ in range(8)])
    test_phone = f"{prefix}{suffix}"
    return PhoneAutoFillResponse(
        phone_number=test_phone,
        source="generated",
        message="Phone number siap dipakai untuk Partner API key.",
    )


# ---------------------------------------------------------------------------
# Platform Stats (public — no auth required)
# ---------------------------------------------------------------------------

class PlatformStats(BaseModel):
    total_scans: int
    fraud_prevented: int
    verified_scans: int
    integrity_rate: float  # percentage 0–100


@router.get("/api/v1/partner/stats", response_model=PlatformStats, tags=["Partner"])
async def get_platform_stats():
    """Global platform statistics for partner landing page hero section."""
    sb = _get_sb()
    try:
        res = sb.table("fraud_scans").select("status").execute()
        rows = getattr(res, "data", None) or []
        total = len(rows)
        verified = sum(1 for r in rows if r.get("status") == "verified")
        tampered = sum(1 for r in rows if r.get("status") == "tampered")
        integrity = round((verified / total * 100), 1) if total > 0 else 0.0
        return PlatformStats(
            total_scans=total,
            fraud_prevented=tampered,
            verified_scans=verified,
            integrity_rate=integrity,
        )
    except Exception:
        return PlatformStats(total_scans=0, fraud_prevented=0, verified_scans=0, integrity_rate=0.0)


@router.get("/api/v1/partner/demo-niks", tags=["Partner"])
async def get_demo_niks():
    """Return up to 5 real NIKs from profiles for beta playground input helper."""
    sb = _get_sb()
    try:
        res = sb.table("profiles").select("nik").not_.is_("nik", "null").limit(5).execute()
        rows = getattr(res, "data", None) or []
        niks = [r["nik"] for r in rows if r.get("nik")]
        return {"niks": niks}
    except Exception:
        return {"niks": []}


@router.get("/api/v1/partner/demo-phones", tags=["Partner"])
async def get_demo_phones():
    """Return up to 5 real phone numbers from profiles for beta playground input helper."""
    sb = _get_sb()
    try:
        res = sb.table("profiles").select("phone_number").not_.is_("phone_number", "null").limit(5).execute()
        rows = getattr(res, "data", None) or []
        phones = [r["phone_number"] for r in rows if r.get("phone_number")]
        return {"phones": phones}
    except Exception:
        return {"phones": []}


# ---------------------------------------------------------------------------
# Scoring Endpoint — requires x-api-key header
# ---------------------------------------------------------------------------

class ScanSummary(BaseModel):
    scan_id: str
    status: str
    nominal_total: Optional[float] = None
    vendor_name: Optional[str] = None
    doc_type: Optional[str] = None
    created_at: str


class CycleInfo(BaseModel):
    current_cycle: int
    current_cycle_score: int
    cycle_max: int
    lifetime_score: int
    completed_cycles: int


class RiskDetail(BaseModel):
    risk_level: str
    risk_score: int
    factors: list[dict]


class ScoringResponse(BaseModel):
    email: str
    user_id: str
    trust_score: int
    risk_label: str          # "LOW" | "MEDIUM" | "HIGH"
    risk_detail: Optional[RiskDetail] = None
    cycle_info: Optional[CycleInfo] = None
    total_scans: int
    verified_scans: int
    tampered_scans: int
    total_nominal: float
    recent_scans: list[ScanSummary]
    credit_score_breakdown: Optional[dict] = None
    compliance: Optional[dict] = None


@router.get("/api/v1/scoring/{email}", response_model=ScoringResponse, tags=["Partner"])
async def score_user_by_email(
    email: str,
    limit: int = Query(default=10, ge=1, le=50),
    api_key_owner: str = Depends(_validate_api_key),
):
    """
    Return the credit/trust score for a user identified by email.
    Requires a valid x-api-key header.
    """
    sb = _get_sb()

    from services.partner_service import handle_score_user_by_email
    try:
        scoring_data = handle_score_user_by_email(sb, email, limit, api_key_owner, _deduct_credit_for_api_key_owner)
    except Exception as e:
        if "tidak ditemukan" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    if 'raw_profile' not in locals():
        raw_profile = {}
    
    return ScoringResponse(
        email=scoring_data["email"],
        user_id=scoring_data["user_id"],
        trust_score=scoring_data["trust_score"],
        risk_label=scoring_data["risk_label"],
        risk_detail=RiskDetail(**scoring_data["risk_detail"]) if scoring_data["risk_detail"] else None,
        cycle_info=CycleInfo(**scoring_data["cycle_info"]) if scoring_data["cycle_info"] else None,
        total_scans=scoring_data["total_scans"],
        verified_scans=scoring_data["verified_scans"],
        tampered_scans=scoring_data["tampered_scans"],
        total_nominal=scoring_data["total_nominal"],
        recent_scans=[ScanSummary(**s) for s in scoring_data["recent_scans"]],
        credit_score_breakdown=scoring_data["credit_score_breakdown"],
        compliance=_get_compliance_block(raw_profile) if raw_profile else None
    )


# ---------------------------------------------------------------------------
# Stage 3 — Koperasi / Lender Lookup Endpoint
# ---------------------------------------------------------------------------

@router.get("/api/v1/partner/lookup/{nik}", tags=["Partner"])
async def lookup_by_nik(
    nik: str,
    x_api_key: Optional[str] = None,
):
    """
    Unified identity + risk lookup for Koperasi, Lender, and B2B partners.

    Returns:
      - Identity: full_name, NIK, address, KTP photo URL, selfie photo URL
      - OtaruChain metrics: trust_score, verified_docs, tampered_docs
      - Financial metrics: otaru_index, credit_grade, dsr_percent, sisa_plafon
      - Trust Grade: HIGH / MEDIUM / LOW
      - Recommendation text

    Auth: x-api-key header required.
    """
    from datetime import datetime, timezone

    nik = _validate_nik(nik)
    sb = _get_sb()

    # Resolve API key for credit deduction
    api_key_owner: Optional[str] = None
    if x_api_key:
        try:
            from utils.api_key import validate_api_key as _vk
            api_key_owner = _vk(x_api_key)
        except Exception:
            raise HTTPException(status_code=401, detail="API key tidak valid atau tidak aktif")
    else:
        raise HTTPException(status_code=401, detail="x-api-key header diperlukan")

    _deduct_credit_for_api_key_owner(sb, api_key_owner)

    # ── Fetch profile by NIK ──────────────────────────────────────────────
    try:
        prof_res = sb.table("profiles").select(
            "id,full_name,nik,address,ktp_photo_url,selfie_photo_url,"
            "credit_score,fraud_flags,salary,plan"
        ).eq("nik", nik).limit(1).execute()
        profiles_data = getattr(prof_res, "data", None) or []
        if not profiles_data:
            raise HTTPException(status_code=404, detail=f"NIK {nik} tidak ditemukan dalam sistem")
        
        raw_profile = profiles_data[0]
        if not raw_profile.get("data_consent_given"):
            raise HTTPException(status_code=403, detail="User belum memberikan consent data sesuai UU PDP. Tidak dapat membagikan data ke pihak ketiga.")

        profile = _mask_profile_for_partner(raw_profile)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"NIK tidak ditemukan: {e}")

    user_id = profile["id"]

    from services.partner_service import get_unified_decision_data
    ud = get_unified_decision_data(sb, profile)

    return {
        "nik": nik,
        "full_name": profile.get("full_name") or "",
        "address": profile.get("address") or "",
        "ktp_photo_url": profile.get("ktp_photo_url") or "",
        "selfie_photo_url": profile.get("selfie_photo_url") or "",
        "otaruchain_metrics": {
            "trust_score": ud["trust_score_chain"],
            "verified_docs": ud["verified_docs"],
            "tampered_docs": ud["tampered_docs"],
            "fraud_flags": ud["fraud_flags"],
        },
        "financial_metrics": {
            "otaru_index": ud["otaru_index"],
            "credit_grade": ud["credit_grade"],
            "dsr_percent": ud["dsr_percent"],
            "sisa_plafon": ud["sisa_plafon"],
            "integrity_level": ud["integrity_level"],
        },
        "trust_grade": ud["trust_grade"],
        "recommendation": ud["recommendation_desc"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "compliance": _get_compliance_block(raw_profile),
    }


@router.get("/api/v1/scoring-by-nik/{nik}", response_model=ScoringResponse, tags=["Partner"])
async def score_user_by_nik(
    nik: str,
    limit: int = Query(default=10, ge=1, le=50),
    api_key_owner: str = Depends(_validate_api_key),
):
    """
    Return the credit/trust score for a user identified by NIK.
    Requires a valid x-api-key header.
    """
    sb = _get_sb()
    clean_nik = _validate_nik(nik)
    from services.partner_service import handle_score_user_by_nik
    try:
        res_data = handle_score_user_by_nik(sb, clean_nik, limit, api_key_owner, _deduct_credit_for_api_key_owner)
        scoring_data = res_data["scoring_data"]
        raw_profile = res_data["raw_profile"]
    except Exception as e:
        if "tidak ditemukan" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        if "consent" in str(e).lower() or "uu pdp" in str(e).lower():
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    
    return ScoringResponse(
        email=scoring_data["email"],
        user_id=scoring_data["user_id"],
        trust_score=scoring_data["trust_score"],
        risk_label=scoring_data["risk_label"],
        risk_detail=RiskDetail(**scoring_data["risk_detail"]) if scoring_data["risk_detail"] else None,
        cycle_info=CycleInfo(**scoring_data["cycle_info"]) if scoring_data["cycle_info"] else None,
        total_scans=scoring_data["total_scans"],
        verified_scans=scoring_data["verified_scans"],
        tampered_scans=scoring_data["tampered_scans"],
        total_nominal=scoring_data["total_nominal"],
        recent_scans=[ScanSummary(**s) for s in scoring_data["recent_scans"]],
        credit_score_breakdown=scoring_data["credit_score_breakdown"],
        compliance=_get_compliance_block(raw_profile)
    )


# ---------------------------------------------------------------------------
# Mobile Number Lookup Endpoints (Phase 2)
# ---------------------------------------------------------------------------

def _resolve_phone_to_profile(sb, phone: str) -> dict:
    """Resolve a phone number to a profile row with multi-format fallback. Raises 404 if not found."""
    phone_variants = [
        phone,
        f"+62{phone[1:]}" if phone.startswith("0") else f"+62{phone}",
        phone[1:] if phone.startswith("0") else phone,
    ]
    res = (
        sb.table("profiles")
        .select("id, user_email, nik, full_name, phone_number, address, kecamatan, kelurahan, ktp_photo_url, selfie_photo_url, credit_score, fraud_flags, salary, plan, data_consent_given, data_consent_at, data_consent_version")
        .in_("phone_number", phone_variants)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows:
        # Fallback to telegram_links
        tl_res = sb.table("telegram_links").select("user_id").in_("phone_number", phone_variants).limit(1).execute()
        tl_data = getattr(tl_res, "data", None) or []
        if tl_data and tl_data[0].get("user_id"):
            prof_res2 = sb.table("profiles").select(
                "id, user_email, nik, full_name, phone_number, address, kecamatan, kelurahan, ktp_photo_url, selfie_photo_url, credit_score, fraud_flags, salary, plan, data_consent_given, data_consent_at, data_consent_version"
            ).eq("id", tl_data[0]["user_id"]).limit(1).execute()
            rows2 = getattr(prof_res2, "data", None) or []
            if rows2:
                return rows2[0]
        raise HTTPException(status_code=404, detail=f"User dengan nomor HP '{phone}' tidak ditemukan")
    return rows[0]

def _mask_profile_for_partner(profile: dict) -> dict:
    masked = profile.copy()
    
    # NIK: Mask middle digits -> 3201****0001 (show first 4 and last 4)
    nik = masked.get("nik") or ""
    if len(nik) >= 8:
        masked["nik"] = f"{nik[:4]}****{nik[-4:]}"
    
    # Phone: Mask middle digits
    ph = masked.get("phone_number") or ""
    if len(ph) >= 8:
        masked["phone_number"] = f"{ph[:4]}****{ph[-4:]}"
    
    # Email: mask -> b***@otaru.id
    email = masked.get("user_email") or masked.get("email") or ""
    if email and "@" in email:
        name_part, domain = email.split("@", 1)
        if len(name_part) > 1:
            masked["user_email"] = f"{name_part[0]}***@{domain}"
            masked["email"] = masked["user_email"]
            
    # Address: keep only kecamatan/kelurahan if available
    kec = masked.get("kecamatan") or ""
    kel = masked.get("kelurahan") or ""
    if kec or kel:
        masked["address"] = f"Kec. {kec}, Kel. {kel}".strip(", ")
    else:
        masked["address"] = "***Masked Address***"
        
    # Remove KTP and Selfie URLs
    masked.pop("ktp_photo_url", None)
    masked.pop("selfie_photo_url", None)
    
    return masked

def _get_compliance_block(profile: dict) -> dict:
    return {
        "regulation": "POJK 13/POJK.02/2018 & UU PDP No. 27/2022",
        "data_consent": profile.get("data_consent_given", False),
        "consent_timestamp": profile.get("data_consent_at"),
        "consent_version": profile.get("data_consent_version", "v1.0"),
        "data_minimization": True,
        "purpose": "alternative_credit_scoring",
        "retention_days": 90,
        "provider": "PT Otaru Digital Indonesia"
    }


@router.get("/api/v1/scoring-by-phone/{phone}", response_model=ScoringResponse, tags=["Partner"])
async def score_user_by_phone(
    phone: str,
    limit: int = Query(default=10, ge=1, le=50),
    api_key_owner: str = Depends(_validate_api_key),
):
    """
    Return the credit/trust score for a user identified by mobile number.
    Requires a valid x-api-key header.
    """
    sb = _get_sb()
    phone = _validate_phone(phone)
    from services.partner_service import handle_score_user_by_phone
    try:
        res_data = handle_score_user_by_phone(sb, phone, limit, api_key_owner, _deduct_credit_for_api_key_owner, _resolve_phone_to_profile)
        scoring_data = res_data["scoring_data"]
        raw_profile = res_data["raw_profile"]
    except Exception as e:
        if "tidak ditemukan" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        if "consent" in str(e).lower() or "uu pdp" in str(e).lower():
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    user_id = raw_profile["id"]

    response = ScoringResponse(
        email=scoring_data["email"],
        user_id=scoring_data["user_id"],
        trust_score=scoring_data["trust_score"],
        risk_label=scoring_data["risk_label"],
        risk_detail=RiskDetail(**scoring_data["risk_detail"]) if scoring_data["risk_detail"] else None,
        cycle_info=CycleInfo(**scoring_data["cycle_info"]) if scoring_data["cycle_info"] else None,
        total_scans=scoring_data["total_scans"],
        verified_scans=scoring_data["verified_scans"],
        tampered_scans=scoring_data["tampered_scans"],
        total_nominal=scoring_data["total_nominal"],
        recent_scans=[ScanSummary(**s) for s in scoring_data["recent_scans"]],
        credit_score_breakdown=scoring_data["credit_score_breakdown"],
        compliance=_get_compliance_block(raw_profile),
    )

    # Log Audit Trail
    try:
        api_key_id = None
        ak_res = sb.table("api_keys").select("id").eq("key_value", api_key_owner).limit(1).execute()
        ak_rows = getattr(ak_res, "data", None) or []
        if ak_rows:
            api_key_id = ak_rows[0]["id"]
            sb.table("partner_api_usage").insert({
                "api_key_id": api_key_id,
                "endpoint": f"/api/v1/scoring-by-phone/{phone}",
                "target_user_id": user_id,
                "response_code": 200
            }).execute()
    except Exception as e:
        print(f"Failed to log API usage: {e}")

    return response


@router.get("/api/v1/partner/unified-decision/{phone}", tags=["Partner"])
async def unified_decision(
    phone: str,
    x_api_key: Optional[str] = Header(None, alias="x-api-key"),
):
    """
    Unified Decision Gate lookup by mobile number.
    Returns identity, OtaruChain metrics, financial metrics, trust grade, and recommendation.
    """
    from datetime import datetime, timezone

    phone = _validate_phone(phone)
    sb = _get_sb()

    if not x_api_key:
        raise HTTPException(status_code=401, detail="x-api-key header diperlukan")
        
    try:
        # If it's a decision key, validate against partner_api_keys
        if x_api_key.startswith("dk-"):
            import hashlib
            key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
            res = sb.table("partner_api_keys").select("scopes, is_active, email").eq("api_key_hash", key_hash).limit(1).execute()
            rows = getattr(res, "data", None) or []
            if not rows or not rows[0].get("is_active"):
                raise HTTPException(status_code=401, detail="Decision Key tidak valid atau tidak aktif")

            scopes = rows[0].get("scopes") or []
            if "decision_gate" not in scopes and "unified" not in scopes:
                raise HTTPException(status_code=403, detail="Key tidak memiliki scope unified atau decision_gate")
            
            # Deduct credit using email from partner_api_keys
            email = rows[0].get("email")
            if email:
                try:
                    prof_res = sb.table("profiles").select("id").eq("user_email", email).limit(1).execute()
                    prof_rows = getattr(prof_res, "data", None) or []
                    if prof_rows:
                        _deduct_credit_for_api_key_owner(sb, prof_rows[0]["id"])
                except Exception as e:
                    print("Error deducting credit:", e)
        else:
            # Fallback to standard api key validation
            from utils.api_key import validate_api_key_full as _vk_full
            key_info = _vk_full(x_api_key)
            _deduct_credit_for_api_key_owner(sb, key_info["user_id"])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="API key tidak valid atau tidak aktif")

    from services.partner_service import handle_unified_decision
    try:
        response = handle_unified_decision(sb, phone, x_api_key, _mask_profile_for_partner)
    except Exception as e:
        if "tidak ditemukan" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        if "consent" in str(e).lower() or "uu pdp" in str(e).lower():
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))

    return response
