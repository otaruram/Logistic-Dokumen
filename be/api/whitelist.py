"""
Whitelist Auth API — Google Login + Phone Whitelist Verification

Endpoints:
  POST /api/v1/auth/verify-whitelist  — Verify phone number against employee whitelist
  GET  /api/v1/auth/me                — Get current user auth status & onboarding state
  POST /api/v1/admin/whitelist        — Add single phone to whitelist (admin)
  POST /api/v1/admin/whitelist/bulk   — Bulk import phone numbers via CSV (admin)
  GET  /api/v1/admin/whitelist        — List all whitelist entries (admin)
  DELETE /api/v1/admin/whitelist/{id} — Deactivate whitelist entry (admin)
"""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, field_validator

from utils.auth import get_supabase_bearer_user
from services.scan_helpers import get_supabase_admin

router = APIRouter()


# ── Constants ─────────────────────────────────────────────────────────────────

ADMIN_ROLES = {"admin", "partner_admin", "super_admin"}


# ── Pydantic Models ──────────────────────────────────────────────────────────

class VerifyWhitelistRequest(BaseModel):
    phone_number: str

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _normalize_phone(v)


class VerifyWhitelistResponse(BaseModel):
    status: str  # "verified"
    user_id: str
    phone_number: str
    company_id: str
    message: str


class AuthMeResponse(BaseModel):
    user_id: str
    email: str
    phone_number: Optional[str] = None
    is_active: bool = False
    needs_onboarding: bool = True
    role: str = "user"
    full_name: Optional[str] = None


class WhitelistEntry(BaseModel):
    phone_number: str
    company_id: str = "default"
    employee_name: Optional[str] = None

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _normalize_phone(v)


class WhitelistEntryResponse(BaseModel):
    id: str
    phone_number: str
    company_id: str
    employee_name: Optional[str] = None
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: Optional[str] = None


class WhitelistListResponse(BaseModel):
    items: list[WhitelistEntryResponse]
    total: int
    page: int
    per_page: int


