"""
Scan Insight API — OtaruBot AI analysis for DGTNZ & Fraud scan results.
Provides contextual business intelligence and fraud scoring explanations.
"""

import os
import re
import time
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from models.models import User
from utils.auth import get_current_active_user

router = APIRouter()

# ── Sumopod / OpenAI client ────────────────────────────────────────────────

from openai import AsyncOpenAI

_client = None

def _get_ai_client():
    global _client
    if _client is None:
        api_key = os.getenv("SUMOPOD_API_KEY") or os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL", "https://ai.sumopod.com/v1")
        if not api_key:
            raise ValueError("No AI API key configured")
        _client = AsyncOpenAI(base_url=base_url, api_key=api_key)
    return _client

# ── Request model ──────────────────────────────────────────────────────────

class ScanInsightRequest(BaseModel):
    scan_type: str  # "fraud" or "dgtnz"
    extracted_text: Optional[str] = ""
    confidence: Optional[str] = "low"         # low / medium / high
    status: Optional[str] = "tampered"        # tampered / processing / verified
    nominal_total: Optional[float] = 0
    nama_klien: Optional[str] = None
    nomor_surat_jalan: Optional[str] = None
    tanggal_jatuh_tempo: Optional[str] = None
    recipient_name: Optional[str] = None
    rejection_reason: Optional[str] = None


# ── System prompts ─────────────────────────────────────────────────────────

FRAUD_SYSTEM_PROMPT = """You are Otaru, fraud analyst for Indonesian logistics documents.

Output rules (WAJIB):
- Bahasa Indonesia.
- Ringkas dan ketat (maksimal 8 bullet).
- Setiap baris harus diawali bullet symbol "•".
- DILARANG pakai karakter heading/list markdown seperti #, -, *.
- Fokus ke keputusan dan tindakan, jangan narasi panjang.

Isi yang wajib ada:
• Alasan confidence dan field yang ketemu/tidak ketemu.
• Risiko dokumen (rendah/sedang/tinggi) dengan 1 alasan utama.
• 2-3 saran perbaikan scan/dokumen paling penting.
• Rekomendasi final: VERIFIKASI / REVIEW MANUAL / TOLAK + alasan singkat.
"""

DGTNZ_SYSTEM_PROMPT = """You are Otaru, logistics business analyst for Indonesian UMKM.

Output rules (WAJIB):
- Bahasa Indonesia.
- Ringkas dan ketat (maksimal 8 bullet).
- Setiap baris harus diawali bullet symbol "•".
- DILARANG pakai karakter heading/list markdown seperti #, -, *.
- Fokus pada keputusan bisnis praktis.

Isi yang wajib ada:
• Ringkasan dokumen paling penting (1-2 poin).
• Insight keuangan utama dari nominal/tempo.
• Risiko operasional/logistik utama.
• 3 action items paling berdampak.
"""


_INSIGHT_CACHE_TTL = 600
_insight_cache: dict[str, tuple[float, dict]] = {}


def _normalize_bullet_lines(text: str) -> str:
    """Normalize LLM output to concise bullet-only format without markdown markers."""
    cleaned = (text or "").replace("\r", "\n")
    # Remove markdown heading/list markers.
    cleaned = re.sub(r"^[\s#>*-]+", "", cleaned, flags=re.MULTILINE)
    lines = [ln.strip() for ln in cleaned.split("\n") if ln.strip()]

    normalized: list[str] = []
    for ln in lines:
        if ln.startswith("•"):
            normalized.append(ln)
        else:
            normalized.append(f"• {ln}")

    # Keep output tight.
    return "\n".join(normalized[:8])


# ── API Endpoint ───────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_scan(
    req: ScanInsightRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Send scan data to OtaruBot AI for deep analysis.
    Returns markdown-formatted insights.
    """
    client = _get_ai_client()

    cache_payload = {
        "scan_type": req.scan_type,
        "extracted_text": (req.extracted_text or "")[:1800],
        "confidence": req.confidence,
        "status": req.status,
        "nominal_total": req.nominal_total,
        "nama_klien": req.nama_klien,
        "nomor_surat_jalan": req.nomor_surat_jalan,
        "tanggal_jatuh_tempo": req.tanggal_jatuh_tempo,
        "recipient_name": req.recipient_name,
        "rejection_reason": req.rejection_reason,
    }
    cache_key = hashlib.sha256(str(cache_payload).encode("utf-8")).hexdigest()
    now = time.time()
    cached = _insight_cache.get(cache_key)
    if cached and now - cached[0] <= _INSIGHT_CACHE_TTL:
        return dict(cached[1])

    # Build context message from scan data
    fields_info = []
    if req.nominal_total and req.nominal_total > 0:
        fields_info.append(f"- Nominal Total: Rp {req.nominal_total:,.0f}")
    else:
        fields_info.append("- Nominal Total: TIDAK TERDETEKSI")

    if req.nama_klien:
        fields_info.append(f"- Nama Klien: {req.nama_klien}")
    else:
        fields_info.append("- Nama Klien: TIDAK TERDETEKSI")

    if req.nomor_surat_jalan:
        fields_info.append(f"- Nomor Surat Jalan: {req.nomor_surat_jalan}")
    else:
        fields_info.append("- Nomor Surat Jalan: TIDAK TERDETEKSI")

    if req.tanggal_jatuh_tempo:
        fields_info.append(f"- Tanggal Jatuh Tempo: {req.tanggal_jatuh_tempo}")
    else:
        fields_info.append("- Tanggal Jatuh Tempo: TIDAK TERDETEKSI")

    if req.recipient_name:
        fields_info.append(f"- Penerima: {req.recipient_name}")

    fields_str = "\n".join(fields_info)

    user_message = f"""Berikut hasil scan dokumen:

**Tipe Scan**: {req.scan_type.upper()}
**Confidence Level**: {req.confidence}
**Status**: {req.status}

**Data yang Diekstrak:**
{fields_str}

**Teks OCR (ringkasan):**
{(req.extracted_text or 'Tidak ada teks terekstrak')[:1500]}
"""

    if req.rejection_reason:
        user_message += f"\n**Alasan Penolakan:** {req.rejection_reason}"

    # Choose system prompt
    system_prompt = FRAUD_SYSTEM_PROMPT if req.scan_type == "fraud" else DGTNZ_SYSTEM_PROMPT

    try:
        completion = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=420,
        )
        analysis = _normalize_bullet_lines(completion.choices[0].message.content or "")

        result = {
            "analysis": analysis,
            "scan_type": req.scan_type,
            "confidence": req.confidence,
            "status": req.status,
        }
        _insight_cache[cache_key] = (now, dict(result))
        return result

    except Exception as e:
        print(f"❌ Scan insight error: {e}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")
