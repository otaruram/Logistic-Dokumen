import hashlib
from typing import Any
from openai import AsyncOpenAI

from config.settings import settings
from config.redis_client import RedisClient
from services.scan_helpers import get_supabase_admin

async def answer_finance_question_with_context(user_id: str, question: str) -> str:
    """Answers a financial question using Otaru's persona, enriched with Supabase user context."""
    q = (question or "").strip()
    if not q:
        return "Halo! Ada yang bisa Otaru bantu hari ini?"

    sb = get_supabase_admin()
    if not sb:
        return "Sistem sedang gangguan, Otaru nggak bisa cek profilmu sekarang."

    context_lines = []
    
    # Context building (try-catch everything to not block AI)
    try:
        # 1. Profile / Credits
        prof_res = sb.table("profiles").select("email,credits").eq("id", user_id).limit(1).execute()
        prof = getattr(prof_res, "data", [{}])[0] if getattr(prof_res, "data", None) else {}
        if prof:
            context_lines.append(f"Email User: {prof.get('email', 'N/A')}")
            context_lines.append(f"Sisa Kuota Sistem: {prof.get('credits', 0)}")

        # 2. KYC Identity
        kyc_res = sb.table("profiles").select("full_name,occupation").eq("id", user_id).limit(1).execute()
        kyc = getattr(kyc_res, "data", [{}])[0] if getattr(kyc_res, "data", None) else {}
        if kyc and kyc.get("full_name"):
            context_lines.append(f"Nama Lengkap: {kyc.get('full_name')}")
            context_lines.append(f"Pekerjaan: {kyc.get('occupation', 'Tidak diketahui')}")

        # 3. Credit / DSR Summary
        try:
            cs_res = sb.table("credit_scores").select("current_cycle_score,dsr_pct,dsr_status").eq("user_id", user_id).limit(1).execute()
            cs = getattr(cs_res, "data", [{}])[0] if getattr(cs_res, "data", None) else {}
            if cs:
                context_lines.append(f"Skor Kredit Aktif: {cs.get('current_cycle_score', 0)}")
                context_lines.append(f"DSR (Beban Hutang): {cs.get('dsr_pct', 0)}% [{cs.get('dsr_status', 'N/A')}]")
        except Exception:
            pass

        # 4. Monthly Finance (Gaji & Cicilan)
        try:
            fin_res = sb.table("user_finances").select("gaji_bulanan,cicilan_aktif").eq("user_id", user_id).limit(1).execute()
            fin = getattr(fin_res, "data", [{}])[0] if getattr(fin_res, "data", None) else {}
            if fin:
                gaji = float(fin.get("gaji_bulanan") or 0)
                cicilan = float(fin.get("cicilan_aktif") or 0)
                context_lines.append(f"Gaji Dilaporkan: Rp {int(gaji):,}")
                context_lines.append(f"Total Cicilan Aktif: Rp {int(cicilan):,}")
        except Exception:
            pass

        # 5. Recent Scans (Fraud attempts)
        if hasattr(sb, "table"):
            try:
                scans_res = sb.table("fraud_scans").select("status,field_confidence").eq("user_id", user_id).order("created_at", desc=True).limit(10).execute()
                scans = getattr(scans_res, "data", None) or []
                if scans:
                    tampered = sum(1 for s in scans if s.get("status") == "tampered" or s.get("field_confidence") == "low")
                    verified = sum(1 for s in scans if s.get("status") == "verified")
                    context_lines.append(f"Riwayat Dokumen (10 terakhir): {verified} Lolos, {tampered} Indikasi Palsu/Tampered")
            except Exception:
                pass

            # 6. Active Loans
            try:
                loans_res = sb.table("loan_requests").select(
                    "nominal_pengajuan,status,created_at,ai_indicator"
                ).eq("user_id", user_id).in_("status", ["PENDING", "APPROVED"]).limit(5).execute()
                loans = getattr(loans_res, "data", None) or []
                if loans:
                    context_lines.append(f"\n--- PINJAMAN AKTIF ---")
                    context_lines.append(f"Jumlah: {len(loans)} transaksi")
                    for ln in loans:
                        context_lines.append(
                            f"  - Rp {int(ln.get('nominal_pengajuan') or 0):,} [{ln.get('status')}] ({ln.get('ai_indicator', 'N/A')})"
                        )
            except Exception:
                pass
    except Exception:
        pass

    user_context = "\n".join(context_lines) if context_lines else "Data profil tidak tersedia."
    
    # ── Redis Cache: user_id + hash(financial_data) ──────────────────────────
    import json as _json
    q_hash = hashlib.md5(q.encode()).hexdigest()[:10]
    ctx_hash = hashlib.md5(user_context.encode()).hexdigest()[:12]
    cache_key = f"otaru_ai:{user_id}:{q_hash}"
    
    try:
        cached_raw = RedisClient.get_cache(cache_key)
        if cached_raw and isinstance(cached_raw, dict):
            if cached_raw.get("ctx_hash") == ctx_hash:
                return cached_raw.get("answer", "")
    except Exception:
        pass

    # ── System Prompt (Gemini 2.0 Flash optimized) ───────────────────────────
    system_prompt = (
        "Kamu adalah OTARU, Financial Consultant Expert untuk OtaruChain & Otaru Financial.\n\n"
        "ATURAN KETAT:\n"
        "• Proaktif dan blak-blakan. SELALU berikan saran spesifik berdasarkan DATA user di bawah.\n"
        "• Data-driven: gunakan angka real dari profil, bukan nasihat generik.\n"
        "• Actionable: berikan langkah konkret yang bisa dilakukan HARI INI.\n"
        "• Jujur: jangan sugarcoat kondisi finansial yang buruk.\n\n"
        "DATA USER (RAHASIA, hanya untuk konteks):\n"
        f"{user_context}\n\n"
        "TUGAS:\n"
        "1. Jawab pertanyaan user secara SINGKAT, PADAT, dan TO-THE-POINT.\n"
        "2. Jika ada DSR >30%, PERINGATKAN dengan tegas.\n"
        "3. Jika ada Tampered Attempts >0, JELASKAN dampaknya.\n"
        "4. Berikan budget harian berdasarkan gaji - cicilan.\n\n"
        "FORMAT (DILARANG DILANGGAR):\n"
        "• DILARANG menggunakan asterisk (*), bold (**), heading (#), atau format markdown.\n"
        "• Gunakan HANYA simbol bullet • untuk daftar.\n"
        "• Jawaban MAKSIMAL 3-4 kalimat pendek.\n\n"
        "WAJIB: Setiap jawaban HARUS diakhiri dengan 1 pertanyaan lanjutan yang kontekstual "
        "dan engaging untuk menjaga percakapan. Contoh: "
        "'Apakah ada cicilan lain yang belum kamu laporkan ke sistem?'"
    )

    # ── Sumopod Gemini Proxy via OpenAI client ──
    api_key = settings.GEMINI_API_KEY or ""
    if not api_key:
        return "Otaru sedang offline untuk konsultasi saat ini. Coba lagi sebentar."

    base_url = getattr(settings, "GEMINI_BASE_URL", "https://ai.sumopod.com/v1")
    model_name = getattr(settings, "GEMINI_MODEL", "gemini/gemini-2.5-flash")
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    try:
        resp = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": q},
            ],
            temperature=0.3,
            max_tokens=200,
        )

        content = (resp.choices[0].message.content or "").strip()
        # Strict formatting cleanup
        clean = content.replace("**", "").replace("*", "").replace("# ", "").replace("## ", "")
        
        if clean:
            # Cache the response
            try:
                RedisClient.set_cache(cache_key, {"answer": clean, "ctx_hash": ctx_hash}, ttl=3600)
            except Exception:
                pass
            return clean
            
        return "Otaru tidak dapat menghasilkan jawaban saat ini. Coba ulangi pertanyaannya."
    except Exception as e:
        print(f"[Otaru AI] AI proxy error: {e}")
        return "Otaru lagi gangguan sesaat. Coba kirim ulang pertanyaan dalam beberapa detik."


