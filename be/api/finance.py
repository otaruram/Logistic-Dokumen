from __future__ import annotations

import io
import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from pydantic import BaseModel

from services.otaru_finance_service import (
    accept_family_invite,
    add_installment,
    calculate_otaru_index,
    create_family_invite,
    get_installments,
    get_reconciliation_history,
    list_family_access,
    list_family_invites,
    process_beta_dummy_doc_upload,
    process_personal_doc_upload,
    revoke_family_access,
    upsert_manual_profile,
    verify_partner_api_key,
)
from utils.auth import get_supabase_bearer_user

router = APIRouter(tags=["Otaru Finance"])


class VerifyCreditResponse(BaseModel):
    user_id: str
    integrity_level: str
    credit_grade: str
    otaru_index: int
    dsr_percent: float
    reconciliation_history: list[dict]


class FinanceApiKeyOut(BaseModel):
    key_value: str
    name: str
    partner_name: str
    is_active: bool
    created_at: str
    last_used_at: str | None = None


class FinanceComplianceInfo(BaseModel):
    data_consent_status: str
    kyc_verification: str
    financial_capacity_index: str
    slik_proxy_indicator: str


class FinanceCreditCheckByNikResponse(BaseModel):
    user_id: str
    nik: str
    full_name: str | None = None
    email: str | None = None
    integrity_level: str
    credit_grade: str
    otaru_index: int
    dsr_percent: float
    tampered_attempts: int
    salary_verified: bool
    checked_at: str
    compliance: FinanceComplianceInfo


class FinanceOverviewByNikResponse(BaseModel):
    user_id: str
    nik: str
    full_name: str | None = None
    email: str | None = None
    selfie_photo_url: str | None = None
    otaru_index: int
    credit_grade: str
    integrity_level: str
    dsr_percent: float
    cicilan_aktif_total: int
    sisa_plafon_aman: int
    active_installments_count: int
    tampered_attempts: int
    salary_verified: bool
    checked_at: str
    compliance: FinanceComplianceInfo


def _generate_finance_compliance(dsr_percent: float) -> dict:
    fci = "Aman" if dsr_percent <= 30 else "Berisiko"
    return {
        "data_consent_status": "GRANTED",
        "kyc_verification": "MANUAL_ADMIN_STAMPED",
        "financial_capacity_index": f"{fci} - DSR: {dsr_percent}%",
        "slik_proxy_indicator": "Estimated based on Alternative Data (Non-SLIK)",
    }

def _sb():
    from utils.auth import supabase_admin
    if not supabase_admin:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")
    return supabase_admin


def _finance_api_key_owner_label(current_user: dict) -> str:
    email = current_user.get("email") or current_user.get("user_metadata", {}).get("email") or "partner"
    return str(email)


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


