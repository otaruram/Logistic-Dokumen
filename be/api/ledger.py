"""
OtaruChain Ledger API — Integrity Verification Endpoints

Endpoints:
  GET  /api/ledger/verify/{scan_id}  — verify a single scan's integrity seal
  GET  /api/ledger/verify-all        — batch verify all user's scans
  POST /api/ledger/seal-existing     — backfill integrity hashes (admin)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from utils.auth import get_current_active_user
from models.models import User
from services.scan_helpers import get_supabase_admin
from services.ledger_service import verify_row_integrity, seal_scan

router = APIRouter()


class VerifyResult(BaseModel):
    scan_id: str
    result: str  # "VERIFIED" | "TAMPERED" | "UNSEALED"
    expected_hash: Optional[str] = None
    actual_hash: Optional[str] = None


class BatchVerifyResult(BaseModel):
    total: int
    verified: int
    tampered: int
    unsealed: int
    integrity_rate: float
    details: list[VerifyResult]


@router.get("/verify/{scan_id}", response_model=VerifyResult, tags=["Ledger"])
async def verify_scan_integrity(
    scan_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Verify the integrity seal of a single fraud scan."""
    sa = get_supabase_admin()
    if not sa:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")

    res = (
        sa.table("fraud_scans")
        .select("*")
        .eq("id", scan_id)
        .eq("user_id", str(current_user.id))
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Scan not found")

    result = verify_row_integrity(rows[0])

    # Log the verification event
    _log_verification(sa, result, str(current_user.id))

    return VerifyResult(**result)


@router.get("/verify-all", response_model=BatchVerifyResult, tags=["Ledger"])
async def verify_all_scans(
    current_user: User = Depends(get_current_active_user),
):
    """Batch verify all fraud scans for the current user."""
    sa = get_supabase_admin()
    if not sa:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")

    res = (
        sa.table("fraud_scans")
        .select("id, user_id, nominal_total, created_at, integrity_hash")
        .eq("user_id", str(current_user.id))
        .order("created_at", desc=True)
        .execute()
    )
    rows = getattr(res, "data", None) or []

    verified_count = 0
    tampered_count = 0
    unsealed_count = 0
    details = []

    for row in rows:
        result = verify_row_integrity(row)
        r = result["result"]
        if r == "VERIFIED":
            verified_count += 1
        elif r == "TAMPERED":
            tampered_count += 1
        else:
            unsealed_count += 1
        details.append(VerifyResult(**result))

    total = len(rows)
    sealed_total = verified_count + tampered_count
    integrity_rate = round((verified_count / sealed_total * 100), 1) if sealed_total > 0 else 0.0

    return BatchVerifyResult(
        total=total,
        verified=verified_count,
        tampered=tampered_count,
        unsealed=unsealed_count,
        integrity_rate=integrity_rate,
        details=details,
    )


@router.post("/seal-existing", tags=["Ledger"])
async def seal_existing_scans(
    current_user: User = Depends(get_current_active_user),
):
    """
    Backfill integrity hashes on existing fraud_scans that don't have one.
    This is safe to run multiple times — it only seals UNSEALED rows.
    """
    sa = get_supabase_admin()
    if not sa:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")

    # Fetch unsealed scans
    res = (
        sa.table("fraud_scans")
        .select("id, user_id, nominal_total, created_at, integrity_hash")
        .eq("user_id", str(current_user.id))
        .is_("integrity_hash", "null")
        .execute()
    )
    rows = getattr(res, "data", None) or []

    sealed_count = 0
    for row in rows:
        result = seal_scan(sa, row)
        if result:
            sealed_count += 1

    return {
        "message": f"Sealed {sealed_count} scan(s)",
        "total_unsealed_found": len(rows),
        "sealed": sealed_count,
    }


def _log_verification(sa, result: dict, user_id: str):
    """Log a verification event to ledger_audit_log (best-effort)."""
    try:
        sa.table("ledger_audit_log").insert({
            "scan_id": result.get("scan_id"),
            "user_id": user_id,
            "result": result.get("result", "UNKNOWN"),
            "expected_hash": result.get("expected_hash"),
            "actual_hash": result.get("actual_hash"),
        }).execute()
    except Exception as e:
        print(f"⚠️ Ledger audit log failed: {e}")
