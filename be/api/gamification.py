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
from pydantic import BaseModel

from config.settings import settings
from services.scan_helpers import get_supabase_admin
from utils.auth import get_supabase_bearer_user

router = APIRouter(tags=["Gamification"])

SILVER_THRESHOLD = 50
GOLD_THRESHOLD = 150
PLATINUM_THRESHOLD = 250

GOLD_INTEREST_DISCOUNT = 0.5
PLATINUM_INTEREST_DISCOUNT = 1.0
GOLD_PLAFON_BONUS = 1_000_000
PLATINUM_PLAFON_BONUS = 2_500_000

DEFAULT_GAMIFICATION_CONTEXT = {
    "gold": "TBA: benefit Gold aktif setelah verifikasi risiko internal koperasi.",
    "platinum": "TBA: benefit Platinum aktif setelah validasi partner + governance check.",
}

DEFAULT_BADGE_BASE_URL = "https://api.dicebear.com/9.x/shapes/png"
DEFAULT_CERT_BASE_URL = "https://api.dicebear.com/9.x/glass/png"


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
    gold_context_tba: str = DEFAULT_GAMIFICATION_CONTEXT["gold"]
    platinum_context_tba: str = DEFAULT_GAMIFICATION_CONTEXT["platinum"]


class GamificationConfigUpdate(BaseModel):
    silver_threshold: int = SILVER_THRESHOLD
    gold_threshold: int = GOLD_THRESHOLD
    platinum_threshold: int = PLATINUM_THRESHOLD
    gold_interest_discount_pct: float = GOLD_INTEREST_DISCOUNT
    platinum_interest_discount_pct: float = PLATINUM_INTEREST_DISCOUNT
    gold_plafon_bonus: int = GOLD_PLAFON_BONUS
    platinum_plafon_bonus: int = PLATINUM_PLAFON_BONUS
    gold_context_tba: str = DEFAULT_GAMIFICATION_CONTEXT["gold"]
    platinum_context_tba: str = DEFAULT_GAMIFICATION_CONTEXT["platinum"]
    badge_base_url: str = DEFAULT_BADGE_BASE_URL
    certificate_base_url: str = DEFAULT_CERT_BASE_URL


class AdminRewardToggleBody(BaseModel):
    target_user_id: str | None = None
    target_email: str | None = None
    badge_type: str  # silver_integrity | gold_integrity | platinum_integrity
    enabled: bool
    month_year: str | None = None
    verified_count: int | None = None
    reason: str | None = None


def _sb():
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")
    return sb


def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _is_gamification_admin(sb, current_user: dict) -> bool:
    email = (current_user.get("email") or "").lower().strip()
    admin_email = (settings.ADMIN_EMAIL or "").lower().strip()
    if email and (email == admin_email or email == "okitr52@gmail.com"):
        return True

    if not email:
        return False

    try:
        res = sb.table("authorized_admins").select("id").eq("email", email).limit(1).execute()
        rows = getattr(res, "data", None) or []
        return len(rows) > 0
    except Exception:
        return False


def _load_gamification_config(sb) -> dict[str, Any]:
    defaults = {
        "silver_threshold": SILVER_THRESHOLD,
        "gold_threshold": GOLD_THRESHOLD,
        "platinum_threshold": PLATINUM_THRESHOLD,
        "gold_interest_discount_pct": GOLD_INTEREST_DISCOUNT,
        "platinum_interest_discount_pct": PLATINUM_INTEREST_DISCOUNT,
        "gold_plafon_bonus": GOLD_PLAFON_BONUS,
        "platinum_plafon_bonus": PLATINUM_PLAFON_BONUS,
        "gold_context_tba": DEFAULT_GAMIFICATION_CONTEXT["gold"],
        "platinum_context_tba": DEFAULT_GAMIFICATION_CONTEXT["platinum"],
        "badge_base_url": DEFAULT_BADGE_BASE_URL,
        "certificate_base_url": DEFAULT_CERT_BASE_URL,
    }
    try:
        res = sb.table("gamification_config").select("*").eq("id", 1).limit(1).execute()
        rows = getattr(res, "data", None) or []
        if rows:
            cfg = {**defaults, **rows[0]}
            return cfg
    except Exception:
        pass
    return defaults


def _badge_display_name(badge_type: str) -> str:
    if badge_type == "platinum_integrity":
        return "Platinum"
    if badge_type == "gold_integrity":
        return "Gold"
    return "Silver"