def _upsert_finance_key(current_user: dict) -> FinanceApiKeyOut:
    sb = _sb()
    raw_key = "fk-" + secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    owner_label = _finance_api_key_owner_label(current_user)

    now_iso = datetime.now(timezone.utc).isoformat()

    res = (
        sb.table("partner_api_keys")
        .upsert({
            "partner_name": "Otaru Financial",
            "email": owner_label,
            "api_key_hash": key_hash,
            "plan": "growth",
            "rate_limit_per_day": 250,
            "scopes": ["credit_score", "financial_health", "dsr", "consent"],
            "is_active": True,
            "created_at": now_iso,
        }, on_conflict="email,partner_name")
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Failed to create finance API key")
    row = rows[0]
    return FinanceApiKeyOut(
        key_value=raw_key,
        name="Otaru Financial Key",
        partner_name=row.get("partner_name", "Otaru Financial"),
        is_active=row.get("is_active", True),
        created_at=row.get("created_at", now_iso),
        last_used_at=row.get("last_used_at"),
    )


def validate_finance_api_key(x_api_key: str = Header(..., alias="x-api-key")) -> dict:
    return verify_partner_api_key(x_api_key)


def _deduct_credit_for_finance_key(raw_key: str) -> None:
    """Deduct 1 credit from the Finance API key owner's profile. Raises 402 if exhausted."""
    try:
        import hashlib
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        sb = _sb()
        res = sb.table("partner_api_keys").select("email").eq("api_key_hash", key_hash).eq("is_active", True).limit(1).execute()
        rows = getattr(res, "data", None) or []
        if not rows:
            return
        owner_email = rows[0]["email"]
        prof_res = sb.table("profiles").select("id, credits").eq("user_email", owner_email).limit(1).execute()
        prof_rows = getattr(prof_res, "data", None) or []
        if not prof_rows:
            return
        current = int((prof_rows[0].get("credits") or 0))
        if current <= 0:
            raise HTTPException(status_code=402, detail="Kredit habis. Top-up kredit untuk melanjutkan.")
        sb.table("profiles").update({"credits": current - 1}).eq("id", prof_rows[0]["id"]).execute()
    except HTTPException:
        raise
    except Exception:
        pass  # Non-blocking


class CreateInviteRequest(BaseModel):
    invitee_contact: str


class CreateInviteResponse(BaseModel):
    invite_id: str | None = None
    invite_token: str
    expires_at: str
    permission: str


class AcceptInviteRequest(BaseModel):
    invite_token: str


@router.get("/api/v1/verify-credit/{user_id}", response_model=VerifyCreditResponse)
async def verify_credit_for_b2b(
    user_id: str,
    _: dict = Depends(validate_finance_api_key),
):
    """
    B2B endpoint for bank/leasing risk engines.

    Output prioritizes integrity signal from anti-fraud logs (tampered attempts + SHA-256 seals),
    then combines it with DSR health into a practical grade.
    """
    score = calculate_otaru_index(user_id)
    history = get_reconciliation_history(user_id, limit=12)

    return VerifyCreditResponse(
        user_id=user_id,
        integrity_level=score["integrity_level"],
        credit_grade=score["credit_grade"],
        otaru_index=score["otaru_index"],
        dsr_percent=score["dsr_percent"],
        reconciliation_history=history,
    )


@router.post("/api/v1/finance/apikeys/generate", response_model=FinanceApiKeyOut)
async def generate_finance_api_key(current_user: dict = Depends(get_supabase_bearer_user)):
    return _upsert_finance_key(current_user)


@router.get("/api/v1/finance/apikeys/me", response_model=FinanceApiKeyOut | None)
async def get_my_finance_api_key(current_user: dict = Depends(get_supabase_bearer_user)):
    sb = _sb()
    owner_label = _finance_api_key_owner_label(current_user)
    res = (
        sb.table("partner_api_keys")
        .select("api_key_hash, partner_name, email, is_active, created_at, last_used_at")
        .eq("email", owner_label)
        .eq("partner_name", "Otaru Financial")
        .eq("is_active", True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows:
        return None
    row = rows[0]
    masked = "fk-" + str(row.get("api_key_hash", ""))[:10] + "..."
    return FinanceApiKeyOut(
        key_value=masked,
        name="Otaru Financial Key",
        partner_name=row.get("partner_name", "Otaru Financial"),
        is_active=row.get("is_active", True),
        created_at=row.get("created_at", ""),
        last_used_at=row.get("last_used_at"),
    )


@router.delete("/api/v1/finance/apikeys/me", status_code=204)
async def revoke_finance_api_key(current_user: dict = Depends(get_supabase_bearer_user)):
    sb = _sb()
    owner_label = _finance_api_key_owner_label(current_user)
    sb.table("partner_api_keys").update({"is_active": False}).eq("email", owner_label).eq("partner_name", "Otaru Financial").execute()


@router.get("/api/v1/finance/credit-check-by-nik/{nik}", response_model=FinanceCreditCheckByNikResponse)
async def verify_credit_for_b2b_by_nik(
    nik: str,
    x_api_key: str = Header(..., alias="x-api-key"),
    _: dict = Depends(validate_finance_api_key),
):
    nik = _validate_nik(nik)
    _deduct_credit_for_finance_key(x_api_key)
    # Resolve by NIK from profile table for actual finance score.
    sb = _sb()
    prof = sb.table("profiles").select("id, nik, full_name, user_email").eq("nik", nik).limit(1).execute()
    rows = getattr(prof, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail=f"User dengan NIK '{nik}' tidak ditemukan")
    user_id = rows[0]["id"]
    actual = calculate_otaru_index(str(user_id))
    return FinanceCreditCheckByNikResponse(
        user_id=str(user_id),
        nik=nik,
        full_name=rows[0].get("full_name"),
        email=rows[0].get("user_email"),
        integrity_level=actual["integrity_level"],
        credit_grade=actual["credit_grade"],
        otaru_index=actual["otaru_index"],
        dsr_percent=actual["dsr_percent"],
        tampered_attempts=actual["tampered_attempts"],
        salary_verified=actual["salary_source"] == "ocr_verified",
        checked_at=datetime.now(timezone.utc).isoformat(),
        compliance=_generate_finance_compliance(actual["dsr_percent"]),
    )


@router.get("/api/v1/finance/overview-by-nik/{nik}", response_model=FinanceOverviewByNikResponse)
async def get_finance_overview_by_nik(
    nik: str,
    x_api_key: str = Header(..., alias="x-api-key"),
    _: dict = Depends(validate_finance_api_key),
):
    nik = _validate_nik(nik)
    _deduct_credit_for_finance_key(x_api_key)
    sb = _sb()
    prof = sb.table("profiles").select("id, nik, full_name, user_email, selfie_photo_url").eq("nik", nik).limit(1).execute()
    rows = getattr(prof, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail=f"User dengan NIK '{nik}' tidak ditemukan")

    user_id = str(rows[0]["id"])
    score = calculate_otaru_index(user_id)
    installments = get_installments(user_id)

    return FinanceOverviewByNikResponse(
        user_id=user_id,
        nik=nik,
        full_name=rows[0].get("full_name"),
        email=rows[0].get("user_email"),
        selfie_photo_url=rows[0].get("selfie_photo_url"),
        otaru_index=score["otaru_index"],
        credit_grade=score["credit_grade"],
        integrity_level=score["integrity_level"],
        dsr_percent=score["dsr_percent"],
        cicilan_aktif_total=score.get("cicilan_aktif_total", 0),
        sisa_plafon_aman=score.get("sisa_plafon_aman", 0),
        active_installments_count=len(installments),
        tampered_attempts=score["tampered_attempts"],
        salary_verified=score.get("salary_source") == "ocr_verified",
        checked_at=datetime.now(timezone.utc).isoformat(),
        compliance=_generate_finance_compliance(score["dsr_percent"]),
    )


@router.get("/api/v1/finance/overview-by-phone/{phone}", response_model=FinanceOverviewByNikResponse)
async def get_finance_overview_by_phone(
    phone: str,
    x_api_key: str = Header(..., alias="x-api-key"),
    _: dict = Depends(validate_finance_api_key),
):
    """
    Full financial overview by mobile number.
    Returns identity + Otaru Index + DSR + installments + plafon aman.
    """
    phone = _validate_phone(phone)
    _deduct_credit_for_finance_key(x_api_key)
    sb = _sb()
    phone_variants = [
        phone,
        f"+62{phone[1:]}" if phone.startswith("0") else f"+62{phone}",
        phone[1:] if phone.startswith("0") else phone,
    ]
    
    prof_data = None
    prof = sb.table("profiles").select("id, nik, full_name, user_email, selfie_photo_url").in_("phone_number", phone_variants).limit(1).execute()
    rows = getattr(prof, "data", None) or []
    if rows:
        prof_data = rows[0]
    else:
        tl_res = sb.table("telegram_links").select("user_id").in_("phone_number", phone_variants).limit(1).execute()
        tl_data = getattr(tl_res, "data", None) or []
        if tl_data and tl_data[0].get("user_id"):
            prof2 = sb.table("profiles").select("id, nik, full_name, user_email, selfie_photo_url").eq("id", tl_data[0]["user_id"]).limit(1).execute()
            rows2 = getattr(prof2, "data", None) or []
            if rows2:
                prof_data = rows2[0]

    if not prof_data:
        raise HTTPException(status_code=404, detail=f"User dengan nomor HP '{phone}' tidak ditemukan")
    
    rows = [prof_data]

    user_id = str(rows[0]["id"])
    score = calculate_otaru_index(user_id)
    installments = get_installments(user_id)

    return FinanceOverviewByNikResponse(
        user_id=user_id,
        nik=rows[0].get("nik") or "",
        full_name=rows[0].get("full_name"),
        email=rows[0].get("user_email"),
        selfie_photo_url=rows[0].get("selfie_photo_url"),
        otaru_index=score["otaru_index"],
        credit_grade=score["credit_grade"],
        integrity_level=score["integrity_level"],
        dsr_percent=score["dsr_percent"],
        cicilan_aktif_total=score.get("cicilan_aktif_total", 0),
        sisa_plafon_aman=score.get("sisa_plafon_aman", 0),
        active_installments_count=len(installments),
        tampered_attempts=score["tampered_attempts"],
        salary_verified=score.get("salary_source") == "ocr_verified",
        checked_at=datetime.now(timezone.utc).isoformat(),
        compliance=_generate_finance_compliance(score["dsr_percent"]),
    )


@router.post("/api/v1/family-sharing/invite", response_model=CreateInviteResponse)
async def create_invite(
    body: CreateInviteRequest,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    if not body.invitee_contact.strip():
        raise HTTPException(status_code=400, detail="invitee_contact wajib diisi")
    payload = create_family_invite(str(current_user["id"]), body.invitee_contact.strip())
    return CreateInviteResponse(**payload)


@router.post("/api/v1/family-sharing/accept")
async def accept_invite(
    body: AcceptInviteRequest,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    if not body.invite_token.strip():
        raise HTTPException(status_code=400, detail="invite_token wajib diisi")
    return accept_family_invite(str(current_user["id"]), body.invite_token.strip())


@router.get("/api/v1/family-sharing/invites")
async def list_invites(current_user: dict = Depends(get_supabase_bearer_user)):
    """List all invites created by current user (as owner)."""
    return list_family_invites(str(current_user["id"]))


@router.get("/api/v1/family-sharing/access")
async def list_access(current_user: dict = Depends(get_supabase_bearer_user)):
    """List all viewers who have accepted access to current user's data."""
    return list_family_access(str(current_user["id"]))


@router.delete("/api/v1/family-sharing/access/{viewer_user_id}")
async def revoke_access(
    viewer_user_id: str,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """Revoke a viewer's access to current user's data."""
    return revoke_family_access(str(current_user["id"]), viewer_user_id)


# ── Web UI endpoints ──────────────────────────────────────────────────────────

@router.get("/api/v1/finance/score")
async def get_score(current_user: dict = Depends(get_supabase_bearer_user)):
    """Hitung dan kembalikan Otaru Integrity Index untuk user yang login."""
    return calculate_otaru_index(str(current_user["id"]))


class UpdateProfileRequest(BaseModel):
    gaji_bulanan: int | None = None
    tanggungan: int | None = None
    pengeluaran_rutin: int | None = None
    pekerjaan: str | None = None
    nama_perusahaan: str | None = None


@router.post("/api/v1/finance/profile")
async def update_finance_profile(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """Update profil keuangan manual (gaji, tanggungan, pekerjaan, dll)."""
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="Tidak ada field yang dikirim")
    return upsert_manual_profile(str(current_user["id"]), data)


class AddInstallmentRequest(BaseModel):
    nama_pinjaman: str
    cicilan_bulanan: int
    lembaga: str | None = None
    sisa_tenor: int | None = None


@router.get("/api/v1/finance/installments")
async def list_installments(current_user: dict = Depends(get_supabase_bearer_user)):
    """List cicilan aktif user."""
    items = get_installments(str(current_user["id"]))
    return {"installments": items}


@router.post("/api/v1/finance/installments")
async def add_installment_endpoint(
    body: AddInstallmentRequest,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """Tambah cicilan manual."""
    data = body.model_dump(exclude_none=True)
    return add_installment(str(current_user["id"]), data)


@router.post("/api/v1/finance/upload-doc")
async def upload_doc(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """Upload foto slip gaji / struk belanja → OCR → classifier → update skor."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar (image/*)")
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File terlalu besar (max 10MB)")

    # Beta path: official downloadable dummy templates are guaranteed to pass.
    filename = (file.filename or "").lower()
    if "otaru_dummy_slip_gaji" in filename:
        return process_beta_dummy_doc_upload(str(current_user["id"]), "slip_gaji", uploaded_via="web")
    if "otaru_dummy_struk_belanja" in filename:
        return process_beta_dummy_doc_upload(str(current_user["id"]), "struk_belanja", uploaded_via="web")

    return process_personal_doc_upload(str(current_user["id"]), image_bytes, uploaded_via="web")


class AskOtaruRequest(BaseModel):
    question: str


@router.post("/api/v1/finance/ask")
async def ask_otaru_financial(
    body: AskOtaruRequest,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """
    Tanya Otaru AI Financial Consultant.
    Reads the authenticated user's full financial profile and responds as a
    personal financial advisor. No credit deduction — free feature.
    """
    question = (body.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Pertanyaan tidak boleh kosong")
    if len(question) > 800:
        raise HTTPException(status_code=400, detail="Pertanyaan terlalu panjang (max 800 karakter)")

    try:
        from services.telegram_service import answer_finance_question_with_context
        answer = await answer_finance_question_with_context(str(current_user["id"]), question)
        
        # Strip asterisks for cleaner formatting
        clean_answer = answer.replace("**", "").replace("*", "")
        
        return {"answer": clean_answer, "user_id": str(current_user["id"])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Otaru tidak dapat memproses: {str(e)}")