async def answer_freeform_question(
    question: str,
    *,
    max_input_words: int = 120,
    max_output_words: int = 90,
) -> str:
    """Answer random Telegram questions with concise Otaru persona (no credit deduction)."""
    q = (question or "").strip()
    if not q:
        return "Tulis pertanyaannya dulu, nanti Otaru jawab singkat dan jelas."

    words = q.split()
    if len(words) > max_input_words:
        return (
            f"Pertanyaannya kepanjangan. Maksimal {max_input_words} kata. "
            "Ringkas dulu ya, biar Otaru jawab cepat dan tepat."
        )

    # ── Sumopod Gemini Proxy via OpenAI client ──
    api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
    if not api_key:
        return "Otaru sedang offline untuk Q&A saat ini. Coba lagi sebentar lagi."

    base_url = getattr(settings, "GEMINI_BASE_URL", "https://ai.sumopod.com/v1")
    model_name = getattr(settings, "GEMINI_MODEL", "gemini/gemini-2.5-flash")
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    system_prompt = (
        "Kamu adalah Otaru, asisten Telegram OtaruChain. "
        "Karakter: to-the-point, praktis, profesional, tidak bertele-tele. "
        "Jawab dalam Bahasa Indonesia. "
        f"Batas jawaban MAKSIMAL {max_output_words} kata. "
        "Fokus langsung ke inti jawaban dan langkah aksi singkat bila perlu."
    )

    try:
        resp = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": q},
            ],
            temperature=0.3,
            max_tokens=240,
        )
        content = (resp.choices[0].message.content or "").strip()
        out_words = content.split()
        if len(out_words) > max_output_words:
            content = " ".join(out_words[:max_output_words]).rstrip(".,;: ") + "..."
        return content or "Belum ada jawaban yang valid. Coba ulangi pertanyaannya secara lebih spesifik."
    except Exception as e:
        print(f"[Otaru AI] AI proxy freeform error: {e}")
        return "Otaru lagi gangguan sesaat. Coba kirim ulang pertanyaan dalam beberapa detik."
