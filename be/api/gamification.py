"""
Gamification API — Operational Consistency & Gold Integrity Badge

Badge logic:
  - Track verified invoices/receipts per calendar month from fraud_scans.
  - 10+ verified  → Silver Integrity badge
  - 20+ verified  → Gold Integrity badge → 0.5% interest discount + plafon bonus

Usage:
    from api.gamification import router
    app.include_router(router)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from services.scan_helpers import get_supabase_admin
from utils.auth import get_supabase_bearer_user

router = APIRouter(tags=["Gamification"])

SILVER_THRESHOLD = 50
GOLD_THRESHOLD = 150
PLATINUM_THRESHOLD = 250

GOLD_INTEREST_DISCOUNT = 0.0
PLATINUM_INTEREST_DISCOUNT = 0.0
GOLD_PLAFON_BONUS = 0
PLATINUM_PLAFON_BONUS = 0


class BadgeProgress(BaseModel):
    user_id: str
    month_year: str
    verified_count: int
    silver_threshold: int = SILVER_THRESHOLD
    gold_threshold: int = GOLD_THRESHOLD
    platinum_threshold: int = PLATINUM_THRESHOLD
    has_silver: bool = False
    has_gold: bool = False
    has_platinum: bool = False
    silver_unlocked_at: str | None = None
    gold_unlocked_at: str | None = None
    platinum_unlocked_at: str | None = None
    interest_discount_pct: float = 0.0
    plafon_bonus: int = 0
    progress_pct: float = 0.0   # progress toward platinum (0-100)
    tampered_this_month: int = 0
    streak_broken: bool = False


def _sb():
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")
    return sb


def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _get_monthly_stats(sb, user_id: str, month_year: str) -> dict:
    """Count verified and tampered fraud_scans for a user in a given month."""
    start = f"{month_year}-01T00:00:00Z"
    # Calculate end of month
    y, m = month_year.split("-")
    m_int = int(m)
    if m_int == 12:
        end = f"{int(y)+1}-01-01T00:00:00Z"
    else:
        end = f"{y}-{m_int+1:02d}-01T00:00:00Z"

    # Get Verified
    res_v = (
        sb.table("fraud_scans")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("status", "verified")
        .eq("admin_reviewed", True)
        .gte("created_at", start)
        .lt("created_at", end)
        .execute()
    )
    v_count = getattr(res_v, "count", None) or len(getattr(res_v, "data", None) or [])
    
    # Legacy fallback: also count old docs that have reviewed_at but no admin_reviewed flag
    res_legacy = (
        sb.table("fraud_scans")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("status", "verified")
        .is_("admin_reviewed", "null")
        .not_.is_("reviewed_at", "null")
        .gte("created_at", start)
        .lt("created_at", end)
        .execute()
    )
    v_count += getattr(res_legacy, "count", None) or len(getattr(res_legacy, "data", None) or [])
    
    res_t = (
        sb.table("fraud_scans")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("status", "tampered")
        .eq("admin_reviewed", True)
        .gte("created_at", start)
        .lt("created_at", end)
        .execute()
    )
    t_count = getattr(res_t, "count", None) or len(getattr(res_t, "data", None) or [])
    
    # Also count from OtaruFinancial (loan_requests) which uses 'nik'
    prof_res = sb.table("profiles").select("nik").eq("id", user_id).limit(1).execute()
    prof_rows = getattr(prof_res, "data", None) or []
    if prof_rows and prof_rows[0].get("nik"):
        nik = prof_rows[0]["nik"]
        res_fin_v = (
            sb.table("loan_requests")
            .select("id", count="exact")
            .eq("nik", nik)
            .eq("status", "APPROVED")
            .gte("submitted_at", start)
            .lt("submitted_at", end)
            .execute()
        )
        v_count += getattr(res_fin_v, "count", None) or len(getattr(res_fin_v, "data", None) or [])
        
        res_fin_t = (
            sb.table("loan_requests")
            .select("id", count="exact")
            .eq("nik", nik)
            .eq("status", "REJECTED")
            .gte("submitted_at", start)
            .lt("submitted_at", end)
            .execute()
        )
        t_count += getattr(res_fin_t, "count", None) or len(getattr(res_fin_t, "data", None) or [])
    
    return {"verified": v_count, "tampered": t_count}


def _get_existing_badges(sb, user_id: str, month_year: str) -> dict[str, Any]:
    """Get existing badge records for this user+month."""
    res = (
        sb.table("gamification_badges")
        .select("*")
        .eq("user_id", user_id)
        .eq("month_year", month_year)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    badges: dict[str, Any] = {}
    for r in rows:
        badges[r["badge_type"]] = r
    return badges


def _upsert_badge(
    sb,
    user_id: str,
    month_year: str,
    badge_type: str,
    verified_count: int,
    tampered_count: int = 0,
    interest_discount: float = 0.0,
    plafon_bonus: int = 0,
) -> None:
    """Insert or update a badge record."""
    sb.table("gamification_badges").upsert(
        {
            "user_id": user_id,
            "badge_type": badge_type,
            "month_year": month_year,
            "verified_count": verified_count,
            "tampered_count": tampered_count,
            "unlocked_at": datetime.now(timezone.utc).isoformat(),
            "interest_discount_pct": interest_discount,
            "plafon_bonus": plafon_bonus,
        },
        on_conflict="user_id,month_year,badge_type",
    ).execute()


def check_and_award_badges(user_id: str, month_year: str | None = None) -> BadgeProgress:
    """
    Check the user's verified upload count for a month and award badges.
    Called after every successful fraud scan or on-demand.
    Enforces zero-tolerance rule: 1 tampered doc blocks new badges for the month.
    """
    sb = _sb()
    month = month_year or _current_month()
    stats = _get_monthly_stats(sb, user_id, month)
    verified_count = stats["verified"]
    tampered_count = stats["tampered"]
    existing = _get_existing_badges(sb, user_id, month)

    has_silver = "silver_integrity" in existing
    has_gold = "gold_integrity" in existing
    has_platinum = "platinum_integrity" in existing
    
    streak_broken = tampered_count > 0

    # If streak not broken, award badges
    if not streak_broken:
        # Award Silver
        if verified_count >= SILVER_THRESHOLD and not has_silver:
            _upsert_badge(sb, user_id, month, "silver_integrity", verified_count, tampered_count)
            has_silver = True

        # Award Gold
        if verified_count >= GOLD_THRESHOLD and not has_gold:
            _upsert_badge(
                sb, user_id, month, "gold_integrity", verified_count, tampered_count,
            )
            has_gold = True
                
        # Award Platinum
        if verified_count >= PLATINUM_THRESHOLD and not has_platinum:
            _upsert_badge(
                sb, user_id, month, "platinum_integrity", verified_count, tampered_count,
            )
            has_platinum = True
    else:
        # If tampered, update existing badges with tampered count as penalty audit
        for b_type, b_data in existing.items():
            if int(b_data.get("tampered_count") or 0) < tampered_count:
                sb.table("gamification_badges").update({"tampered_count": tampered_count}).eq("id", b_data["id"]).execute()

    # Refresh existing badges for response
    existing = _get_existing_badges(sb, user_id, month)
    silver_unlocked_at = existing.get("silver_integrity", {}).get("unlocked_at")
    gold_unlocked_at = existing.get("gold_integrity", {}).get("unlocked_at")
    platinum_unlocked_at = existing.get("platinum_integrity", {}).get("unlocked_at")

    progress = min(100.0, round((verified_count / PLATINUM_THRESHOLD) * 100, 1))

    current_discount = 0.0
    current_bonus = 0
    if "platinum_integrity" in existing:
        current_discount = PLATINUM_INTEREST_DISCOUNT
        current_bonus = PLATINUM_PLAFON_BONUS
    elif "gold_integrity" in existing:
        current_discount = GOLD_INTEREST_DISCOUNT
        current_bonus = GOLD_PLAFON_BONUS

    return BadgeProgress(
        user_id=user_id,
        month_year=month,
        verified_count=verified_count,
        has_silver="silver_integrity" in existing,
        has_gold="gold_integrity" in existing,
        has_platinum="platinum_integrity" in existing,
        silver_unlocked_at=silver_unlocked_at,
        gold_unlocked_at=gold_unlocked_at,
        platinum_unlocked_at=platinum_unlocked_at,
        interest_discount_pct=current_discount,
        plafon_bonus=current_bonus,
        progress_pct=progress,
        tampered_this_month=tampered_count,
        streak_broken=streak_broken,
    )

@router.get("/api/v1/gamification/certificate/{month_year}", tags=["Gamification"])
async def download_integrity_certificate(
    month_year: str,
    current_user: dict = Depends(get_supabase_bearer_user)
):
    """
    Download the digital integrity certificate for a specific month.
    Requires at least a SILVER badge.
    """
    user_id = current_user["sub"]
    sb = _sb()
    
    # 1. Check if user has a badge for this month
    existing = _get_existing_badges(sb, user_id, month_year)
    if not existing:
        raise HTTPException(status_code=404, detail="Tidak ada Integrity Badge untuk bulan ini.")
        
    badge_tier = None
    if "platinum_integrity" in existing:
        badge_tier = "PLATINUM"
    elif "gold_integrity" in existing:
        badge_tier = "GOLD"
    elif "silver_integrity" in existing:
        badge_tier = "SILVER"
        
    if not badge_tier:
        raise HTTPException(status_code=404, detail="Badge tidak memenuhi syarat sertifikat.")
        
    badge_data = existing.get(f"{badge_tier.lower()}_integrity", {})
    verified_count = badge_data.get("verified_count", 0)
    
    # 2. Get Otaru Index from financial metrics if exists
    try:
        fin_res = sb.table("financial_metrics").select("otaru_index").eq("user_id", user_id).limit(1).execute()
        fin_rows = getattr(fin_res, "data", None) or []
        otaru_index = fin_rows[0].get("otaru_index") if fin_rows else 500
    except Exception:
        otaru_index = 500
        
    # 3. Generate certificate
    from services.certificate_service import issue_integrity_certificate
    
    try:
        hash_val, pdf_bytes = issue_integrity_certificate(
            sb=sb,
            user_id=user_id,
            badge_tier=badge_tier,
            month_year=month_year,
            verified_count=verified_count,
            otaru_index=otaru_index
        )
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="Otaru_Integrity_Certificate_{month_year}.pdf"'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal generate sertifikat: {e}")


# ── API Routes ────────────────────────────────────────────────────────────────

@router.get("/api/v1/gamification/progress", response_model=BadgeProgress)
async def get_badge_progress(
    month: str | None = None,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """
    Get the current user's gamification progress for a given month.
    If month is not provided, defaults to current month.
    """
    return check_and_award_badges(str(current_user["id"]), month)


@router.get("/api/v1/gamification/badges")
async def list_all_badges(
    current_user: dict = Depends(get_supabase_bearer_user),
):
    """List all badges ever earned by the current user."""
    sb = _sb()
    res = (
        sb.table("gamification_badges")
        .select("*")
        .eq("user_id", str(current_user["id"]))
        .order("month_year", desc=True)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    return {"badges": rows}
