import os
import json as _json
import re as _re
from functools import lru_cache
from fastapi import HTTPException
from services.kasbon_helpers import _build_ai_context

# In-memory cache for AI recommendations (keyed by loan_id)
_ai_rec_cache: dict[str, dict] = {}

AI_REC_SYSTEM_PROMPT = (
    "Kamu adalah analis kredit senior untuk lembaga keuangan Indonesia (koperasi). "
    "Tugas kamu: menganalisis dokumen pengajuan kasbon (foto struk/invoice/slip gaji) "
    "DAN konteks keuangan pemohon, lalu memberikan rekomendasi kepada admin.\n\n"
    "ANALISIS YANG HARUS DILAKUKAN:\n"
    "1. Analisis FOTO DOKUMEN: Periksa keaslian, tanda manipulasi, kualitas cetak, "
    "   konsistensi font, format tanggal, cap/tanda tangan, dan tanda-tanda pemalsuan.\n"
    "2. Analisis KEUANGAN: Periksa apakah nominal pengajuan wajar terhadap limit, "
    "   sisa kuota, DSR status, riwayat kredit, dan badge tier pemohon.\n"
    "3. Analisis RISIKO: Gabungkan temuan dari foto + keuangan untuk penilaian risiko.\n\n"
    "ATURAN PENTING:\n"
    "- Jika nominal pengajuan > sisa kuota validasi = risiko TINGGI\n"
    "- Jika DSR status = OVER = risiko TINGGI\n"
    "- Jika AI Fraud Status = FRAUD = risiko KRITIS\n"
    "- Jika badge tier PLATINUM + dokumen bersih = risiko RENDAH\n\n"
    "Berikan respons HANYA dalam format JSON tanpa markdown:\n"
    '{"verdict": "APPROVE" | "REJECT" | "REVISI", '
    '"risk": "RENDAH" | "SEDANG" | "TINGGI" | "KRITIS", '
    '"confidence_pct": <integer 0-100, seberapa yakin kamu dengan rekomendasi ini>, '
    '"text": "Penjelasan detail dalam Bahasa Indonesia, mencakup temuan dari foto DAN analisis keuangan. '
    'Sebutkan poin-poin penting yang ditemukan."}'
)

_VALID_VERDICTS = {"APPROVE", "REJECT", "REVISI"}
_VALID_RISKS = {"RENDAH", "SEDANG", "TINGGI", "KRITIS"}