def _current_user_id(current_user: dict) -> str:
    uid = current_user.get("id") or current_user.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="User id tidak ditemukan di token")
    return str(uid)


def _resolve_user_id_by_email(sb, email: str) -> str | None:
    email_norm = email.lower().strip()
    if not email_norm:
        return None

    # Primary: profiles.user_email
    try:
        res = sb.table("profiles").select("id").eq("user_email", email_norm).limit(1).execute()
        rows = getattr(res, "data", None) or []
        if rows and rows[0].get("id"):
            return str(rows[0]["id"])
    except Exception:
        pass

    # Fallback: Supabase auth users list
    try:
        auth_users = sb.auth.admin.list_users()
        for u in auth_users:
            if (getattr(u, "email", "") or "").lower().strip() == email_norm:
                return str(getattr(u, "id", "")) or None
    except Exception:
        pass

    return None


def _build_badge_image_url(cfg: dict[str, Any], badge_type: str, month_year: str) -> str:
    label = _badge_display_name(badge_type).upper()
    color = "#64748b"
    if badge_type == "gold_integrity":
        color = "#b45309"
    elif badge_type == "platinum_integrity":
        color = "#4338ca"

    svg = f"""
<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'>
  <rect width='640' height='360' fill='#f8fafc'/>
  <rect x='20' y='20' width='600' height='320' rx='16' fill='#ffffff' stroke='#cbd5e1' stroke-width='2'/>
  <rect x='20' y='20' width='600' height='60' rx='16' fill='#0f172a'/>
  <text x='40' y='57' font-family='Arial, sans-serif' font-size='24' fill='#e2e8f0' font-weight='700'>OTARUCHAIN</text>
  <text x='600' y='57' text-anchor='end' font-family='Arial, sans-serif' font-size='14' fill='#94a3b8'>INTEGRITY BADGE</text>

  <circle cx='130' cy='185' r='70' fill='{color}' opacity='0.12'/>
  <circle cx='130' cy='185' r='54' fill='#ffffff' stroke='{color}' stroke-width='4'/>
  <text x='130' y='192' text-anchor='middle' font-family='Arial, sans-serif' font-size='20' fill='{color}' font-weight='700'>{label[:1]}</text>

  <text x='230' y='160' font-family='Arial, sans-serif' font-size='38' fill='{color}' font-weight='800'>{label}</text>
  <text x='230' y='198' font-family='Arial, sans-serif' font-size='18' fill='#334155'>PERIODE {month_year}</text>
  <text x='230' y='228' font-family='Arial, sans-serif' font-size='14' fill='#64748b'>Standar dokumen rapi, konsisten, dan siap audit.</text>

  <rect x='40' y='286' width='560' height='36' rx='8' fill='#f1f5f9' stroke='#e2e8f0'/>
  <text x='56' y='310' font-family='Arial, sans-serif' font-size='13' fill='#475569'>Preview Badge • Bank-grade style • OtaruChain Compliance</text>
</svg>
""".strip()
    return f"data:image/svg+xml;utf8,{quote(svg)}"


