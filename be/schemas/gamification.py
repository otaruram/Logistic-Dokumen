from typing import Optional
from pydantic import BaseModel

SILVER_THRESHOLD = 50
GOLD_THRESHOLD = 150
PLATINUM_THRESHOLD = 250
GOLD_INTEREST_DISCOUNT = 0.5
PLATINUM_INTEREST_DISCOUNT = 1.0
GOLD_PLAFON_BONUS = 1_000_000
PLATINUM_PLAFON_BONUS = 20_000_000
DEFAULT_GAMIFICATION_CONTEXT = {
    "gold": "Benefit Gold: Bonus Plafon +Rp 1 Juta & Diskon Biaya Admin 0.5% berbasis meritokrasi perilaku anggota Koperasi.",
    "platinum": "Benefit Platinum: Plafon Maksimal up to Rp 20 Juta & Akses Prioritas Pencairan Instan < 5 Menit.",
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
