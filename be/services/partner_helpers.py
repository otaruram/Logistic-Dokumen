from fastapi import HTTPException
from services.scan_helpers import get_supabase_admin
import hashlib

def _get_sb():
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Database not configured")
    return sb


def _assert_api_key_owner(target_user_id: str, api_key_owner: str, *, key_type: str = "individual") -> None:
    if key_type == "partner":
        return
    if target_user_id != api_key_owner:
        raise HTTPException(
            status_code=403, 
            detail="Forbidden. Individual API keys can only access their own data. Use a Partner API Key for wider access."
        )


def _validate_nik(nik: str) -> str:
    if not nik or not nik.isdigit() or len(nik) != 16:
        raise HTTPException(status_code=400, detail="Invalid NIK. Must be exactly 16 digits.")
    return nik


def _validate_phone(phone: str) -> str:
    if not phone or not phone.isdigit() or len(phone) < 10 or len(phone) > 13:
        raise HTTPException(status_code=400, detail="Invalid Phone. Must be 10-13 digits.")
    return phone


def _deduct_credit_for_api_key_owner(sb, api_key_owner: str) -> None:
    """Find user profile by id and deduct 1 partner_api_credits."""
    try:
        res = sb.table("profiles").select("id, partner_api_credits").eq("id", api_key_owner).limit(1).execute()
        rows = getattr(res, "data", None) or []
        if not rows:
            return  # Can't find profile to deduct
        
        owner_uid = rows[0]["id"]
        current = int(rows[0].get("partner_api_credits") or 0)
        
        if current <= 0:
            raise HTTPException(status_code=402, detail="Kredit API Partner habis. Upgrade plan untuk melanjutkan.")
        sb.table("profiles").update({"partner_api_credits": current - 1}).eq("id", owner_uid).execute()
    except HTTPException:
        raise
    except Exception:
        pass  # Non-blocking credit deduction


def _decision_api_key_owner_label(current_user: dict) -> str:
    return str(current_user.get("email") or current_user.get("user_metadata", {}).get("email") or "partner")


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
        
        try:
            check = sb.table("profiles").select("id").eq("phone_number", candidate).limit(1).execute()
            if not getattr(check, "data", None):
                return candidate, "autofilled"
        except Exception:
            pass
            
    return "08" + str(int(hashlib.sha256(user_id.encode()).hexdigest()[:15], 16) % 10_000_000_000).zfill(10), "autofilled_fallback"


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
            rows = getattr(prof_res2, "data", None) or []

    if not rows:
        raise HTTPException(status_code=404, detail="User not found for this phone number")
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
            
    # Remove sensitive URLs
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