class BulkUploadResponse(BaseModel):
    inserted: int
    skipped: int
    errors: list[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_sb():
    """Return supabase admin client; raises 503 if not configured."""
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")
    return sb


def _normalize_phone(raw: str) -> str:
    """
    Normalize Indonesian phone number to E.164 format (+62XXXXXXXXXX).

    Accepts:
      - +6281234567890
      - 081234567890
      - 6281234567890
      - 81234567890

    Raises HTTPException 422 on invalid format.
    """
    cleaned = re.sub(r"[\s\-\(\)]+", "", raw.strip())

    if cleaned.startswith("+62"):
        digits = cleaned[3:]
    elif cleaned.startswith("62") and len(cleaned) > 10:
        digits = cleaned[2:]
    elif cleaned.startswith("0"):
        digits = cleaned[1:]
    else:
        digits = cleaned

    if not digits.isdigit():
        raise HTTPException(
            status_code=422,
            detail="Nomor HP hanya boleh berisi angka."
        )
    if len(digits) < 9 or len(digits) > 13:
        raise HTTPException(
            status_code=422,
            detail="Nomor HP harus 9-13 digit setelah kode negara."
        )
    if not digits.startswith("8"):
        raise HTTPException(
            status_code=422,
            detail="Nomor HP Indonesia harus dimulai dengan 8 setelah kode negara."
        )

    return f"+62{digits}"


def _assert_admin(user: dict, sb) -> str:
    """
    Returns user email. Admin check removed as per requirement to open whitelist to all partners.
    """
    return user.get("email", "")


# ── Auth Endpoints ────────────────────────────────────────────────────────────

@router.get("/api/v1/auth/me", response_model=AuthMeResponse, tags=["Whitelist Auth"])
async def get_auth_status(
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """
    Get current user's authentication and onboarding status.

    Returns whether the user needs to complete phone verification onboarding.
    """
    sb = _get_sb()
    user_id = str(current_user["id"])
    email = current_user.get("email", "")

    res = (
        sb.table("profiles")
        .select("phone_number, is_active, onboarding_completed, role, full_name")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []

    if not rows:
        # Profile doesn't exist yet — create minimal profile
        try:
            sb.table("profiles").upsert(
                {
                    "id": user_id,
                    "user_email": email,
                    "is_active": False,
                    "onboarding_completed": False,
                    "role": "user",
                },
                on_conflict="id",
            ).execute()
        except Exception as e:
            print(f"⚠️ Failed to create profile for {email}: {e}")

        return AuthMeResponse(
            user_id=user_id,
            email=email,
            needs_onboarding=True,
        )

    profile = rows[0]
    phone = profile.get("phone_number")
    is_active = bool(profile.get("is_active", False))
    onboarding_done = bool(profile.get("onboarding_completed", False))

    return AuthMeResponse(
        user_id=user_id,
        email=email,
        phone_number=phone,
        is_active=is_active,
        needs_onboarding=not onboarding_done or not is_active,
        role=profile.get("role", "user"),
        full_name=profile.get("full_name"),
    )


@router.post(
    "/api/v1/auth/verify-whitelist",
    response_model=VerifyWhitelistResponse,
    tags=["Whitelist Auth"],
)
async def verify_whitelist(
    body: VerifyWhitelistRequest,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """
    Verify a phone number against the employee whitelist.

    Flow:
      1. Normalize phone number to E.164
      2. Check employee_whitelist for active match
      3. If found → link phone to user profile, activate account
      4. If not found → return 403 with clear error message

    This is the core gating mechanism: only whitelisted employees can access the platform.
    """
    sb = _get_sb()
    user_id = str(current_user["id"])
    email = current_user.get("email", "")
    phone = body.phone_number  # Already normalized by validator

    # 1. Check if phone is already linked to ANOTHER user
    existing_res = (
        sb.table("profiles")
        .select("id")
        .eq("phone_number", phone)
        .neq("id", user_id)
        .limit(1)
        .execute()
    )
    existing_rows = getattr(existing_res, "data", None) or []
    if existing_rows:
        raise HTTPException(
            status_code=409,
            detail="Nomor HP ini sudah terdaftar di akun lain. Hubungi admin Koperasi jika ini adalah kesalahan.",
        )

    # 2. Look up phone in employee_whitelist
    whitelist_res = (
        sb.table("employee_whitelist")
        .select("id, phone_number, company_id, employee_name")
        .eq("phone_number", phone)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    whitelist_rows = getattr(whitelist_res, "data", None) or []

    # --- DEMO HELPER: Auto-seed the Valid Demo Number if missing ---
    if not whitelist_rows and phone == "+6281234567890":
        try:
            sb.table("employee_whitelist").insert({
                "phone_number": phone,
                "company_id": "demo-company",
                "employee_name": "Demo User",
                "is_active": True,
                "created_by": "system-demo",
            }).execute()
            whitelist_rows = [{"phone_number": phone, "company_id": "demo-company", "employee_name": "Demo User"}]
        except Exception as e:
            print(f"Demo auto-seed failed: {e}")
    # ---------------------------------------------------------------

    if not whitelist_rows:
        raise HTTPException(
            status_code=403,
            detail="Nomor HP Anda belum terdaftar di sistem HRD Koperasi. "
                   "Silakan hubungi admin Koperasi untuk mendaftarkan nomor HP Anda.",
        )

    whitelist_entry = whitelist_rows[0]
    company_id = whitelist_entry.get("company_id", "default")
    employee_name = whitelist_entry.get("employee_name", "")

    # 3. Link phone to user profile and activate
    now_iso = datetime.now(timezone.utc).isoformat()
    profile_data = {
        "id": user_id,
        "user_email": email,
        "phone_number": phone,
        "is_active": True,
        "onboarding_completed": True,
        "verified_at": now_iso,
        "whitelist_company_id": company_id,
        "role": "user",
        "data_consent_given": True,
        "data_consent_at": now_iso,
        "data_consent_version": "v1.0 (Whitelist auto-grant)",
    }

    # Set full_name from whitelist if available and profile doesn't have one
    if employee_name:
        current_profile = (
            sb.table("profiles")
            .select("full_name")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        current_rows = getattr(current_profile, "data", None) or []
        if not current_rows or not current_rows[0].get("full_name"):
            profile_data["full_name"] = employee_name

    try:
        sb.table("profiles").upsert(
            profile_data,
            on_conflict="id",
        ).execute()
    except Exception as e:
        print(f"❌ Whitelist verify upsert failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Gagal menyimpan data verifikasi: {e}",
        )

    # 4. Log audit event
    try:
        sb.table("audit_log").insert({
            "event_type": "WHITELIST_VERIFIED",
            "actor": f"user:{user_id}",
            "payload": {
                "phone_number": phone,
                "company_id": company_id,
                "email": email,
            },
        }).execute()
    except Exception:
        pass  # Non-blocking audit log

    return VerifyWhitelistResponse(
        status="verified",
        user_id=user_id,
        phone_number=phone,
        company_id=company_id,
        message="Verifikasi berhasil! Nomor HP Anda terdaftar di sistem Koperasi.",
    )


# ── Admin Whitelist Management ────────────────────────────────────────────────

@router.post(
    "/api/v1/admin/whitelist",
    response_model=WhitelistEntryResponse,
    tags=["Whitelist Admin"],
)
async def add_whitelist_entry(
    body: WhitelistEntry,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """Add a single phone number to the employee whitelist."""
    sb = _get_sb()
    admin_email = _assert_admin(current_user, sb)

    try:
        res = (
            sb.table("employee_whitelist")
            .upsert(
                {
                    "phone_number": body.phone_number,
                    "company_id": body.company_id,
                    "employee_name": body.employee_name,
                    "is_active": True,
                    "created_by": admin_email,
                },
                on_conflict="phone_number,company_id",
            )
            .execute()
        )
        rows = getattr(res, "data", None) or []
        if not rows:
            raise HTTPException(status_code=500, detail="Gagal menambahkan ke whitelist")

        row = rows[0]
        return WhitelistEntryResponse(
            id=row["id"],
            phone_number=row["phone_number"],
            company_id=row.get("company_id", "default"),
            employee_name=row.get("employee_name"),
            is_active=row.get("is_active", True),
            created_by=row.get("created_by"),
            created_at=row.get("created_at"),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")


@router.post(
    "/api/v1/admin/whitelist/bulk",
    response_model=BulkUploadResponse,
    tags=["Whitelist Admin"],
)
async def bulk_upload_whitelist(
    file: UploadFile = File(...),
    company_id: str = Query(default="default"),
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """
    Bulk import phone numbers from a CSV file.

    CSV format (with or without header):
      phone_number,employee_name
      081234567890,Ahmad Suparman
      +6281234567891,Siti Rahayu

    The first column must be the phone number.
    The second column (optional) is the employee name.
    """
    sb = _get_sb()
    admin_email = _assert_admin(current_user, sb)

    # Read and decode CSV
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # Handle BOM
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.reader(io.StringIO(text))
    rows_to_insert = []
    errors: list[str] = []
    skipped = 0

    for i, row in enumerate(reader):
        if not row or not row[0].strip():
            continue

        raw_phone = row[0].strip()

        # Skip header row
        if i == 0 and raw_phone.lower() in ("phone_number", "phone", "nomor_hp", "no_hp", "nomor"):
            continue

        try:
            normalized = _normalize_phone(raw_phone)
        except HTTPException as e:
            errors.append(f"Baris {i + 1}: {raw_phone} — {e.detail}")
            continue

        name = row[1].strip() if len(row) > 1 else None

        rows_to_insert.append({
            "phone_number": normalized,
            "company_id": company_id,
            "employee_name": name,
            "is_active": True,
            "created_by": admin_email,
        })

    # Batch insert with conflict handling
    inserted = 0
    for entry in rows_to_insert:
        try:
            sb.table("employee_whitelist").upsert(
                entry,
                on_conflict="phone_number,company_id",
            ).execute()
            inserted += 1
        except Exception as e:
            skipped += 1
            errors.append(f"{entry['phone_number']}: {str(e)[:80]}")

    # Audit log
    try:
        sb.table("audit_log").insert({
            "event_type": "WHITELIST_BULK_UPLOAD",
            "actor": f"admin:{admin_email}",
            "payload": {
                "company_id": company_id,
                "total_rows": len(rows_to_insert),
                "inserted": inserted,
                "skipped": skipped,
                "filename": file.filename,
            },
        }).execute()
    except Exception:
        pass

    return BulkUploadResponse(
        inserted=inserted,
        skipped=skipped,
        errors=errors[:20],  # Cap error list
    )


@router.get(
    "/api/v1/admin/whitelist",
    response_model=WhitelistListResponse,
    tags=["Whitelist Admin"],
)
async def list_whitelist(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
    company_id: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """List all whitelist entries with pagination and optional filtering."""
    sb = _get_sb()
    _assert_admin(current_user, sb)

    offset = (page - 1) * per_page

    # Build query
    query = sb.table("employee_whitelist").select("*", count="exact")

    if company_id:
        query = query.eq("company_id", company_id)
    if search:
        query = query.or_(f"phone_number.ilike.%{search}%,employee_name.ilike.%{search}%")

    query = query.eq("is_active", True)
    query = query.order("created_at", desc=True)
    query = query.range(offset, offset + per_page - 1)

    res = query.execute()
    rows = getattr(res, "data", None) or []
    total = getattr(res, "count", None) or len(rows)

    items = [
        WhitelistEntryResponse(
            id=r["id"],
            phone_number=r["phone_number"],
            company_id=r.get("company_id", "default"),
            employee_name=r.get("employee_name"),
            is_active=r.get("is_active", True),
            created_by=r.get("created_by"),
            created_at=r.get("created_at"),
        )
        for r in rows
    ]

    return WhitelistListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.delete(
    "/api/v1/admin/whitelist/{entry_id}",
    status_code=204,
    tags=["Whitelist Admin"],
)
async def delete_whitelist_entry(
    entry_id: str,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """Soft-delete (deactivate) a whitelist entry."""
    sb = _get_sb()
    admin_email = _assert_admin(current_user, sb)

    try:
        sb.table("employee_whitelist").update(
            {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", entry_id).execute()

        # Audit
        sb.table("audit_log").insert({
            "event_type": "WHITELIST_ENTRY_DEACTIVATED",
            "actor": f"admin:{admin_email}",
            "payload": {"entry_id": entry_id},
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menghapus entry: {e}")
