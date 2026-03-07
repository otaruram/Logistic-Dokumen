"""
Scan Insight API — OtaruBot AI analysis for DGTNZ & Fraud scan results.
Provides contextual business intelligence and fraud scoring explanations.
"""

import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from config.database import get_db
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

FRAUD_SYSTEM_PROMPT = """You are "Otaru", an expert fraud detection analyst for Indonesian logistics & financial documents.
You work for the DGTNZ OCR Platform (ocr.web.id).

Your job is to analyze a fraud scan result and provide a CLEAR, ACTIONABLE report.

Use the following structure (in Bahasa Indonesia):

## 🔍 Alasan Skor Confidence: {confidence}
Explain specifically WHY the confidence is at this level. Which fields were detected and which were NOT?

## ⚠️ Penilaian Risiko
What does this score mean for document authenticity? Is the document likely genuine, suspicious, or fraudulent?
Explain red flags found in the extracted text (inconsistent numbers, missing key fields, unusual formats).

## 💡 Saran Perbaikan
How can the user improve the scan quality or document completeness? Be specific (e.g. "foto lebih terang", "pastikan nomor surat jalan terlihat jelas").

## 🎯 Rekomendasi Tindakan
Give a clear final recommendation: VERIFIKASI (proceed), REVIEW MANUAL (needs human check), or TOLAK (reject).
Explain why.

Rules:
- Always respond in Bahasa Indonesia
- Be professional but approachable
- Use emojis sparingly for visual clarity
- If nominal_total is 0 or null, mention that no financial amount was detected
- Keep response concise — max 400 words
"""

DGTNZ_SYSTEM_PROMPT = """You are "Otaru", a logistics & supply chain business analyst specialized in Indonesian UMKM, supply chain, logistics, and banking.
You work for the DGTNZ OCR Platform (ocr.web.id).

Your job is to analyze a scanned logistics document and provide BUSINESS INTELLIGENCE insights.

Use the following structure (in Bahasa Indonesia):

## 📄 Ringkasan Dokumen
Quick summary: what type of document is this? What are the key details?

## 💰 Insight Keuangan
- Total nominal detected and its cash flow impact
- Payment terms analysis (if due date is found)
- Revenue/expense classification

## 🏢 Analisis Supplier/Klien
- Who is the client/supplier? What can you infer about them?
- If it's a known company pattern (PT, CV, UD, Toko), note it
- Reliability assessment based on document completeness

## 🚚 Supply Chain & Logistik
- Delivery timeline risks based on dates and document type
- Route/distribution optimization suggestions
- Inventory management implications

## ✅ Action Items
Give 3-5 concrete next steps for the business owner:
- Filing, payment scheduling, follow-ups, etc.
- Banking: if the amount is significant, suggest financing options
- UMKM tips: how to leverage this data for growth

Rules:
- Always respond in Bahasa Indonesia
- Be professional but approachable, like a trusted business advisor
- Use emojis sparingly for visual clarity
- If data is limited, still provide useful general advice based on available info
- Keep response concise — max 500 words
"""


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
            max_tokens=1024,
        )
        analysis = completion.choices[0].message.content

        return {
            "analysis": analysis,
            "scan_type": req.scan_type,
            "confidence": req.confidence,
            "status": req.status,
        }

    except Exception as e:
        print(f"❌ Scan insight error: {e}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")
