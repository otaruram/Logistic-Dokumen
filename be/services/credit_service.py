from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from config.redis_client import RedisClient

MAX_CREDITS = 10
DAILY_CREDIT_BONUS = 1


def grant_daily_credit_bonus(sb: Any, user_id: str) -> dict:
    """
    Grant +1 credit once per UTC day, capped at MAX_CREDITS.
    Uses Redis key lock so repeated requests in the same day do not double-grant.
    """
    if not sb or not user_id:
        return {"granted": False, "reason": "missing_context"}

    today_key = datetime.now(timezone.utc).strftime("%Y%m%d")
    redis_key = f"credit:daily_bonus:{user_id}:{today_key}"

    redis_client = RedisClient.get_client()
    if redis_client is None:
        # Safe fallback: skip auto-grant if Redis unavailable to prevent duplicate grants.
        return {"granted": False, "reason": "redis_unavailable"}

    try:
        # Lock for 26h to avoid duplicate in the same UTC day.
        is_first_today = bool(redis_client.set(redis_key, "1", nx=True, ex=26 * 3600))
    except Exception:
        return {"granted": False, "reason": "redis_error"}

    if not is_first_today:
        return {"granted": False, "reason": "already_granted_today"}

    try:
        prof = sb.table("profiles").select("credits").eq("id", str(user_id)).limit(1).execute()
        rows = getattr(prof, "data", None) or []
        if not rows:
            return {"granted": False, "reason": "profile_not_found"}

        current = int(rows[0].get("credits", 0) or 0)
        if current >= MAX_CREDITS:
            return {"granted": False, "reason": "already_max", "credits": current}

        new_credits = min(MAX_CREDITS, current + DAILY_CREDIT_BONUS)
        sb.table("profiles").update({"credits": new_credits}).eq("id", str(user_id)).execute()
        return {"granted": True, "credits": new_credits}
    except Exception:
        try:
            redis_client.delete(redis_key)
        except Exception:
            pass
        return {"granted": False, "reason": "db_error"}
