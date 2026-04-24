"""
OtaruChain Partner Audit API — Comprehensive User Audit Endpoint

Endpoint:
  GET /api/partner/v1/user-audit/{email}
  Header: x-api-key: sk-xxxx

Returns a comprehensive JSON containing:
- Log History
- Lifetime Credit Score + Current Cycle Score
- Total Transactions (by period)
- Risk Level (Probability of Default)
- Integrity Seal Status
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from pydantic import BaseModel

from services.scan_helpers import get_supabase_admin
from services.scoring_service import get_scoring_summary, compute_and_sync_cycles
from services.risk_service import calculate_risk_level
from services.ledger_service import verify_row_integrity

router = APIRouter()


# ── API Key validation (reuse from partner.py) ────────────────────────────────

def _validate_api_key(x_api_key: str = Header(..., alias="x-api-key")) -> str:
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")
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
    # Bump last_used_at
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        sb.table("api_keys").update({"last_used_at": now_iso}).eq("key_value", x_api_key).execute()
    except Exception:
        pass
    return rows[0]["user_id"]


# ── Response Models ───────────────────────────────────────────────────────────

class CreditScoreInfo(BaseModel):
    current_cycle: int
    current_cycle_score: int
    cycle_max: int
    lifetime_score: int
    completed_cycles: int


class RiskInfo(BaseModel):
    risk_level: str
    risk_score: int
    factors: list[dict]


class PeriodSummary(BaseModel):
    count: int
    nominal: float


class TransactionInfo(BaseModel):
    total: int
    verified: int
    tampered: int
    processing: int
    total_nominal: float
    by_period: dict[str, PeriodSummary]


class IntegrityInfo(BaseModel):
    total_sealed: int
    verified_seals: int
    tampered_seals: int
    unsealed: int
    integrity_rate: float


class AuditLogEntry(BaseModel):
    scan_id: str
    status: str
    nominal: float
    doc_type: Optional[str] = None
    vendor_name: Optional[str] = None
    created_at: str
    integrity_status: str


class UserInfo(BaseModel):
    email: str
    user_id: str


class AuditResponse(BaseModel):
    user: UserInfo
    credit_score: CreditScoreInfo
    risk: RiskInfo
    transactions: TransactionInfo
    integrity: IntegrityInfo
    audit_log: list[AuditLogEntry]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_email_to_uid(sb, email: str) -> str:
    """Resolve an email to a Supabase user_id."""
    profile_res = (
        sb.table("profiles")
        .select("id, user_email")
        .eq("user_email", email)
        .limit(1)
        .execute()
    )
    profiles = getattr(profile_res, "data", None) or []
    if profiles:
        return profiles[0]["id"]

    # Fallback: search auth.users
    try:
        page = 1
        while True:
            resp = sb.auth.admin.list_users(page=page, per_page=50)
            user_list = resp if isinstance(resp, list) else getattr(resp, "users", []) or []
            if not user_list:
                break
            for u in user_list:
                u_email = getattr(u, "email", None) or (u.get("email") if isinstance(u, dict) else None)
                u_id = getattr(u, "id", None) or (u.get("id") if isinstance(u, dict) else None)
                if u_email and u_email.lower() == email.lower() and u_id:
                    uid = str(u_id)
                    # Backfill profile
                    try:
                        sb.table("profiles").upsert(
                            {"id": uid, "user_email": u_email},
                            on_conflict="id",
                        ).execute()
                    except Exception:
                        pass
                    return uid
            if len(user_list) < 50:
                break
            page += 1
    except Exception:
        pass

    raise HTTPException(status_code=404, detail=f"User with email '{email}' not found")


def _get_period_summary(scans: list, days: Optional[int] = None) -> PeriodSummary:
    """Aggregate scans within a time period."""
    now = datetime.now(timezone.utc)
    count = 0
    nominal = 0.0

    for s in scans:
        if days is not None:
            ca = s.get("created_at", "")
            try:
                if ca.endswith("Z"):
                    ca = ca[:-1] + "+00:00"
                dt = datetime.fromisoformat(ca)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if (now - dt).days > days:
                    continue
            except (ValueError, TypeError):
                continue
        count += 1
        nominal += float(s.get("nominal_total") or 0)

    return PeriodSummary(count=count, nominal=nominal)


# ── Main Endpoint ─────────────────────────────────────────────────────────────

@router.get(
    "/api/partner/v1/user-audit/{email}",
    response_model=AuditResponse,
    tags=["Partner Audit"],
)
async def get_user_audit(
    email: str,
    limit: int = Query(default=50, ge=1, le=200),
    api_key_owner: str = Depends(_validate_api_key),
):
    """
    Comprehensive user audit for banking partners.
    Requires a valid API key via x-api-key header.
    """
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")

    # 1. Resolve email → user_id
    user_id = _resolve_email_to_uid(sb, email)

    # 2. Fetch all fraud_scans
    scans_res = (
        sb.table("fraud_scans")
        .select("id, user_id, status, nominal_total, nama_klien, doc_type, created_at, integrity_hash")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    all_scans = getattr(scans_res, "data", None) or []

    # 3. Credit Score with Cycles
    trust_score = 0
    try:
        fn_res = sb.rpc("calculate_logistics_trust_score", {"p_user_id": user_id}).execute()
        fn_data = getattr(fn_res, "data", None)
        if fn_data is not None:
            trust_score = int(fn_data)
    except Exception:
        total = len(all_scans)
        verified = sum(1 for s in all_scans if s.get("status") == "verified")
        if total > 0:
            trust_score = min(int((verified / total) * 800), 800)

    try:
        cycle_data = compute_and_sync_cycles(user_id, trust_score)
    except Exception as e:
        print(f"⚠️ Cycle scoring fallback: {e}")
        cycle_data = {}

    credit_score = CreditScoreInfo(
        current_cycle=cycle_data.get("current_cycle", 1),
        current_cycle_score=cycle_data.get("current_cycle_score", trust_score),
        cycle_max=cycle_data.get("cycle_max", 1000),
        lifetime_score=cycle_data.get("lifetime_score", trust_score),
        completed_cycles=cycle_data.get("completed_cycles", 0),
    )

    # 4. Risk Assessment
    try:
        risk_data = calculate_risk_level(user_id)
    except Exception as e:
        print(f"⚠️ Risk calculation fallback: {e}")
        risk_data = {"risk_level": "MEDIUM", "risk_score": 50, "factors": []}

    risk = RiskInfo(
        risk_level=risk_data.get("risk_level", "MEDIUM"),
        risk_score=risk_data.get("risk_score", 50),
        factors=risk_data.get("factors", []),
    )

    # 5. Transactions by period
    verified_count = sum(1 for s in all_scans if s.get("status") == "verified")
    tampered_count = sum(1 for s in all_scans if s.get("status") == "tampered")
    processing_count = sum(1 for s in all_scans if s.get("status") == "processing")
    total_nominal = sum(float(s.get("nominal_total") or 0) for s in all_scans)

    transactions = TransactionInfo(
        total=len(all_scans),
        verified=verified_count,
        tampered=tampered_count,
        processing=processing_count,
        total_nominal=total_nominal,
        by_period={
            "30d": _get_period_summary(all_scans, 30),
            "6m": _get_period_summary(all_scans, 180),
            "1y": _get_period_summary(all_scans, 365),
            "all": _get_period_summary(all_scans, None),
        },
    )

    # 6. Integrity check
    sealed = 0
    verified_seals = 0
    tampered_seals = 0
    unsealed = 0

    for s in all_scans:
        try:
            v = verify_row_integrity(s)
            r = v["result"]
        except Exception as e:
            print(f"⚠️ Integrity check fallback: {e}")
            r = "UNSEALED"

        if r == "VERIFIED":
            sealed += 1
            verified_seals += 1
        elif r == "TAMPERED":
            sealed += 1
            tampered_seals += 1
        else:
            unsealed += 1

    total_sealed = verified_seals + tampered_seals
    integrity_rate = round((verified_seals / total_sealed * 100), 1) if total_sealed > 0 else 0.0

    integrity = IntegrityInfo(
        total_sealed=total_sealed,
        verified_seals=verified_seals,
        tampered_seals=tampered_seals,
        unsealed=unsealed,
        integrity_rate=integrity_rate,
    )

    # 7. Audit log (capped by limit)
    audit_log = []
    for s in all_scans[:limit]:
        try:
            v = verify_row_integrity(s)
            res_status = v["result"]
        except Exception:
            res_status = "UNSEALED"

        audit_log.append(AuditLogEntry(
            scan_id=str(s.get("id", "")),
            status=s.get("status", ""),
            nominal=float(s.get("nominal_total") or 0),
            doc_type=s.get("doc_type"),
            vendor_name=s.get("nama_klien"),
            created_at=s.get("created_at", ""),
            integrity_status=res_status,
        ))

    return AuditResponse(
        user=UserInfo(email=email, user_id=user_id),
        credit_score=credit_score,
        risk=risk,
        transactions=transactions,
        integrity=integrity,
        audit_log=audit_log,
    )
