"""
SOP Koperasi — DSR & Flat Interest Business Logic

Extracted from api/kasbon.py to keep the API layer thin.
All domain constants and pure-logic functions for kasbon SOP validation live here.
"""
from __future__ import annotations

import re
from typing import Optional

# ── SOP Constants ─────────────────────────────────────────────────────────────

# Asumsi gaji UMK Driver
UMK_GAJI = 5_000_000
# DSR maksimal 30% dari gaji
DSR_LIMIT = int(UMK_GAJI * 0.30)   # = 1_500_000
# Bunga flat per bulan
FLAT_RATE = 0.01  # 1% per bulan


# ── Calculations ──────────────────────────────────────────────────────────────

def hitung_cicilan_flat(nominal: int, tenor_bulan: int) -> int:
    """
    Cicilan = (Nominal + Total Bunga) / Tenor
    Bunga flat: Nominal * FLAT_RATE * Tenor
    """
    if tenor_bulan <= 0:
        return 0
    total_bunga = nominal * FLAT_RATE * tenor_bulan
    total_bayar = nominal + total_bunga
    return int(total_bayar / tenor_bulan)


def validate_dsr(cicilan: int) -> tuple[str, bool]:
    """
    Returns (dsr_status, auto_reject).
    dsr_status: 'AMAN' | 'OVER'
    auto_reject: True jika cicilan melebihi DSR limit.
    """
    if cicilan > DSR_LIMIT:
        return "OVER", True
    return "AMAN", False


# ── OCR Extraction Helpers ────────────────────────────────────────────────────

def extract_nik_and_nominal(raw_text: str) -> tuple[Optional[str], Optional[int]]:
    """Simple regex extraction of NIK (16 digits) and Nominal from OCR text."""
    nik_match = re.search(r"\b(\d{16})\b", raw_text)
    nik = nik_match.group(1) if nik_match else None

    nominal_match = re.search(r"[Rr][Pp]\.?\s*([\d.,]+)", raw_text)
    if nominal_match:
        raw = nominal_match.group(1).replace(".", "").replace(",", "")
        try:
            nominal = int(raw)
        except ValueError:
            nominal = None
    else:
        numbers = re.findall(r"\b(\d{5,})\b", raw_text)
        nominal = int(numbers[0]) if numbers else None

    return nik, nominal


def extract_tenor(raw_text: str) -> Optional[int]:
    """Extract tenor (bulan) from OCR text. Looks for patterns like '12 bulan', 'Tenor: 6'."""
    match = re.search(r"tenor[\s:]*(\d{1,3})", raw_text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    match = re.search(r"(\d{1,3})\s*bulan", raw_text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def extract_cicilan_from_ocr(raw_text: str) -> Optional[int]:
    """Extract angsuran/cicilan amount from OCR text."""
    match = re.search(
        r"(?:angsuran|cicilan|installment)[\s:]*[Rr][Pp]?\.?\s*([\d.,]+)",
        raw_text,
        re.IGNORECASE,
    )
    if match:
        raw = match.group(1).replace(".", "").replace(",", "")
        try:
            return int(raw)
        except ValueError:
            pass
    return None


# ── Tampering Detection ───────────────────────────────────────────────────────

def detect_tampering_basic(raw_text: str, confidence_scores: list[float]) -> str:
    """
    Heuristic AI indicator:
    - TAMPERED if average OCR confidence < 0.6 or suspicious keywords found.
    - VERIFIED otherwise.
    """
    suspicious_keywords = ["edited", "photoshop", "modified", "copy paste"]
    if any(kw in raw_text.lower() for kw in suspicious_keywords):
        return "TAMPERED"
    if confidence_scores and (sum(confidence_scores) / len(confidence_scores)) < 0.6:
        return "TAMPERED"
    return "VERIFIED"


def detect_tampering_sop(
    raw_text: str,
    confidence_scores: list[float],
    nominal: int,
    tenor: Optional[int],
    cicilan_ocr: Optional[int],
) -> tuple[str, str, bool, int]:
    """
    Full SOP-aware tampering detection.
    Returns (ai_indicator, dsr_status, auto_reject, cicilan_sistem).
    """
    if not tenor or tenor <= 0:
        ai = detect_tampering_basic(raw_text, confidence_scores)
        return ai, "AMAN", False, 0

    cicilan_sistem = hitung_cicilan_flat(nominal, tenor)
    dsr_status, auto_reject = validate_dsr(cicilan_sistem)

    if auto_reject:
        return "TAMPERED", dsr_status, True, cicilan_sistem

    if cicilan_ocr and cicilan_ocr > 0:
        tolerance = cicilan_sistem * 0.05
        if abs(cicilan_ocr - cicilan_sistem) > tolerance:
            return "TAMPERED", dsr_status, False, cicilan_sistem
        return "VERIFIED", dsr_status, False, cicilan_sistem

    ai = detect_tampering_basic(raw_text, confidence_scores)
    return ai, dsr_status, False, cicilan_sistem


# ── Credit Score Update ───────────────────────────────────────────────────────

def update_credit_score(sb, nik: str, ai_indicator: str) -> None:
    """
    Update credit score in profiles based on AI indicator.
    Base: 500. VERIFIED: +200. TAMPERED: -400 (and flag).
    Best-effort — never raises.
    """
    try:
        prof = (
            sb.table("profiles")
            .select("credit_score, fraud_flags")
            .eq("nik", nik)
            .limit(1)
            .execute()
        )
        rows = getattr(prof, "data", None) or []
        if not rows:
            return
        current_score = int(rows[0].get("credit_score") or 500)
        fraud_flags = int(rows[0].get("fraud_flags") or 0)

        if ai_indicator == "VERIFIED":
            new_score = min(1000, current_score + 200)
            update_payload: dict = {"credit_score": new_score}
        elif ai_indicator == "TAMPERED":
            new_score = max(0, current_score - 400)
            fraud_flags += 1
            update_payload = {"credit_score": new_score, "fraud_flags": fraud_flags}
        else:
            return

        sb.table("profiles").update(update_payload).eq("nik", nik).execute()
    except Exception:
        pass  # best-effort, don't fail the request
