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

import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel

from models.models import User
from utils.auth import get_current_active_user

router = APIRouter()

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_sb():
    """Return a supabase_admin client; raises 503 if not configured."""
    try:
        from services.scan_helpers import get_supabase_admin  # lazy import
        sb = get_supabase_admin()
        if not sb:
            raise HTTPException(status_code=503, detail="Supabase admin not configured")
        return sb
    except ImportError:
        # Fallback: build directly from env
        import os
        from supabase import create_client
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key:
            raise HTTPException(status_code=503, detail="Supabase admin not configured")
        return create_client(url, key)


def _validate_api_key(x_api_key: str = Header(..., alias="x-api-key")) -> str:
    """
    Dependency: validates the x-api-key header.
    Returns the owner's user_id (UUID string) on success.
    """
    sb = _get_sb()
    res = (
        sb.table("api_keys")
        .select("user_id, is_active")
        .eq("key_value", x_api_key)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not rows[0].get("is_active"):
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    # Bump last_used_at (best-effort, ignore errors)
    try:
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()
        sb.table("api_keys").update({"last_used_at": now_iso}).eq("key_value", x_api_key).execute()
    except Exception:
        pass
    return rows[0]["user_id"]


# ---------------------------------------------------------------------------
# API Key Management (authenticated endpoints)
# ---------------------------------------------------------------------------

class ApiKeyOut(BaseModel):
    key_value: str
    name: str
    is_active: bool
    created_at: str
    last_used_at: Optional[str] = None


@router.post("/api/v1/apikeys/generate", response_model=ApiKeyOut, tags=["Partner"])
async def generate_api_key(
    current_user: User = Depends(get_current_active_user),
):
    """
    Generate (or rotate) the caller's API key.
    Only one active key per user — calling again rotates the key.
    """
    sb = _get_sb()
    new_key = "sk-" + secrets.token_urlsafe(32)

    # Deactivate existing keys first
    sb.table("api_keys").update({"is_active": False}).eq("user_id", str(current_user.id)).execute()

    # Insert new key
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    res = (
        sb.table("api_keys")
        .insert({
            "user_id": str(current_user.id),
            "key_value": new_key,
            "name": "Default Key",
            "is_active": True,
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
    current_user: User = Depends(get_current_active_user),
):
    """Return the caller's active API key, or null if none."""
    sb = _get_sb()
    res = (
        sb.table("api_keys")
        .select("key_value, name, is_active, created_at, last_used_at")
        .eq("user_id", str(current_user.id))
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
    current_user: User = Depends(get_current_active_user),
):
    """Revoke all active API keys for the caller."""
    sb = _get_sb()
    sb.table("api_keys").update({"is_active": False}).eq("user_id", str(current_user.id)).execute()


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


class ScoringResponse(BaseModel):
    email: str
    user_id: str
    trust_score: int
    risk_label: str          # "PRIME" | "MODERATE" | "RISK"
    total_scans: int
    verified_scans: int
    tampered_scans: int
    total_nominal: float
    recent_scans: list[ScanSummary]


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

    # 1. Resolve email → user_id via profiles table
    profile_res = (
        sb.table("profiles")
        .select("id, user_email")
        .eq("user_email", email)
        .limit(1)
        .execute()
    )
    profiles = getattr(profile_res, "data", None) or []

    # Fallback: try auth.users view (service-role only)
    if not profiles:
        # Try looking up by email in fraud_scans indirectly — no direct email in fraud_scans.
        # We cannot query auth.users from supabase-py easily; return 404.
        raise HTTPException(status_code=404, detail=f"User with email '{email}' not found")

    user_id = profiles[0]["id"]

    # 2. Fetch fraud_scans for this user
    scans_res = (
        sb.table("fraud_scans")
        .select("id, status, nominal_total, vendor_name, doc_type, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    all_scans = getattr(scans_res, "data", None) or []

    total = len(all_scans)
    verified = sum(1 for s in all_scans if s.get("status") == "verified")
    tampered = sum(1 for s in all_scans if s.get("status") == "tampered")
    total_nominal = sum((s.get("nominal_total") or 0) for s in all_scans if s.get("status") == "verified")

    # 3. Trust score from Supabase function (best-effort)
    trust_score = 0
    try:
        fn_res = sb.rpc("calculate_logistics_trust_score", {"p_user_id": user_id}).execute()
        fn_data = getattr(fn_res, "data", None)
        if fn_data is not None:
            trust_score = int(fn_data)
    except Exception:
        # Compute a basic fallback score
        if total > 0:
            trust_score = min(int((verified / total) * 800), 800)

    # 4. Risk label
    if tampered == 0:
        risk_label = "PRIME"
    elif tampered <= 2:
        risk_label = "MODERATE"
    else:
        risk_label = "RISK"

    # 5. Recent scans (capped by limit)
    recent = []
    for s in all_scans[:limit]:
        recent.append(ScanSummary(
            scan_id=s.get("id", ""),
            status=s.get("status", ""),
            nominal_total=s.get("nominal_total"),
            vendor_name=s.get("vendor_name"),
            doc_type=s.get("doc_type"),
            created_at=s.get("created_at", ""),
        ))

    return ScoringResponse(
        email=email,
        user_id=user_id,
        trust_score=trust_score,
        risk_label=risk_label,
        total_scans=total,
        verified_scans=verified,
        tampered_scans=tampered,
        total_nominal=total_nominal,
        recent_scans=recent,
    )