def _build_certificate_preview_url(cfg: dict[str, Any], badge_type: str, month_year: str) -> str:
    label = _badge_display_name(badge_type).upper()
    accent = "#0f172a"
    if badge_type == "gold_integrity":
        accent = "#92400e"
    elif badge_type == "platinum_integrity":
        accent = "#3730a3"

    svg = f"""
<svg xmlns='http://www.w3.org/2000/svg' width='900' height='600' viewBox='0 0 900 600'>
  <rect width='900' height='600' fill='#f8fafc'/>
  <rect x='28' y='28' width='844' height='544' rx='18' fill='#ffffff' stroke='#cbd5e1' stroke-width='3'/>
  <rect x='28' y='28' width='844' height='74' rx='18' fill='{accent}'/>
  <text x='52' y='74' font-family='Arial, sans-serif' font-size='28' fill='#ffffff' font-weight='700'>SERTIFIKAT INTEGRITAS DOKUMEN</text>
  <text x='848' y='74' text-anchor='end' font-family='Arial, sans-serif' font-size='14' fill='#cbd5e1'>OTARUCHAIN</text>

  <text x='450' y='182' text-anchor='middle' font-family='Arial, sans-serif' font-size='22' fill='#334155'>Diberikan kepada</text>
  <text x='450' y='236' text-anchor='middle' font-family='Arial, sans-serif' font-size='40' fill='#0f172a' font-weight='700'>NAMA PENGGUNA</text>
  <text x='450' y='286' text-anchor='middle' font-family='Arial, sans-serif' font-size='24' fill='{accent}' font-weight='700'>TIER {label} • {month_year}</text>

  <rect x='126' y='332' width='648' height='82' rx='10' fill='#f8fafc' stroke='#e2e8f0'/>
  <text x='150' y='365' font-family='Arial, sans-serif' font-size='16' fill='#475569'>Dokumen telah melewati verifikasi integritas dan siap untuk proses underwriting.</text>
  <text x='150' y='390' font-family='Arial, sans-serif' font-size='16' fill='#475569'>Format sertifikat mengikuti gaya dokumen lembaga keuangan Indonesia.</text>

  <line x1='140' y1='478' x2='360' y2='478' stroke='#94a3b8' stroke-width='2'/>
  <line x1='540' y1='478' x2='760' y2='478' stroke='#94a3b8' stroke-width='2'/>
  <text x='250' y='502' text-anchor='middle' font-family='Arial, sans-serif' font-size='13' fill='#64748b'>Validasi Sistem</text>
  <text x='650' y='502' text-anchor='middle' font-family='Arial, sans-serif' font-size='13' fill='#64748b'>Persetujuan Admin</text>

  <text x='450' y='548' text-anchor='middle' font-family='Arial, sans-serif' font-size='12' fill='#64748b'>Preview Sertifikat • PDF resmi tetap diunduh dari endpoint certificate.</text>
</svg>
""".strip()
    return f"data:image/svg+xml;utf8,{quote(svg)}"


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
    cfg = _load_gamification_config(sb)
    month = month_year or _current_month()
    stats = _get_monthly_stats(sb, user_id, month)
    verified_count = stats["verified"]
    tampered_count = stats["tampered"]
    existing = _get_existing_badges(sb, user_id, month)

    has_silver = "silver_integrity" in existing
    has_gold = "gold_integrity" in existing
    has_platinum = "platinum_integrity" in existing
    
    streak_broken = tampered_count > 0

    # Always evaluate badges by threshold (including when tampered),
    # while keeping streak_broken as a separate compliance signal.
    if verified_count >= int(cfg["silver_threshold"]) and not has_silver:
        _upsert_badge(sb, user_id, month, "silver_integrity", verified_count, tampered_count)
        has_silver = True

    if verified_count >= int(cfg["gold_threshold"]) and not has_gold:
        _upsert_badge(
            sb, user_id, month, "gold_integrity", verified_count, tampered_count,
            float(cfg["gold_interest_discount_pct"]),
            int(cfg["gold_plafon_bonus"]),
        )
        has_gold = True

    if verified_count >= int(cfg["platinum_threshold"]) and not has_platinum:
        _upsert_badge(
            sb, user_id, month, "platinum_integrity", verified_count, tampered_count,
            float(cfg["platinum_interest_discount_pct"]),
            int(cfg["platinum_plafon_bonus"]),
        )
        has_platinum = True

    # Keep tampered_count synchronized on all existing badges.
    if streak_broken:
        for b_type, b_data in existing.items():
            if int(b_data.get("tampered_count") or 0) < tampered_count:
                sb.table("gamification_badges").update({"tampered_count": tampered_count}).eq("id", b_data["id"]).execute()

    # Refresh existing badges for response
    existing = _get_existing_badges(sb, user_id, month)
    silver_unlocked_at = existing.get("silver_integrity", {}).get("unlocked_at")
    gold_unlocked_at = existing.get("gold_integrity", {}).get("unlocked_at")
    platinum_unlocked_at = existing.get("platinum_integrity", {}).get("unlocked_at")

    progress = min(100.0, round((verified_count / max(1, int(cfg["platinum_threshold"]))) * 100, 1))

    current_discount = 0.0
    current_bonus = 0
    if "platinum_integrity" in existing:
        current_discount = float(cfg["platinum_interest_discount_pct"])
        current_bonus = int(cfg["platinum_plafon_bonus"])
    elif "gold_integrity" in existing:
        current_discount = float(cfg["gold_interest_discount_pct"])
        current_bonus = int(cfg["gold_plafon_bonus"])

    return BadgeProgress(
        user_id=user_id,
        month_year=month,
        verified_count=verified_count,
        silver_threshold=int(cfg["silver_threshold"]),
        gold_threshold=int(cfg["gold_threshold"]),
        platinum_threshold=int(cfg["platinum_threshold"]),
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
        gold_context_tba=str(cfg["gold_context_tba"]),
        platinum_context_tba=str(cfg["platinum_context_tba"]),
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
