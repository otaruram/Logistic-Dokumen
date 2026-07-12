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
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from schemas.gamification import (
    BadgeProgress,
    GamificationConfigUpdate,
    AdminRewardToggleBody,
    SILVER_THRESHOLD,
    GOLD_THRESHOLD,
    PLATINUM_THRESHOLD,
    GOLD_INTEREST_DISCOUNT,
    PLATINUM_INTEREST_DISCOUNT,
    GOLD_PLAFON_BONUS,
    PLATINUM_PLAFON_BONUS,
    DEFAULT_GAMIFICATION_CONTEXT,
    DEFAULT_BADGE_BASE_URL,
    DEFAULT_CERT_BASE_URL,
)

from config.settings import settings
from services.scan_helpers import get_supabase_admin
from utils.auth import get_supabase_bearer_user

router = APIRouter(tags=["Gamification"])


from services.gamification_service import (
    _sb,
    _current_month,
    _is_gamification_admin,
    _load_gamification_config,
    _badge_display_name,
    _current_user_id,
    _resolve_user_id_by_email,
    _build_badge_image_url,
    _build_certificate_preview_url,
    _get_monthly_stats,
    _get_existing_badges,
    _upsert_badge,
    check_and_award_badges,
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
    user_id = _current_user_id(current_user)
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


@router.get("/api/v1/gamification/config")
async def get_gamification_config(
    current_user: dict = Depends(get_supabase_bearer_user),
):
    sb = _sb()
    return _load_gamification_config(sb)


@router.put("/api/v1/gamification/admin/config")
async def update_gamification_config(
    body: GamificationConfigUpdate,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    sb = _sb()
    if not _is_gamification_admin(sb, current_user):
        raise HTTPException(status_code=403, detail="Admin access only")

    payload = {
        "id": 1,
        "silver_threshold": max(1, body.silver_threshold),
        "gold_threshold": max(body.silver_threshold + 1, body.gold_threshold),
        "platinum_threshold": max(body.gold_threshold + 1, body.platinum_threshold),
        "gold_interest_discount_pct": max(0.0, body.gold_interest_discount_pct),
        "platinum_interest_discount_pct": max(0.0, body.platinum_interest_discount_pct),
        "gold_plafon_bonus": max(0, body.gold_plafon_bonus),
        "platinum_plafon_bonus": max(0, body.platinum_plafon_bonus),
        "gold_context_tba": body.gold_context_tba.strip() or DEFAULT_GAMIFICATION_CONTEXT["gold"],
        "platinum_context_tba": body.platinum_context_tba.strip() or DEFAULT_GAMIFICATION_CONTEXT["platinum"],
        "badge_base_url": body.badge_base_url.strip() or DEFAULT_BADGE_BASE_URL,
        "certificate_base_url": body.certificate_base_url.strip() or DEFAULT_CERT_BASE_URL,
        "updated_by": current_user.get("email") or current_user.get("id"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    sb.table("gamification_config").upsert(payload, on_conflict="id").execute()
    return {"success": True, "config": payload}


@router.post("/api/v1/gamification/admin/reward/toggle")
async def toggle_user_gamification_reward(
    body: AdminRewardToggleBody,
    current_user: dict = Depends(get_supabase_bearer_user),
):
    sb = _sb()
    if not _is_gamification_admin(sb, current_user):
        raise HTTPException(status_code=403, detail="Admin access only")

    target_user_id = (body.target_user_id or "").strip()
    target_email = (body.target_email or "").strip()
    if not target_user_id and not target_email:
        raise HTTPException(status_code=400, detail="target_user_id atau target_email wajib diisi")

    if not target_user_id and target_email:
        resolved = _resolve_user_id_by_email(sb, target_email)
        if not resolved:
            raise HTTPException(status_code=404, detail="User dengan email tersebut tidak ditemukan")
        target_user_id = resolved

    month = body.month_year or _current_month()
    badge_type = body.badge_type.strip().lower()
    if badge_type not in {"silver_integrity", "gold_integrity", "platinum_integrity"}:
        raise HTTPException(status_code=400, detail="badge_type harus silver_integrity|gold_integrity|platinum_integrity")

    cfg = _load_gamification_config(sb)
    verified_default = {
        "silver_integrity": int(cfg["silver_threshold"]),
        "gold_integrity": int(cfg["gold_threshold"]),
        "platinum_integrity": int(cfg["platinum_threshold"]),
    }

    if body.enabled:
        v_count = body.verified_count if body.verified_count is not None else verified_default[badge_type]
        interest = 0.0
        bonus = 0
        if badge_type == "gold_integrity":
            interest = float(cfg["gold_interest_discount_pct"])
            bonus = int(cfg["gold_plafon_bonus"])
        elif badge_type == "platinum_integrity":
            interest = float(cfg["platinum_interest_discount_pct"])
            bonus = int(cfg["platinum_plafon_bonus"])

        _upsert_badge(
            sb,
            target_user_id,
            month,
            badge_type,
            max(0, int(v_count)),
            tampered_count=0,
            interest_discount=interest,
            plafon_bonus=bonus,
        )
        action = "grant"
    else:
        sb.table("gamification_badges").delete().eq("user_id", target_user_id).eq("month_year", month).eq("badge_type", badge_type).execute()
        action = "revoke"

    try:
        sb.table("gamification_admin_actions").insert(
            {
                "admin_user_id": str(current_user.get("id") or current_user.get("sub") or ""),
                "admin_email": current_user.get("email"),
                "target_user_id": target_user_id,
                "month_year": month,
                "badge_type": badge_type,
                "action": action,
                "reason": body.reason,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
    except Exception:
        # Table is optional; do not block the action.
        pass

    progress = check_and_award_badges(target_user_id, month)
    return {
        "success": True,
        "action": action,
        "target_user_id": target_user_id,
        "target_email": target_email or None,
        "progress": progress,
    }


@router.get("/api/v1/gamification/rewards/gallery")
async def get_reward_gallery(
    current_user: dict = Depends(get_supabase_bearer_user),
):
    sb = _sb()
    user_id = str(current_user.get("id") or current_user.get("sub"))
    cfg = _load_gamification_config(sb)
    res = (
        sb.table("gamification_badges")
        .select("badge_type, month_year, verified_count, unlocked_at, interest_discount_pct, plafon_bonus")
        .eq("user_id", user_id)
        .order("month_year", desc=True)
        .limit(24)
        .execute()
    )
    rows = getattr(res, "data", None) or []

    items: list[dict[str, Any]] = []
    for row in rows:
        badge_type = str(row.get("badge_type") or "silver_integrity")
        month_year = str(row.get("month_year") or "")
        display = _badge_display_name(badge_type)
        items.append(
            {
                "badge_type": badge_type,
                "badge_label": display,
                "month_year": month_year,
                "verified_count": int(row.get("verified_count") or 0),
                "interest_discount_pct": float(row.get("interest_discount_pct") or 0),
                "plafon_bonus": int(row.get("plafon_bonus") or 0),
                "unlocked_at": row.get("unlocked_at"),
                "badge_image_url": _build_badge_image_url(cfg, badge_type, month_year),
                "certificate_preview_url": _build_certificate_preview_url(cfg, badge_type, month_year),
                "certificate_pdf_url": f"/api/v1/gamification/certificate/{month_year}",
            }
        )

    return {
        "items": items,
        "gold_context_tba": cfg.get("gold_context_tba") or DEFAULT_GAMIFICATION_CONTEXT["gold"],
        "platinum_context_tba": cfg.get("platinum_context_tba") or DEFAULT_GAMIFICATION_CONTEXT["platinum"],
    }
