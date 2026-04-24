"""
OtaruChain Credit Score Cycles Service

Manages the cycle/session system where credit score is capped at 1000 per cycle.
When a user hits 1000, they complete the current cycle and start a new one.
Banks can see both current cycle score and lifetime accumulated score.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from services.scan_helpers import get_supabase_admin


CYCLE_MAX = 1000


def _get_sb():
    sb = get_supabase_admin()
    if not sb:
        raise RuntimeError("Supabase admin not configured")
    return sb


def get_or_create_active_cycle(user_id: str) -> dict:
    """
    Return the current active cycle for a user.
    If none exists, create Cycle 1.
    """
    sb = _get_sb()

    res = (
        sb.table("credit_score_cycles")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .order("cycle_number", desc=True)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []

    if rows:
        return rows[0]

    # Create Cycle 1
    now_iso = datetime.now(timezone.utc).isoformat()
    new_cycle = {
        "user_id": user_id,
        "cycle_number": 1,
        "cycle_score": 0,
        "cycle_started_at": now_iso,
        "is_active": True,
    }
    insert_res = sb.table("credit_score_cycles").insert(new_cycle).execute()
    inserted = getattr(insert_res, "data", None) or []
    return inserted[0] if inserted else new_cycle


def add_score_points(user_id: str, points: int) -> dict:
    """
    Add points to the user's current active cycle.
    If the score would exceed CYCLE_MAX (1000), complete the current cycle
    and carry overflow into a new cycle.

    Returns the updated scoring summary.
    """
    sb = _get_sb()
    cycle = get_or_create_active_cycle(user_id)
    current_score = int(cycle.get("cycle_score", 0))
    cycle_number = int(cycle.get("cycle_number", 1))
    cycle_id = cycle.get("id")

    new_score = current_score + points

    if new_score >= CYCLE_MAX:
        # Complete current cycle
        now_iso = datetime.now(timezone.utc).isoformat()
        sb.table("credit_score_cycles").update({
            "cycle_score": CYCLE_MAX,
            "is_active": False,
            "cycle_completed_at": now_iso,
        }).eq("id", cycle_id).execute()

        # Create next cycle with overflow
        overflow = new_score - CYCLE_MAX
        next_cycle = {
            "user_id": user_id,
            "cycle_number": cycle_number + 1,
            "cycle_score": min(overflow, CYCLE_MAX),
            "cycle_started_at": now_iso,
            "is_active": True,
        }
        sb.table("credit_score_cycles").insert(next_cycle).execute()
        print(f"🏆 User {user_id[:8]}... completed Cycle {cycle_number} → starting Cycle {cycle_number + 1}")
    else:
        # Update score in current cycle
        sb.table("credit_score_cycles").update({
            "cycle_score": new_score,
        }).eq("id", cycle_id).execute()

    return get_scoring_summary(user_id)


def get_scoring_summary(user_id: str) -> dict:
    """
    Get comprehensive scoring summary for a user.

    Returns:
    {
        "current_cycle": 3,
        "current_cycle_score": 850,
        "cycle_max": 1000,
        "lifetime_score": 2850,
        "completed_cycles": 2,
        "cycles": [
            {"cycle": 1, "score": 1000, "completed_at": "...", "active": false},
            {"cycle": 2, "score": 1000, "completed_at": "...", "active": false},
            {"cycle": 3, "score": 850, "started_at": "...", "active": true},
        ]
    }
    """
    sb = _get_sb()

    res = (
        sb.table("credit_score_cycles")
        .select("*")
        .eq("user_id", user_id)
        .order("cycle_number", desc=False)
        .execute()
    )
    all_cycles = getattr(res, "data", None) or []

    if not all_cycles:
        return {
            "current_cycle": 0,
            "current_cycle_score": 0,
            "cycle_max": CYCLE_MAX,
            "lifetime_score": 0,
            "completed_cycles": 0,
            "cycles": [],
        }

    lifetime_score = 0
    completed_cycles = 0
    current_cycle_number = 0
    current_cycle_score = 0
    cycle_list = []

    for c in all_cycles:
        score = int(c.get("cycle_score", 0))
        is_active = c.get("is_active", False)
        cycle_num = int(c.get("cycle_number", 0))

        lifetime_score += score

        if not is_active:
            completed_cycles += 1

        if is_active:
            current_cycle_number = cycle_num
            current_cycle_score = score

        cycle_list.append({
            "cycle": cycle_num,
            "score": score,
            "started_at": c.get("cycle_started_at"),
            "completed_at": c.get("cycle_completed_at"),
            "active": is_active,
        })

    # If no active cycle found, use the latest one
    if current_cycle_number == 0 and cycle_list:
        last = cycle_list[-1]
        current_cycle_number = last["cycle"]
        current_cycle_score = last["score"]

    return {
        "current_cycle": current_cycle_number,
        "current_cycle_score": current_cycle_score,
        "cycle_max": CYCLE_MAX,
        "lifetime_score": lifetime_score,
        "completed_cycles": completed_cycles,
        "cycles": cycle_list,
    }


def compute_and_sync_cycles(user_id: str, trust_score: int) -> dict:
    """
    Given a computed trust_score (from the existing scoring function),
    sync it into the cycle system. This ensures backward compatibility
    with the existing `calculate_logistics_trust_score` RPC.

    The trust_score is treated as the "total points earned so far".
    We derive cycle state from it.
    """
    sb = _get_sb()

    # Check if user already has cycles
    res = (
        sb.table("credit_score_cycles")
        .select("id, cycle_number, cycle_score, is_active")
        .eq("user_id", user_id)
        .order("cycle_number", desc=False)
        .execute()
    )
    existing = getattr(res, "data", None) or []

    if existing:
        # Cycles already exist — just return current summary
        return get_scoring_summary(user_id)

    # Bootstrap cycles from trust_score
    if trust_score <= 0:
        return get_scoring_summary(user_id)

    now_iso = datetime.now(timezone.utc).isoformat()
    full_cycles = trust_score // CYCLE_MAX
    remainder = trust_score % CYCLE_MAX

    for i in range(1, full_cycles + 1):
        sb.table("credit_score_cycles").insert({
            "user_id": user_id,
            "cycle_number": i,
            "cycle_score": CYCLE_MAX,
            "cycle_started_at": now_iso,
            "cycle_completed_at": now_iso,
            "is_active": False,
        }).execute()

    # Current active cycle
    active_cycle_num = full_cycles + 1
    sb.table("credit_score_cycles").insert({
        "user_id": user_id,
        "cycle_number": active_cycle_num,
        "cycle_score": remainder,
        "cycle_started_at": now_iso,
        "is_active": True,
    }).execute()

    return get_scoring_summary(user_id)
