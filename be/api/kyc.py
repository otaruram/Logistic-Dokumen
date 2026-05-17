"""
KYC (Know Your Customer) API — Mandatory identity verification for new users.

Endpoints:
  GET  /api/kyc/status   — Check if current user has completed KYC
  POST /api/kyc/submit   — Submit KYC identity form (multipart with KTP + selfie photos)
  GET  /api/kyc/profile  — Get current user's full KYC profile data
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel

from utils.auth import get_supabase_bearer_user
from utils.api_key import validate_api_key_full
from services.scan_helpers import get_supabase_admin
from services.imagekit_service import ImageKitService

router = APIRouter()


# ── Response Models ───────────────────────────────────────────────────────────

class KycStatus(BaseModel):
    kyc_verified: bool
    nik: Optional[str] = None
    full_name: Optional[str] = None


class KycProfile(BaseModel):
    user_id: str
    email: Optional[str] = None
    nik: Optional[str] = None
    full_name: Optional[str] = None
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
    data_consent_given: bool = False


class KycPrefillData(BaseModel):
    nik: str = ""
    full_name: str = ""
    birth_place: str = ""
    birth_date: str = ""
    gender: str = ""
    address: str = ""
    rt_rw: str = ""
    kelurahan: str = ""
    kecamatan: str = ""
    religion: str = ""
    marital_status: str = ""
    occupation: str = ""
    nationality: str = "WNI"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_sb():
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")
    return sb


def _validate_nik(nik: str) -> str:
    """Validate NIK — must be exactly 16 digits."""
    cleaned = nik.strip()
    if not re.fullmatch(r"\d{16}", cleaned):
        raise HTTPException(
            status_code=422,
            detail="NIK harus tepat 16 digit angka."
        )
    return cleaned


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status", response_model=KycStatus, tags=["KYC"])
async def get_kyc_status(
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """Check if the current user has completed KYC identity verification."""
    sb = _get_sb()
    user_id = str(current_user["id"])

    res = (
        sb.table("profiles")
        .select("kyc_verified, nik, full_name")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []

    if not rows:
        return KycStatus(kyc_verified=False)

    profile = rows[0]
    return KycStatus(
        kyc_verified=bool(profile.get("kyc_verified", False)),
        nik=profile.get("nik"),
        full_name=profile.get("full_name"),
    )


@router.get("/prefill-beta", response_model=KycPrefillData, tags=["KYC"])
async def get_kyc_prefill_beta(
    nik: Optional[str] = Query(None, description="Optional NIK filter for beta prefill"),
    phone: Optional[str] = Query(None, description="Optional phone filter for beta prefill"),
    _: dict = Depends(validate_api_key_full),
):
    """
    Beta helper for initial KYC step.
    Returns starter identity fields and requires a valid x-api-key.
    """
    sb = _get_sb()

    query = (
        sb.table("profiles")
        .select(
            "nik, full_name, birth_place, birth_date, gender, "
            "address, rt_rw, kelurahan, kecamatan, religion, marital_status, occupation, nationality"
        )
        .not_.is_("nik", "null")
        .not_.is_("full_name", "null")
        .limit(1)
    )

    if nik:
        query = query.eq("nik", _validate_nik(nik))
    if phone:
        clean_phone = phone.strip().replace("+62", "0").replace("-", "").replace(" ", "")
        query = query.eq("phone_number", clean_phone)

    res = query.execute()
    rows = getattr(res, "data", None) or []
    if not rows:
        return KycPrefillData()

    p = rows[0]
    return KycPrefillData(
        nik=p.get("nik") or "",
        full_name=p.get("full_name") or "",
        birth_place=p.get("birth_place") or "",
        birth_date=p.get("birth_date") or "",
        gender=p.get("gender") or "",
        address=p.get("address") or "",
        rt_rw=p.get("rt_rw") or "",
        kelurahan=p.get("kelurahan") or "",
        kecamatan=p.get("kecamatan") or "",
        religion=p.get("religion") or "",
        marital_status=p.get("marital_status") or "",
        occupation=p.get("occupation") or "",
        nationality=p.get("nationality") or "WNI",
    )


@router.post("/submit", response_model=KycProfile, tags=["KYC"])
async def submit_kyc(
    nik: str = Form(...),
    full_name: str = Form(...),
    birth_place: str = Form(""),
    birth_date: str = Form(""),
    gender: str = Form(""),
    address: str = Form(""),
    rt_rw: str = Form(""),
    kelurahan: str = Form(""),
    kecamatan: str = Form(""),
    religion: str = Form(""),
    marital_status: str = Form(""),
    occupation: str = Form(""),
    nationality: str = Form("WNI"),
    ktp_photo: UploadFile = File(...),
    selfie_photo: UploadFile = File(...),
    data_consent: str = Form("false"),
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """
    Submit KYC identity verification form.
    Requires KTP photo + selfie photo.
    Once submitted, data is locked (no re-submission).
    """
    sb = _get_sb()
    user_id = str(current_user["id"])
    user_email = current_user.get("email", "")

    # 1. Validate NIK
    validated_nik = _validate_nik(nik)

    # 2. Check if already verified — no double submissions
    existing = (
        sb.table("profiles")
        .select("kyc_verified")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    existing_rows = getattr(existing, "data", None) or []
    if existing_rows and existing_rows[0].get("kyc_verified"):
        raise HTTPException(
            status_code=409,
            detail="KYC sudah terverifikasi. Data tidak bisa diubah."
        )

    # 3. Check NIK uniqueness — no duplicate NIK allowed
    nik_check = (
        sb.table("profiles")
        .select("id")
        .eq("nik", validated_nik)
        .limit(1)
        .execute()
    )
    nik_rows = getattr(nik_check, "data", None) or []
    if nik_rows and nik_rows[0].get("id") != user_id:
        raise HTTPException(
            status_code=409,
            detail="NIK sudah terdaftar di akun lain."
        )

    # 4. Upload KTP photo to ImageKit
    ktp_content = await ktp_photo.read()
    ktp_filename = f"ktp_{user_id}_{ktp_photo.filename}"
    ktp_result = ImageKitService.upload_file(
        file=ktp_content,
        file_name=ktp_filename,
        folder="/kyc/ktp",
    )
    ktp_photo_url = ktp_result.get("url", "")

    # 5. Upload Selfie photo to ImageKit
    selfie_content = await selfie_photo.read()
    selfie_filename = f"selfie_{user_id}_{selfie_photo.filename}"
    selfie_result = ImageKitService.upload_file(
        file=selfie_content,
        file_name=selfie_filename,
        folder="/kyc/selfie",
    )
    selfie_photo_url = selfie_result.get("url", "")

    # 6. Upsert profile with KYC data
    now_iso = datetime.now(timezone.utc).isoformat()
    profile_data = {
        "id": user_id,
        "user_email": user_email,
        "nik": validated_nik,
        "full_name": full_name.strip(),
        "birth_place": birth_place.strip() or None,
        "birth_date": birth_date.strip() or None,
        "gender": gender.strip() or None,
        "address": address.strip() or None,
        "rt_rw": rt_rw.strip() or None,
        "kelurahan": kelurahan.strip() or None,
        "kecamatan": kecamatan.strip() or None,
        "religion": religion.strip() or None,
        "marital_status": marital_status.strip() or None,
        "occupation": occupation.strip() or None,
        "nationality": nationality.strip() or "WNI",
        "ktp_photo_url": ktp_photo_url,
        "selfie_photo_url": selfie_photo_url,
        "kyc_verified": True,
        "kyc_submitted_at": now_iso,
        "data_consent_given": data_consent.lower() == "true",
        "data_consent_at": now_iso if data_consent.lower() == "true" else None,
        "data_consent_version": "v1.0" if data_consent.lower() == "true" else None,
    }

    try:
        sb.table("profiles").upsert(
            profile_data,
            on_conflict="id",
        ).execute()
    except Exception as e:
        print(f"❌ KYC upsert failed: {e}")
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan data KYC: {e}")

    return KycProfile(
        user_id=user_id,
        email=user_email,
        **{k: v for k, v in profile_data.items() if k not in ("id", "user_email")},
    )


@router.get("/profile", response_model=KycProfile, tags=["KYC"])
async def get_kyc_profile(
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """Get the current user's full KYC identity profile."""
    sb = _get_sb()
    user_id = str(current_user["id"])

    res = (
        sb.table("profiles")
        .select("*")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []

    if not rows:
        return KycProfile(user_id=user_id, kyc_verified=False)

    p = rows[0]
    return KycProfile(
        user_id=user_id,
        email=p.get("user_email"),
        nik=p.get("nik"),
        full_name=p.get("full_name"),
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
        kyc_verified=bool(p.get("kyc_verified", False)),
        kyc_submitted_at=p.get("kyc_submitted_at"),
        data_consent_given=bool(p.get("data_consent_given", False)),
    )