async def kasbon_ai_recommendation_logic(sb, loan_id: str) -> dict:
    """Gemini 2.5 Flash Vision — comprehensive document + financial analysis."""
    # Check cache first
    if loan_id in _ai_rec_cache:
        cached = _ai_rec_cache[loan_id]
        return {"success": True, "recommendation": cached, "cached": True}

    # Fetch full loan record
    loan_res = (
        sb.table("loan_requests")
        .select("id, nik, nominal_pengajuan, image_url, ai_indicator, submitted_at, status, ocr_raw, source, doc_type, ai_fraud_status, ai_fraud_reason")
        .eq("id", loan_id)
        .limit(1)
        .execute()
    )
    loan_rows = getattr(loan_res, "data", None) or []
    if not loan_rows:
        raise HTTPException(status_code=404, detail="Loan not found")

    loan_raw = loan_rows[0]
    nik = loan_raw.get("nik", "")
    ocr_raw = loan_raw.get("ocr_raw") or {}

    # Fetch profile
    profile = {}
    if nik:
        prof_res = sb.table("profiles").select("id, nik, full_name, limit_pinjaman, credits, created_at").eq("nik", nik).limit(1).execute()
        prof_rows = getattr(prof_res, "data", None) or []
        if prof_rows:
            profile = prof_rows[0]

    # Calculate active/pending totals
    approved_total = 0
    pending_total = 0
    if nik:
        active_res = (
            sb.table("loan_requests")
            .select("nominal_pengajuan, status")
            .eq("nik", nik)
            .in_("status", ["PENDING", "APPROVED"])
            .execute()
        )
        active_rows = getattr(active_res, "data", None) or []
        for a in active_rows:
            nominal = int(a.get("nominal_pengajuan") or 0)
            st = str(a.get("status") or "").upper()
            if st == "APPROVED":
                approved_total += nominal
            elif st == "PENDING":
                pending_total += nominal

    # Determine badge tier
    badge_tier = None
    _prof_id = profile.get("id")
    if _prof_id:
        from datetime import datetime, timezone
        current_month = datetime.now(timezone.utc).strftime("%Y-%m")
        try:
            b_res = (
                sb.table("gamification_badges")
                .select("badge_type")
                .eq("user_id", str(_prof_id))
                .eq("month_year", current_month)
                .execute()
            )
            b_rows = getattr(b_res, "data", None) or []
            badge_types = [b.get("badge_type") for b in b_rows]
            if "platinum_integrity" in badge_types:
                badge_tier = "PLATINUM"
            elif "gold_integrity" in badge_types:
                badge_tier = "GOLD"
            elif "silver_integrity" in badge_types:
                badge_tier = "SILVER"
        except Exception:
            pass

    # Build enriched loan context
    enriched_loan = {
        **loan_raw,
        "nama_lengkap": ocr_raw.get("recipient_name") or profile.get("full_name") or "-",
        "no_referensi": ocr_raw.get("no_referensi") or loan_raw.get("id", "")[:8].upper(),
        "dsr_status": ocr_raw.get("dsr_status", "AMAN"),
        "tenor_bulan": ocr_raw.get("tenor_bulan"),
        "cicilan_sistem": ocr_raw.get("cicilan_sistem"),
        "badge_tier": badge_tier,
    }

    context_text = _build_ai_context(enriched_loan, profile, approved_total, pending_total)
    image_url = loan_raw.get("image_url") or ""

    # Call AI via OpenAI proxy
    try:
        from openai import AsyncOpenAI

        _GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
        _GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "")
        _GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini/gemini-2.5-flash")

        if not _GEMINI_API_KEY:
            raise HTTPException(status_code=503, detail="GEMINI_API_KEY tidak dikonfigurasi.")

        client = AsyncOpenAI(
            api_key=_GEMINI_API_KEY,
            base_url=_GEMINI_BASE_URL if _GEMINI_BASE_URL else None
        )

        messages = [
            {"role": "system", "content": AI_REC_SYSTEM_PROMPT},
            {"role": "user", "content": []}
        ]

        img_included = False
        if image_url:
            messages[1]["content"].append({
                "type": "image_url",
                "image_url": {"url": image_url}
            })
            img_included = True
        else:
            messages[1]["content"].append({
                "type": "text",
                "text": "\n[CATATAN: Foto dokumen tidak dapat dimuat. Analisis hanya berdasarkan konteks keuangan.]\n"
            })

        messages[1]["content"].append({
            "type": "text",
            "text": f"\n\n{context_text}"
        })

        response = await client.chat.completions.create(
            model=_GEMINI_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=800,
        )

        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        raw = _re.sub(r"^```(?:json)?\s*", "", raw)
        raw = _re.sub(r"\s*```$", "", raw)

        json_match = _re.search(r"\{.*\}", raw, _re.DOTALL)
        if not json_match:
            raise ValueError(f"No JSON in response: {raw[:200]}")

        parsed = _json.loads(json_match.group())

        verdict = str(parsed.get("verdict", "REVISI")).upper().strip()
        if verdict not in _VALID_VERDICTS:
            verdict = "REVISI"

        risk = str(parsed.get("risk", "SEDANG")).upper().strip()
        if risk not in _VALID_RISKS:
            risk = "SEDANG"

        confidence = int(parsed.get("confidence_pct", 70))
        confidence = max(0, min(100, confidence))

        text = str(parsed.get("text", "Analisis tidak tersedia."))

        recommendation = {
            "verdict": verdict,
            "risk": risk,
            "confidence_pct": confidence,
            "text": text,
            "image_analyzed": img_included,
        }

        # Cache the result
        _ai_rec_cache[loan_id] = recommendation

        return {"success": True, "recommendation": recommendation, "cached": False}

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[AI-Rec] Gemini error: {exc}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=502,
            detail=f"AI analysis failed: {type(exc).__name__}: {str(exc)[:150]}",
        )
