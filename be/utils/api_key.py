"""
Shared API-key validation dependency for FastAPI routes.

Usage:
    from utils.api_key import validate_api_key
    ...
    async def my_route(api_key_owner: str = Depends(validate_api_key)):
        ...

The validate_api_key dependency returns the owning user_id (str).
Use validate_api_key_full to get a dict with {user_id, key_type} for
permission-aware endpoints (partner keys get read_all_users access).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, Header, HTTPException

from services.scan_helpers import get_supabase_admin


def validate_api_key_full(x_api_key: str = Header(..., alias="x-api-key")) -> dict[str, Any]:
    """
    Validate the x-api-key header against the api_keys table.
    Returns dict with ``user_id`` and ``key_type`` on success.
    key_type: 'individual' (self-only) | 'partner' (read_all_users).
    Raises HTTP 401 if invalid/inactive, HTTP 503 if Supabase not configured.
    """
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")

    res = (
        sb.table("api_keys")
        .select("user_id, is_active, key_type")
        .eq("key_value", x_api_key)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not rows[0].get("is_active"):
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")

    # Bump last_used_at (best-effort)
    try:
        sb.table("api_keys").update(
            {"last_used_at": datetime.now(timezone.utc).isoformat()}
        ).eq("key_value", x_api_key).execute()
    except Exception:
        pass

    return {
        "user_id": rows[0]["user_id"],
        "key_type": rows[0].get("key_type") or "individual",
    }


def validate_api_key(x_api_key: str = Header(..., alias="x-api-key")) -> str:
    """
    Backward-compatible wrapper — returns only the user_id string.
    """
    result = validate_api_key_full(x_api_key)
    return result["user_id"]
