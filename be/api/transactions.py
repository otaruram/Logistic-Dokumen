"""
OtaruChain Transactions API — Aggregated Summary with Duration Filter

Endpoint:
  GET /api/transactions/summary?duration=30d|6m|1y|all
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from models.models import User
from utils.auth import get_current_active_user
from services.scan_helpers import get_supabase_admin

router = APIRouter()


class TransactionSummary(BaseModel):
    duration: str
    duration_label: str
    total_transactions: int
    total_nominal: float
    verified_count: int
    tampered_count: int
    processing_count: int
    avg_nominal: float


DURATION_MAP = {
    "30d": ("30 Days", timedelta(days=30)),
    "6m": ("6 Months", timedelta(days=180)),
    "1y": ("1 Year", timedelta(days=365)),
    "all": ("All Time", None),
}


@router.get("/summary", response_model=TransactionSummary, tags=["Transactions"])
async def get_transaction_summary(
    duration: str = Query(default="all", regex="^(30d|6m|1y|all)$"),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get aggregated transaction summary for the current user,
    filtered by a time duration.
    """
    sa = get_supabase_admin()
    if not sa:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")

    user_id = str(current_user.id)
    label, delta = DURATION_MAP.get(duration, ("All Time", None))

    # Build query with server-side date filtering for efficiency
    query = (
        sa.table("fraud_scans")
        .select("status, nominal_total")
        .eq("user_id", user_id)
    )

    if delta is not None:
        cutoff = (datetime.now(timezone.utc) - delta).isoformat()
        query = query.gte("created_at", cutoff)

    res = query.execute()
    rows = getattr(res, "data", None) or []

    verified = 0
    tampered = 0
    processing = 0
    total_nominal = 0.0

    for r in rows:
        status = r.get("status", "")
        nom = float(r.get("nominal_total") or 0)
        total_nominal += nom

        if status == "verified":
            verified += 1
        elif status == "tampered":
            tampered += 1
        elif status == "processing":
            processing += 1

    total = len(rows)
    avg = total_nominal / total if total > 0 else 0.0

    return TransactionSummary(
        duration=duration,
        duration_label=label,
        total_transactions=total,
        total_nominal=total_nominal,
        verified_count=verified,
        tampered_count=tampered,
        processing_count=processing,
        avg_nominal=round(avg, 2),
    )
