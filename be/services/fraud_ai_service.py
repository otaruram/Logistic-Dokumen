"""
AI Fraud Indicator Service — Gemini 2.5 Flash Integration

Analyses OCR-extracted text from uploaded documents (both OtaruChain
operational receipts and OtaruFinancial salary slips) and returns a
fraud risk assessment:

    TRUSTED       — Document appears authentic.
    NEEDS_REVIEW  — Minor anomalies detected; admin should verify.
    FRAUD         — Strong manipulation indicators present.

The system is advisory-only: the Admin retains 100 % control over
approve / reject decisions.
"""

from __future__ import annotations

import json
import os
import re
import traceback
from typing import TypedDict

# ── Gemini SDK ────────────────────────────────────────────────────────────────

_gemini_model = None

try:
    import google.generativeai as genai  # type: ignore

    _GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    if _GEMINI_API_KEY:
        genai.configure(api_key=_GEMINI_API_KEY)
        _gemini_model = genai.GenerativeModel("gemini-2.5-flash")
        print("✅ Gemini 2.5 Flash initialized for AI Fraud Detection")
    else:
        print("⚠️  GEMINI_API_KEY not set — AI Fraud Detection disabled")
except ImportError:
    print("⚠️  google-generativeai package not installed — AI Fraud Detection disabled")
except Exception as exc:
    print(f"⚠️  Gemini init failed: {exc}")


# ── Types ─────────────────────────────────────────────────────────────────────

class FraudResult(TypedDict):
    status: str   # TRUSTED | NEEDS_REVIEW | FRAUD
    reason: str   # Concise explanation in Indonesian


# ── System Prompt ─────────────────────────────────────────────────────────────

FRAUD_SYSTEM_PROMPT = (
    "You are an expert fraud analyst for an Indonesian financial institution. "
    "Analyze this OCR text extracted from a user's document. "
    "If it's an operational receipt (OtaruChain), check for unrealistic totals, "
    "mismatched dates, or fake receipt formats. "
    "If it's a salary slip (OtaruFinancial), check for inconsistent logic or "
    "manipulated figures. "
    'Respond ONLY in raw JSON format without markdown blocks: '
    '{"status": "TRUSTED" | "NEEDS_REVIEW" | "FRAUD", '
    '"reason": "Short, concise explanation in Indonesian why you chose this status."}'
)

_VALID_STATUSES = {"TRUSTED", "NEEDS_REVIEW", "FRAUD"}


# ── Public API ────────────────────────────────────────────────────────────────

async def analyze_fraud_with_gemini(
    ocr_text: str,
    source: str = "CHAIN",
    doc_type: str = "receipt",
) -> FraudResult:
    """Send OCR text to Gemini 2.5 Flash for fraud analysis.

    Returns a FraudResult dict with ``status`` and ``reason``.
    On any failure (API down, bad response, missing key) falls back to
    ``NEEDS_REVIEW`` with a descriptive reason so the queue is never blocked.
    """

    if not _gemini_model:
        return FraudResult(
            status="NEEDS_REVIEW",
            reason="Analisis AI tidak tersedia (API key belum dikonfigurasi). Admin harus review manual.",
        )

    if not ocr_text or not ocr_text.strip():
        return FraudResult(
            status="NEEDS_REVIEW",
            reason="Teks OCR kosong — dokumen mungkin berupa gambar tanpa teks. Review manual diperlukan.",
        )

    # Truncate to avoid exceeding context limits
    trimmed = ocr_text[:4000]

    context_label = (
        f"Jenis dokumen: {'Slip Gaji (OtaruFinancial)' if source == 'FINANCE' else f'Struk Operasional ({doc_type}) (OtaruChain)'}"
    )

    user_prompt = f"{context_label}\n\nOCR TEXT:\n{trimmed}"

    try:
        response = _gemini_model.generate_content(
            [
                {"role": "user", "parts": [{"text": FRAUD_SYSTEM_PROMPT}]},
                {"role": "model", "parts": [{"text": "Understood. Send the OCR text and I will respond with JSON only."}]},
                {"role": "user", "parts": [{"text": user_prompt}]},
            ],
            generation_config={
                "temperature": 0.1,
                "max_output_tokens": 300,
            },
        )

        raw = response.text.strip()

        # Strip markdown code fences if present (```json ... ```)
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        # Find JSON object in the response
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not json_match:
            print(f"[FraudAI] No JSON found in response: {raw[:200]}")
            return FraudResult(
                status="NEEDS_REVIEW",
                reason="AI mengembalikan respons non-JSON. Admin harus review manual.",
            )

        parsed = json.loads(json_match.group())
        status = str(parsed.get("status", "")).upper().strip()
        reason = str(parsed.get("reason", "Tidak ada penjelasan dari AI."))

        if status not in _VALID_STATUSES:
            print(f"[FraudAI] Invalid status '{status}', defaulting to NEEDS_REVIEW")
            status = "NEEDS_REVIEW"
            reason = f"(Status AI tidak dikenali: {parsed.get('status')}) {reason}"

        return FraudResult(status=status, reason=reason)

    except json.JSONDecodeError as exc:
        print(f"[FraudAI] JSON parse error: {exc}")
        return FraudResult(
            status="NEEDS_REVIEW",
            reason="AI response gagal di-parse. Admin harus review manual.",
        )
    except Exception as exc:
        print(f"[FraudAI] Gemini API error: {exc}")
        traceback.print_exc()
        return FraudResult(
            status="NEEDS_REVIEW",
            reason=f"Analisis AI gagal ({type(exc).__name__}). Admin harus review manual.",
        )
