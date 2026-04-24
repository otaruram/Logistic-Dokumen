"""
OtaruChain Risk Service — Probability of Default Predictor

Calculates a risk level (LOW / MEDIUM / HIGH) for MSME users based on:
1. Tampered document ratio
2. Upload consistency (gap analysis)
3. Verified document volume
4. Recency of last upload

This gives banking partners a clear, actionable risk assessment.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from services.scan_helpers import get_supabase_admin


def calculate_risk_level(user_id: str) -> dict:
    """
    Compute a multi-factor risk assessment for a user.

    Returns:
    {
        "risk_level": "LOW" | "MEDIUM" | "HIGH",
        "risk_score": 0-100,  (0 = lowest risk, 100 = highest risk)
        "factors": [
            {"name": "Tampered Ratio", "score": 0, "detail": "0% tampered"},
            {"name": "Upload Consistency", "score": 15, "detail": "Max gap: 12 days"},
            ...
        ]
    }
    """
    sb = get_supabase_admin()
    if not sb:
        return _default_risk("HIGH", 100, "Supabase not configured")

    # Fetch all fraud_scans for user, ordered by date
    res = (
        sb.table("fraud_scans")
        .select("id, status, created_at, nominal_total")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    )
    scans = getattr(res, "data", None) or []

    if not scans:
        return _default_risk("HIGH", 85, "No document history found")

    # ── Factor 1: Tampered Ratio ──────────────────────────────────────────
    total = len(scans)
    tampered = sum(1 for s in scans if s.get("status") == "tampered")
    verified = sum(1 for s in scans if s.get("status") == "verified")
    tampered_pct = (tampered / total * 100) if total > 0 else 0

    if tampered_pct == 0:
        tamper_score = 0
        tamper_detail = "0% tampered — clean record"
    elif tampered_pct <= 5:
        tamper_score = 15
        tamper_detail = f"{tampered_pct:.1f}% tampered ({tampered}/{total})"
    elif tampered_pct <= 15:
        tamper_score = 45
        tamper_detail = f"{tampered_pct:.1f}% tampered ({tampered}/{total})"
    else:
        tamper_score = 80
        tamper_detail = f"{tampered_pct:.1f}% tampered ({tampered}/{total}) — HIGH RISK"

    # ── Factor 2: Upload Consistency (gap analysis) ───────────────────────
    max_gap_days = 0
    avg_gap_days = 0

    if len(scans) >= 2:
        dates = []
        for s in scans:
            ca = s.get("created_at", "")
            try:
                if ca.endswith("Z"):
                    ca = ca[:-1] + "+00:00"
                dates.append(datetime.fromisoformat(ca))
            except (ValueError, TypeError):
                continue

        if len(dates) >= 2:
            dates.sort()
            gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
            max_gap_days = max(gaps) if gaps else 0
            avg_gap_days = sum(gaps) / len(gaps) if gaps else 0

    if max_gap_days <= 14:
        gap_score = 0
        gap_detail = f"Max gap: {max_gap_days} days — consistent uploads"
    elif max_gap_days <= 45:
        gap_score = 30
        gap_detail = f"Max gap: {max_gap_days} days — some irregularity"
    else:
        gap_score = 70
        gap_detail = f"Max gap: {max_gap_days} days — significant gaps"

    # ── Factor 3: Verified Document Volume ────────────────────────────────
    if verified >= 10:
        volume_score = 0
        volume_detail = f"{verified} verified documents — strong track record"
    elif verified >= 3:
        volume_score = 25
        volume_detail = f"{verified} verified documents — moderate history"
    else:
        volume_score = 60
        volume_detail = f"{verified} verified documents — insufficient history"

    # ── Factor 4: Recency (days since last upload) ────────────────────────
    last_scan_date = None
    for s in reversed(scans):
        ca = s.get("created_at", "")
        try:
            if ca.endswith("Z"):
                ca = ca[:-1] + "+00:00"
            last_scan_date = datetime.fromisoformat(ca)
            break
        except (ValueError, TypeError):
            continue

    now = datetime.now(timezone.utc)
    if last_scan_date:
        if last_scan_date.tzinfo is None:
            last_scan_date = last_scan_date.replace(tzinfo=timezone.utc)
        days_since_last = (now - last_scan_date).days
    else:
        days_since_last = 999

    if days_since_last <= 7:
        recency_score = 0
        recency_detail = f"Last upload: {days_since_last} days ago — very active"
    elif days_since_last <= 30:
        recency_score = 20
        recency_detail = f"Last upload: {days_since_last} days ago — moderately active"
    else:
        recency_score = 55
        recency_detail = f"Last upload: {days_since_last} days ago — inactive"

    # ── Composite Risk Score ──────────────────────────────────────────────
    # Weighted average: tamper ratio has highest weight
    weights = {
        "tamper": 0.40,
        "gap": 0.20,
        "volume": 0.20,
        "recency": 0.20,
    }
    risk_score = int(
        tamper_score * weights["tamper"]
        + gap_score * weights["gap"]
        + volume_score * weights["volume"]
        + recency_score * weights["recency"]
    )
    risk_score = max(0, min(100, risk_score))

    if risk_score <= 33:
        risk_level = "LOW"
    elif risk_score <= 66:
        risk_level = "MEDIUM"
    else:
        risk_level = "HIGH"

    factors = [
        {"name": "Tampered Ratio", "score": tamper_score, "max": 100, "weight": "40%", "detail": tamper_detail},
        {"name": "Upload Consistency", "score": gap_score, "max": 100, "weight": "20%", "detail": gap_detail},
        {"name": "Verified Volume", "score": volume_score, "max": 100, "weight": "20%", "detail": volume_detail},
        {"name": "Recency", "score": recency_score, "max": 100, "weight": "20%", "detail": recency_detail},
    ]

    return {
        "risk_level": risk_level,
        "risk_score": risk_score,
        "factors": factors,
    }


def _default_risk(level: str, score: int, reason: str) -> dict:
    return {
        "risk_level": level,
        "risk_score": score,
        "factors": [{"name": "System", "score": score, "max": 100, "weight": "100%", "detail": reason}],
    }
