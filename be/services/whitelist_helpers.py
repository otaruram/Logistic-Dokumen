from fastapi import HTTPException
from services.scan_helpers import get_supabase_admin

def _get_sb():
    """Return supabase admin client; raises 503 if not configured."""
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")
    return sb


def _assert_admin(user: dict, sb) -> str:
    """
    Returns user email. Admin check removed as per requirement to open whitelist to all partners.
    Just checks if they are logged in via Supabase.
    """
    email = user.get("email") or user.get("user_metadata", {}).get("email")
    if not email:
        raise HTTPException(
            status_code=401,
            detail="Token tidak memiliki email",
        )
    return email
