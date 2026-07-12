import re
from typing import Optional
from pydantic import BaseModel, field_validator

def _normalize_phone(raw: str) -> str:
    """
    Normalize Indonesian phone number to E.164 format (+62XXXXXXXXXX).
    Raises ValueError on invalid format.
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
        raise ValueError("Nomor HP hanya boleh berisi angka.")
    if len(digits) < 9 or len(digits) > 13:
        raise ValueError("Nomor HP harus 9-13 digit setelah kode negara.")
    if not digits.startswith("8"):
        raise ValueError("Nomor HP Indonesia harus dimulai dengan 8 setelah kode negara.")

    return f"+62{digits}"


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
