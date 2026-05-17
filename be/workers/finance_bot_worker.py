"""
Otaru Financial Bot Worker — standalone long-polling untuk @otarufinance_bot.

Fitur:
- /start [key]    : tampil menu langsung; key optional untuk aktivasi login
- Cek Skor        : Otaru Index (DSR 30% + Consistency 30% + Integrity 40%)
- Sisa Plafon     : limit vs cicilan aktif
- Update Profil   : input manual gaji, tanggungan, cicilan
- Upload Dokumen  : foto slip gaji / struk belanja -> OCR -> classifier -> update verified salary
- Family Sharing  : buat invite, accept invite, notif otomatis
- Sertifikat      : ringkasan skor untuk bank/leasing
- Tanya Otaru     : freeform QnA kredit
"""

from __future__ import annotations

import asyncio
import re
from typing import Any, Optional

import requests

from config.settings import settings
from services.otaru_finance_service import (
    accept_family_invite,
    calculate_otaru_index,
    create_family_invite,
    get_installments,
    notify_family_viewers,
    process_personal_doc_upload,
    resolve_user_id_by_chat,
    upsert_manual_profile,
)
from services.telegram_service import (
    answer_freeform_question,
    get_link_by_chat_id,
    link_chat_to_user,
    unlink_chat,
)

TOKEN = settings.TELEGRAM_FINANCE_BOT_TOKEN
BASE_URL = f"https://api.telegram.org/bot{TOKEN}" if TOKEN else ""

# Per-chat state machine: chat_id -> mode string
_STATE: dict[int, str] = {}


# ─────────────────────────────────────────────────────────────────────────────
# KEYBOARD
# ─────────────────────────────────────────────────────────────────────────────

def _menu_keyboard() -> dict[str, Any]:
    return {
        "keyboard": [
            [{"text": "📊 Cek Skor Kesehatan"}, {"text": "🏦 Sisa Plafon Aman"}],
            [{"text": "📝 Update Profil"},       {"text": "📄 Upload Dokumen"}],
            [{"text": "🛡️ Sertifikat Kredit"},   {"text": "👨\u200d👩\u200d👧\u200d👦 Family Sharing"}],
            [{"text": "🪪 Verifikasi KYC"},      {"text": "💬 Tanya Otaru"}],
            [{"text": "🔄 Ganti Akun"}],
        ],
        "resize_keyboard": True,
        "persistent": True,
    }


def _cancel_keyboard() -> dict[str, Any]:
    return {"keyboard": [[{"text": "❌ Batal"}]], "resize_keyboard": True}


# ─────────────────────────────────────────────────────────────────────────────
# API HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _api(method: str, payload: dict[str, Any]) -> dict[str, Any]:
    r = requests.post(f"{BASE_URL}/{method}", json=payload, timeout=30)
    r.raise_for_status()
    data = r.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram error: {data}")
    return data


def _send(chat_id: int, text: str, *, keyboard: bool = True, kb: dict | None = None) -> None:
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if kb is not None:
        payload["reply_markup"] = kb
    elif keyboard:
        payload["reply_markup"] = _menu_keyboard()
    try:
        _api("sendMessage", payload)
    except Exception:
        plain = re.sub(r"<[^>]+>", "", text)[:3800]
        fallback: dict[str, Any] = {"chat_id": chat_id, "text": plain, "disable_web_page_preview": True}
        if kb is not None:
            fallback["reply_markup"] = kb
        elif keyboard:
            fallback["reply_markup"] = _menu_keyboard()
        try:
            _api("sendMessage", fallback)
        except Exception:
            pass


def _format_idr(amount: float) -> str:
    return f"Rp {int(amount):,}".replace(",", ".")


def _disable_webhook() -> None:
    try:
        _api("deleteWebhook", {"drop_pending_updates": False})
        print("[finance_bot_worker] webhook disabled -> polling mode")
    except Exception as e:
        print(f"[finance_bot_worker] deleteWebhook failed: {e}")


def _get_updates(offset: Optional[int]) -> list[dict[str, Any]]:
    payload: dict[str, Any] = {"timeout": 25, "allowed_updates": ["message", "callback_query"]}
    if offset is not None:
        payload["offset"] = offset
    return _api("getUpdates", payload).get("result", [])


def _download_file(file_id: str) -> bytes:
    info = _api("getFile", {"file_id": file_id})
    file_path = info["result"]["file_path"]
    url = f"https://api.telegram.org/file/bot{TOKEN}/{file_path}"
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    return r.content


# ─────────────────────────────────────────────────────────────────────────────
# COMMAND HANDLERS
# ─────────────────────────────────────────────────────────────────────────────

def _handle_start(chat_id: int, message: dict[str, Any], text: str) -> None:
    _STATE.pop(chat_id, None)
    _send(
        chat_id,
        "<b>🏦 Selamat datang di Otaru Financial Bot!</b>\n"
        "Kelola profil kredit kamu: cek skor, upload slip gaji, atur cicilan, dan bagikan ke keluarga.",
    )
    parts = text.split()
    if len(parts) >= 2:
        tele_key = parts[1].strip()
        phone_number = parts[2].strip() if len(parts) >= 3 else None
        from_user = message.get("from", {})

        # Validate phone if provided
        if phone_number:
            clean = phone_number.replace("+62", "0").replace("-", "").replace(" ", "")
            if clean.isdigit() and len(clean) >= 10 and len(clean) <= 13 and clean.startswith("0"):
                phone_number = clean
            else:
                phone_number = None  # Invalid format, skip

        try:
            link_chat_to_user(
                tele_key=tele_key,
                chat_id=chat_id,
                telegram_user_id=from_user.get("id"),
                username=from_user.get("username"),
                phone_number=phone_number,
            )
            phone_msg = f"\n📱 No. HP: <code>{phone_number}</code>" if phone_number else ""
            _send(chat_id, f"✅ <b>Login berhasil!</b>{phone_msg} Data personal sekarang aktif.")
        except Exception as e:
            _send(chat_id, f"⚠️ <b>Login gagal:</b> {str(e)[:200]}\nMenu tetap tersedia.")


def _handle_score(chat_id: int) -> None:
    user_id = resolve_user_id_by_chat(chat_id)
    if not user_id:
        _send(chat_id, "🔐 <b>Login dulu.</b>\nBuka web → Telegram Connect → Generate Key\nlalu kirim: <code>/start KEY</code>")
        return
    try:
        s = calculate_otaru_index(user_id)
        _send(
            chat_id,
            f"📊 <b>Otaru Integrity Index</b>: <b>{s['otaru_index']}</b>/1000\n"
            f"Grade: <b>{s['credit_grade']}</b>\n\n"
            f"🔸 DSR Score: <b>{s['dsr_score']}</b>/300 (DSR {s['dsr_percent']}%)\n"
            f"🔸 Consistency: <b>{s['consistency_score']}</b>/300\n"
            f"🔸 Integrity: <b>{s['integrity_score']}</b>/400 ← USP\n\n"
            f"Integrity Level: <b>{s['integrity_level']}</b> | Tampered: <b>{s['tampered_attempts']}x</b>\n"
            f"Gaji sumber: <b>{s['salary_source']}</b>",
        )
    except Exception as e:
        _send(chat_id, f"❌ <b>Gagal ambil skor</b>\n{str(e)[:300]}")


def _handle_plafon(chat_id: int) -> None:
    user_id = resolve_user_id_by_chat(chat_id)
    if not user_id:
        _send(chat_id, "🔐 <b>Login dulu.</b>\nKirim <code>/start KEY</code>")
        return
    try:
        s = calculate_otaru_index(user_id)
        cicilan_list = get_installments(user_id)
        detail = "\n".join(f"  • {c['nama_pinjaman']}: {_format_idr(c['cicilan_bulanan'])}/bln" for c in cicilan_list) or "  (belum ada cicilan tercatat)"
        _send(
            chat_id,
            f"🏦 <b>Sisa Plafon Aman</b>\n"
            f"Gaji: <b>{_format_idr(s['salary'])}</b> ({s['salary_source']})\n"
            f"Cicilan aktif: <b>{_format_idr(s['cicilan_aktif_total'])}</b>\n"
            f"DSR: <b>{s['dsr_percent']}%</b>\n"
            f"Sisa Plafon: <b>{_format_idr(s['sisa_plafon_aman'])}</b>\n\n"
            f"Detail cicilan:\n{detail}",
        )
    except Exception as e:
        _send(chat_id, f"❌ <b>Gagal hitung plafon</b>\n{str(e)[:300]}")


def _handle_update_profil_start(chat_id: int) -> None:
    user_id = resolve_user_id_by_chat(chat_id)
    if not user_id:
        _send(chat_id, "🔐 Login dulu untuk update profil.")
        return
    _STATE[chat_id] = "update_profil:gaji"
    _send(
        chat_id,
        "📝 <b>Update Profil Keuangan</b>\n\n"
        "Langkah 1/3: Berapa <b>gaji bulanan</b> kamu? (contoh: <code>5000000</code>)\n"
        "Kirim <code>skip</code> untuk lewati.",
        kb=_cancel_keyboard(),
    )


def _handle_upload_start(chat_id: int) -> None:
    user_id = resolve_user_id_by_chat(chat_id)
    if not user_id:
        _send(chat_id, "🔐 Login dulu untuk upload dokumen.")
        return

    # ── Send direct ImageKit dummy slip gaji URL ──
    from workers.handlers.dummy_doc_generator import make_dummy_png as _make_dummy_png
    from services.imagekit_service import ImageKitService
    import uuid

    _send(chat_id, "⏳ <b>Menyiapkan Dokumen Dummy...</b>\nSistem akan mengirim gambar slip gaji dummy langsung.", keyboard=False)

    try:
        png_bytes = _make_dummy_png("slip_gaji")
        # Upload to ImageKit CDN for permanent URL
        unique_name = f"dummy_slip_gaji_{str(uuid.uuid4())[:8]}.png"
        ik_result = ImageKitService.upload_file(
            png_bytes,
            file_name=unique_name,
            folder="/otaru_finance_dummy",
        )
        image_url = ik_result.get("url", "")

        if image_url:
            # Send the direct URL to user
            _send(
                chat_id,
                f"📄 <b>Dummy Slip Gaji</b>\n\n"
                f"🔗 <b>Image URL (CDN):</b>\n<code>{image_url}</code>\n\n"
                "👆 Kamu bisa preview atau copy URL di atas.\n"
                "Dokumen ini akan otomatis dikirim ke Admin Approval Queue.",
                keyboard=False,
            )

            # Send as photo too for visual preview
            try:
                files = {"photo": (unique_name, png_bytes, "image/png")}
                data = {"chat_id": chat_id, "caption": "👆 Dummy slip gaji — sudah dikirim ke Approval Queue"}
                requests.post(
                    f"https://api.telegram.org/bot{TOKEN}/sendPhoto",
                    data=data, files=files, timeout=15,
                )
            except Exception:
                pass

            # ── Auto-submit to Admin Approval Queue ──
            try:
                import requests as req
                from config.settings import settings as _s
                api_base = _s.API_BASE_URL if hasattr(_s, 'API_BASE_URL') else "http://localhost:8000"
                req.post(
                    f"{api_base}/api/kasbon/process-document",
                    json={
                        "image_url": image_url,
                        "telegram_chat_id": chat_id,
                    },
                    timeout=10,
                )
                _send(chat_id, "✅ <b>Dokumen berhasil dikirim ke Approval Queue!</b>\nAdmin akan mereview dan memberikan stamp verifikasi.")
            except Exception as enqueue_err:
                _send(chat_id, f"⚠️ Dokumen berhasil diupload tapi gagal masuk antrian: {str(enqueue_err)[:100]}")
        else:
            _send(chat_id, "❌ Gagal mengupload dummy ke CDN. Coba lagi.")
    except Exception as e:
        _send(chat_id, f"❌ <b>Gagal proses dokumen</b>\n{str(e)[:300]}")

def _handle_upload_start(chat_id: int) -> None:
    user_id = resolve_user_id_by_chat(chat_id)
    if not user_id:
        _send(chat_id, "🔐 Login dulu dengan mengetik: `/start <token-dari-web>`")
        return

    _STATE[chat_id] = "upload_dokumen"
    _send(
        chat_id,
        "📄 <b>Upload Dokumen Pendukung</b>\n\n"
        "Sistem telah menyiapkan formulir slip gaji dummy untuk kamu uji coba.\n"
        "Silakan unduh gambar di bawah ini, lalu <b>kirim/upload ulang sebagai foto</b> ke chat ini."
    )
    
    # Generate and send dummy
    from workers.handlers.dummy_doc_generator import make_dummy_png as _make_dummy_png
    try:
        png_bytes = _make_dummy_png("slip_gaji")
        # Direct Telegram API call to send photo
        import requests
        from config.settings import settings
        files = {"photo": ("otaru_dummy_slip_gaji.png", png_bytes, "image/png")}
        data = {"chat_id": chat_id, "caption": "👇 Download dan kirim ulang foto ini"}
        requests.post(f"https://api.telegram.org/bot{settings.TELEGRAM_FINANCE_BOT_TOKEN}/sendPhoto", data=data, files=files)
    except Exception as e:
        _send(chat_id, f"⚠️ Gagal memuat form dummy: {e}")


def _handle_family_start(chat_id: int) -> None:
    _send(
        chat_id,
        "👨\u200d👩\u200d👧\u200d👦 <b>Family Sharing</b>\n\n"
        "Pilih aksi:\n"
        "/family_invite — Buat undangan untuk anggota keluarga\n"
        "/family_accept — Accept undangan (masukkan token)\n\n"
        "<i>Akses view-only, sesuai UU PDP. Semua akses tercatat.</i>",
    )


def _handle_cert(chat_id: int) -> None:
    user_id = resolve_user_id_by_chat(chat_id)
    if not user_id:
        _send(chat_id, "🔐 Login dulu.\nKirim <code>/start KEY</code>")
        return
    try:
        s = calculate_otaru_index(user_id)
        
        # Check gamification badges
        from services.scan_helpers import get_supabase_admin
        from datetime import datetime, timezone
        from api.gamification import _get_existing_badges
        from services.certificate_service import issue_integrity_certificate
        
        sb = get_supabase_admin()
        month_year = datetime.now(timezone.utc).strftime("%Y-%m")
        existing = _get_existing_badges(sb, user_id, month_year)
        
        badge_tier = None
        if "platinum_integrity" in existing:
            badge_tier = "PLATINUM"
        elif "gold_integrity" in existing:
            badge_tier = "GOLD"
        elif "silver_integrity" in existing:
            badge_tier = "SILVER"
            
        caption = (
            f"🛡️ <b>Sertifikat Kredit & Integrity Otaru</b>\n\n"
            f"Otaru Index: <b>{s['otaru_index']}</b>/1000  |  Grade: <b>{s['credit_grade']}</b>\n"
            f"Integrity Level: <b>{s['integrity_level']}</b>  |  DSR: <b>{s['dsr_percent']}%</b>\n"
            f"Tampered Attempts: <b>{s['tampered_attempts']}x</b>\n"
            f"Gaji Verified: <b>{'Ya ✅' if s.get('salary_source') == 'ocr_verified' else 'Belum (manual) ⚠️'}</b>\n\n"
        )
        
        if badge_tier:
            caption += f"🏆 <b>Badge Bulan Ini: {badge_tier}</b>\n\n<i>Sertifikat PDF resmi terlampir. Dokumen ini dilindungi SHA-256 hash dan sah digunakan untuk bank/leasing.</i>"
            badge_data = existing.get(f"{badge_tier.lower()}_integrity", {})
            verified_count = badge_data.get("verified_count", 0)
            
            # Generate PDF
            hash_val, pdf_bytes = issue_integrity_certificate(
                sb=sb,
                user_id=user_id,
                badge_tier=badge_tier,
                month_year=month_year,
                verified_count=verified_count,
                otaru_index=s['otaru_index']
            )
            
            # Send document
            url = f"{BASE_URL}/sendDocument"
            files = {
                "document": (f"Otaru_Integrity_Certificate_{month_year}.pdf", pdf_bytes, "application/pdf")
            }
            data = {
                "chat_id": chat_id,
                "caption": caption,
                "parse_mode": "HTML"
            }
            res = requests.post(url, data=data, files=files, timeout=30)
            if res.status_code != 200:
                _send(chat_id, caption) # fallback
        else:
            caption += "<i>Anda belum memiliki Integrity Badge bulan ini. Capai minimal Silver (50 dokumen verified) untuk mendapatkan PDF Sertifikat resmi.</i>"
            _send(chat_id, caption)

    except Exception as e:
        _send(chat_id, f"❌ Gagal buat sertifikat: {str(e)[:300]}")


def _handle_profil(chat_id: int) -> None:
    link = get_link_by_chat_id(chat_id)
    if not link:
        _send(chat_id, "⚙️ <b>Profil</b>\nStatus: 🔴 Belum login\nKirim <code>/start KEY</code>")
        return
    user_id = link.get("user_id", "")
    try:
        s = calculate_otaru_index(user_id)
        # Fetch KYC status from profiles
        kyc_line = ""
        try:
            from services.scan_helpers import get_supabase_admin
            sb = get_supabase_admin()
            if sb:
                p = sb.table("profiles").select("nik,ktp_photo_url,selfie_photo_url,data_consent_given").eq("id", user_id).limit(1).execute()
                if p.data:
                    row = p.data[0]
                    nik_val = row.get("nik") or ""
                    nik_display = f"{nik_val[:4]}{'*'*8}{nik_val[-4:]}" if len(nik_val) >= 8 else (nik_val or "Belum diisi")
                    has_ktp = "✅" if row.get("ktp_photo_url") else "❌"
                    has_selfie = "✅" if row.get("selfie_photo_url") else "❌"
                    consent = "✅ Aktif (UU PDP)" if row.get("data_consent_given") else "❌ Belum diberikan"
                    kyc_line = (
                        f"\n\n🪪 <b>Status KYC</b>\n"
                        f"NIK: <code>{nik_display}</code>\n"
                        f"KTP: {has_ktp} | Selfie: {has_selfie}\n"
                        f"Consent: {consent}"
                    )
        except Exception:
            pass
        _send(
            chat_id,
            f"⚙️ <b>Profil Akun</b>\n"
            f"Status: 🟢 Terhubung\n"
            f"Skor terakhir: <b>{s['otaru_index']}/1000</b> (Grade {s['credit_grade']})\n"
            f"Gaji: <b>{_format_idr(s['salary'])}</b> ({s['salary_source']})"
            f"{kyc_line}",
        )
    except Exception:
        _send(chat_id, f"⚙️ Status: 🟢 Terhubung\nUser ID: <code>{str(user_id)[:8]}…</code>")


def _handle_reset(chat_id: int) -> None:
    _STATE.pop(chat_id, None)
    ok = unlink_chat(chat_id)
    if ok:
        _send(chat_id, "🔄 <b>Akun di-reset.</b>\nGenerate key baru di web lalu kirim <code>/start KEY</code>", keyboard=False)
        _send(chat_id, "Menu masih tersedia:", keyboard=True)
    else:
        _send(chat_id, "ℹ️ Tidak ada akun yang terhubung.")


async def _handle_freeform(chat_id: int, text: str) -> None:
    """Tanya Otaru — AI Financial Consultant with full read-access to user data."""
    user_id = resolve_user_id_by_chat(chat_id)
    context_block = ""
    if user_id:
        try:
            s = calculate_otaru_index(user_id)
            installments = get_installments(user_id)
            cicilan_detail = ", ".join(
                f"{c['nama_pinjaman']}: Rp{int(c['cicilan_bulanan']):,}/bln" for c in installments
            ) if installments else "Tidak ada cicilan aktif"
            context_block = (
                f"\n\n--- DATA FINANSIAL USER (RAHASIA, gunakan untuk menjawab) ---\n"
                f"Otaru Index: {s['otaru_index']}/1000 (Grade {s['credit_grade']})\n"
                f"Integrity Level: {s['integrity_level']} | Tampered Attempts: {s['tampered_attempts']}x\n"
                f"DSR: {s['dsr_percent']}% | Gaji: Rp{int(s['salary']):,} ({s['salary_source']})\n"
                f"Cicilan Aktif Total: Rp{int(s['cicilan_aktif_total']):,}\n"
                f"Sisa Plafon Aman: Rp{int(s['sisa_plafon_aman']):,}\n"
                f"Detail Cicilan: {cicilan_detail}\n"
                f"--- END DATA ---\n"
                f"Kamu adalah konsultan keuangan bernama Otaru. "
                f"Jawab dalam Bahasa Indonesia yang ramah dan profesional. "
                f"Berikan saran spesifik berdasarkan data user di atas. "
                f"Jangan pernah menampilkan data mentah, jelaskan dengan bahasa yang mudah dipahami."
            )
        except Exception:
            pass  # Fallback to generic AI if score lookup fails

    enriched_prompt = text + context_block
    answer = await answer_freeform_question(enriched_prompt, max_input_words=300, max_output_words=200)
    
    # Strip asterisks for cleaner formatting (Task 3 requirement)
    clean_answer = answer.replace("**", "").replace("*", "")
    
    _send(chat_id, f"<b>🤖 Otaru:</b> {clean_answer}")


# ─────────────────────────────────────────────────────────────────────────────
# STATE MACHINE HANDLERS
# ─────────────────────────────────────────────────────────────────────────────

# Temp storage per-chat untuk multi-step input
_TEMP: dict[int, dict[str, Any]] = {}


def _handle_state(chat_id: int, text: str, photo: Any) -> bool:
    """Returns True jika state tertangani (jangan proses lebih lanjut)."""
    state = _STATE.get(chat_id)
    if not state:
        return False

    if text in ("❌ Batal", "/batal"):
        _STATE.pop(chat_id, None)
        _TEMP.pop(chat_id, None)
        _send(chat_id, "✖️ Dibatalkan.")
        return True

    user_id = resolve_user_id_by_chat(chat_id)
    if not user_id:
        _STATE.pop(chat_id, None)
        _send(chat_id, "🔐 Session expired. Kirim /start lagi.")
        return True

    # ── UPDATE PROFIL FLOW ──
    if state == "update_profil:gaji":
        if text.lower() != "skip":
            cleaned = re.sub(r"[.,\s]", "", text)
            if cleaned.isdigit():
                _TEMP.setdefault(chat_id, {})["gaji_bulanan"] = int(cleaned)
            else:
                _send(chat_id, "❌ Format salah. Masukkan angka saja, contoh: <code>5000000</code>", kb=_cancel_keyboard())
                return True
        _STATE[chat_id] = "update_profil:tanggungan"
        _send(chat_id, "Langkah 2/3: Berapa jumlah <b>tanggungan</b>? (orang, contoh: <code>3</code>)\nKirim <code>skip</code> untuk lewati.", kb=_cancel_keyboard())
        return True

    if state == "update_profil:tanggungan":
        if text.lower() != "skip":
            if text.isdigit():
                _TEMP.setdefault(chat_id, {})["tanggungan"] = int(text)
            else:
                _send(chat_id, "❌ Format salah. Masukkan angka.", kb=_cancel_keyboard())
                return True
        _STATE[chat_id] = "update_profil:pekerjaan"
        _send(chat_id, "Langkah 3/3: Apa <b>pekerjaan</b> kamu? (contoh: <code>Karyawan Swasta</code>)\nKirim <code>skip</code> untuk lewati.", kb=_cancel_keyboard())
        return True

    if state == "update_profil:pekerjaan":
        if text.lower() != "skip":
            _TEMP.setdefault(chat_id, {})["pekerjaan"] = text
        data = _TEMP.pop(chat_id, {})
        _STATE.pop(chat_id, None)
        result = upsert_manual_profile(user_id, data)
        if result.get("updated"):
            _send(chat_id, f"✅ <b>Profil diperbarui!</b>\nField: {', '.join(result['fields'])}\n\nSkor akan dihitung ulang otomatis.")
        else:
            _send(chat_id, "ℹ️ Tidak ada data yang berubah.")
        return True

    if state == "cicilan:lembaga":
        # Legacy — Tambah Cicilan removed; clear state and inform user
        _STATE.pop(chat_id, None)
        _TEMP.pop(chat_id, None)
        _send(chat_id, "ℹ️ Fitur Tambah Cicilan sudah tidak aktif. Gunakan menu lain.")
        return True

    if state in ("cicilan:nama", "cicilan:nominal"):
        _STATE.pop(chat_id, None)
        _TEMP.pop(chat_id, None)
        _send(chat_id, "ℹ️ Fitur Tambah Cicilan sudah tidak aktif. Gunakan menu lain.")
        return True



    # ── FAMILY INVITE FLOW ──
    if state == "family_invite:contact":
        _STATE.pop(chat_id, None)
        contact = text.strip()
        try:
            result = create_family_invite(user_id, contact)
            _send(
                chat_id,
                f"✅ <b>Invite dibuat!</b>\n\n"
                f"Token (berlaku 48 jam):\n<code>{result['invite_token']}</code>\n\n"
                f"Minta anggota keluarga kirim:\n<code>/family_accept {result['invite_token']}</code>\n"
                f"di @otarufinance_bot",
            )
        except Exception as e:
            _send(chat_id, f"❌ Gagal buat invite: {str(e)[:200]}")
        return True

    # ── FAMILY ACCEPT FLOW ──
    if state == "family_accept:token":
        _STATE.pop(chat_id, None)
        token = text.strip()
        try:
            result = accept_family_invite(user_id, token)
            _send(chat_id, f"✅ <b>Berhasil!</b> Kamu sekarang bisa melihat data kredit anggota keluarga.\nOwner: <code>{str(result['owner_user_id'])[:8]}…</code>")
            # Notif ke viewers juga
            notify_family_viewers(result["owner_user_id"], "👨\u200d👩\u200d👧\u200d👦 Anggota keluarga baru bergabung ke Family Sharing kamu.")
        except Exception as e:
            _send(chat_id, f"❌ Gagal accept invite: {str(e)[:200]}")
        return True

    # ── KYC FLOW ──
    if state == "kyc:nik":
        cleaned = re.sub(r"[\s\-]", "", text)
        if not re.fullmatch(r"\d{16}", cleaned):
            _send(chat_id, "❌ NIK harus tepat <b>16 digit angka</b>. Coba lagi:", kb=_cancel_keyboard())
            return True
        _TEMP.setdefault(chat_id, {})["nik"] = cleaned
        _STATE[chat_id] = "kyc:ktp_photo"
        _send(chat_id, "📸 Langkah 2/4: Kirimkan <b>foto KTP</b> kamu (pastikan jelas dan tidak buram).", kb=_cancel_keyboard())
        return True

    if state == "kyc:ktp_photo":
        if not photo:
            _send(chat_id, "❌ Kirimkan <b>foto</b>, bukan teks. Upload foto KTP kamu:", kb=_cancel_keyboard())
            return True
        _send(chat_id, "⏳ Mengupload foto KTP...", keyboard=False)
        try:
            file_id = photo[-1]["file_id"]
            img = _download_file(file_id)
            from services.imagekit_service import ImageKitService
            import uuid
            res = ImageKitService.upload_file(img, file_name=f"ktp_{uuid.uuid4().hex[:8]}.jpg", folder="/kyc/ktp")
            _TEMP.setdefault(chat_id, {})["ktp_photo_url"] = res.get("url", "")
            _STATE[chat_id] = "kyc:selfie_photo"
            _send(chat_id, "📸 Langkah 3/4: Kirimkan <b>foto selfie</b> kamu untuk verifikasi wajah.", kb=_cancel_keyboard())
        except Exception as e:
            _send(chat_id, f"❌ Gagal upload KTP: {str(e)[:200]}\nCoba kirim ulang foto:", kb=_cancel_keyboard())
        return True

    if state == "kyc:selfie_photo":
        if not photo:
            _send(chat_id, "❌ Kirimkan <b>foto selfie</b>, bukan teks:", kb=_cancel_keyboard())
            return True
        _send(chat_id, "⏳ Mengupload foto selfie...", keyboard=False)
        try:
            file_id = photo[-1]["file_id"]
            img = _download_file(file_id)
            from services.imagekit_service import ImageKitService
            import uuid
            res = ImageKitService.upload_file(img, file_name=f"selfie_{uuid.uuid4().hex[:8]}.jpg", folder="/kyc/selfie")
            _TEMP.setdefault(chat_id, {})["selfie_photo_url"] = res.get("url", "")
            _STATE[chat_id] = "kyc:consent"
            consent_payload = {
                "chat_id": chat_id,
                "text": (
                    "📋 <b>Langkah 4/4: Persetujuan Data (UU PDP)</b>\n\n"
                    "Sesuai UU Pelindungan Data Pribadi (UU PDP), apakah Anda setuju "
                    "data identitas dan skor kredit Anda dibagikan secara aman kepada "
                    "Mitra Koperasi/LJK untuk keperluan pengajuan kasbon?\n\n"
                    "<i>Data Anda dienkripsi AES-256 dan hanya diakses melalui API terotorisasi.</i>"
                ),
                "parse_mode": "HTML",
                "reply_markup": {
                    "inline_keyboard": [
                        [{"text": "✅ Saya Setuju", "callback_data": "kyc_consent_yes"},
                         {"text": "❌ Tolak", "callback_data": "kyc_consent_no"}]
                    ]
                },
            }
            _api("sendMessage", consent_payload)
        except Exception as e:
            _send(chat_id, f"❌ Gagal upload selfie: {str(e)[:200]}\nCoba kirim ulang:", kb=_cancel_keyboard())
        return True

    if state == "upload_dokumen" and photo:
        _STATE.pop(chat_id, None)
        _send(chat_id, "⏳ <b>Memproses dokumen...</b>\nMengunggah gambar dan mencocokkan data.")
        try:
            photo_file_id = photo[-1]["file_id"]
            file_info_resp = requests.get(f"https://api.telegram.org/bot{TOKEN}/getFile?file_id={photo_file_id}")
            file_info = file_info_resp.json()
            file_path = file_info.get("result", {}).get("file_path")
            image_url = ""
            if file_path:
                dl_url = f"https://api.telegram.org/file/bot{TOKEN}/{file_path}"
                img_data = requests.get(dl_url).content
                from services.imagekit_service import ImageKitService
                import uuid
                unique_name = f"finance_upload_{str(uuid.uuid4())[:8]}.jpg"
                ik_result = ImageKitService.upload_file(img_data, file_name=unique_name, folder="/otaru_finance_uploads")
                image_url = ik_result.get("url", "")
            from services.otaru_finance_service import process_beta_dummy_doc_upload
            res = process_beta_dummy_doc_upload(user_id, "slip_gaji", "telegram", image_url=image_url)
            msg = (
                "✅ <b>Dokumen Diterima</b>\n\n"
                f"Tipe: Slip Gaji\nNominal Terekstrak: {_format_idr(res['extracted_nominal'])}\n\n"
            )
            if image_url:
                msg += f"🔗 <b>Preview:</b>\n<code>{image_url}</code>\n\n"
            msg += (
                "Dokumen diterima dan sedang masuk <b>antrean Admin</b> untuk verifikasi.\n"
                "<i>Kamu akan mendapat notifikasi setelah Admin selesai mereview.</i>"
            )
            _send(chat_id, msg)
        except Exception as e:
            _send(chat_id, f"❌ <b>Gagal proses dokumen</b>\n{str(e)[:300]}")
        return True

    # Catch-all: unknown state, reset and inform user
    _STATE.pop(chat_id, None)
    _TEMP.pop(chat_id, None)
    _send(chat_id, "ℹ️ Sesi sebelumnya sudah expired. Silakan pilih menu kembali.")
    return True


# ─────────────────────────────────────────────────────────────────────────────
# MAIN UPDATE HANDLER
# ─────────────────────────────────────────────────────────────────────────────

def _handle_kyc_start(chat_id: int) -> None:
    user_id = resolve_user_id_by_chat(chat_id)
    if not user_id:
        _send(chat_id, "🔐 Login dulu untuk verifikasi KYC.")
        return
    _STATE[chat_id] = "kyc:nik"
    _TEMP[chat_id] = {}
    _send(
        chat_id,
        "🪪 <b>Verifikasi KYC (Know Your Customer)</b>\n\n"
        "Langkah 1/4: Masukkan <b>NIK (16 digit)</b> kamu.\n"
        "Contoh: <code>3201112776524059</code>",
        kb=_cancel_keyboard(),
    )


def _handle_kyc_consent_callback(callback_query: dict[str, Any]) -> None:
    """Handle inline keyboard callback for KYC consent."""
    cb_data = callback_query.get("data", "")
    chat_id = (callback_query.get("message", {}).get("chat", {}) or {}).get("id")
    cb_id = callback_query.get("id")
    if not chat_id:
        return

    # Answer the callback to remove loading spinner
    try:
        _api("answerCallbackQuery", {"callback_query_id": cb_id})
    except Exception:
        pass

    user_id = resolve_user_id_by_chat(chat_id)
    if not user_id:
        _send(chat_id, "🔐 Session expired.")
        return

    kyc_data = _TEMP.pop(chat_id, {})
    _STATE.pop(chat_id, None)

    if cb_data == "kyc_consent_yes":
        try:
            from services.scan_helpers import get_supabase_admin
            from datetime import datetime, timezone
            sb = get_supabase_admin()
            now = datetime.now(timezone.utc).isoformat()
            sb.table("profiles").upsert({
                "id": user_id,
                "nik": kyc_data.get("nik", ""),
                "ktp_photo_url": kyc_data.get("ktp_photo_url", ""),
                "selfie_photo_url": kyc_data.get("selfie_photo_url", ""),
                "data_consent_given": True,
                "data_consent_at": now,
                "data_consent_version": "v1.0",
                "kyc_verified": True,
                "kyc_submitted_at": now,
            }, on_conflict="id").execute()
            nik = kyc_data.get('nik', '')
            nik_masked = f"{nik[:4]}{'*'*8}{nik[-4:]}" if len(nik) >= 8 else nik
            _send(
                chat_id,
                "✅ <b>KYC Berhasil Diverifikasi!</b>\n\n"
                f"NIK: <code>{nik_masked}</code>\n"
                "KTP & Selfie: ✅ Terverifikasi\n"
                "Status Consent: ✅ Aktif (Sesuai UU PDP)\n\n"
                "<i>Data kamu sekarang bisa diakses oleh Mitra Koperasi melalui Decision Gate API.</i>",
            )
        except Exception as e:
            _send(chat_id, f"❌ Gagal menyimpan data KYC: {str(e)[:200]}")
    else:
        _send(
            chat_id,
            "❌ <b>Consent Ditolak</b>\n\n"
            "Tanpa persetujuan UU PDP, data kredit kamu tidak dapat dibagikan ke Mitra Koperasi/LJK.\n"
            "Kamu tetap bisa menggunakan fitur lain di Otaru Financial.",
        )


async def handle_update(update: dict[str, Any]) -> None:
    # Handle callback queries (inline keyboard)
    cb = update.get("callback_query")
    if cb:
        cb_data = cb.get("data", "")
        if cb_data.startswith("kyc_consent"):
            _handle_kyc_consent_callback(cb)
        return

    message = update.get("message")
    if not message:
        return
    chat_id = (message.get("chat") or {}).get("id")
    if not chat_id:
        return

    text = (message.get("text") or "").strip()
    photo = message.get("photo")  # list of PhotoSize or None

    try:
        # State machine first
        if _handle_state(chat_id, text, photo):
            return

        # Command / menu routing
        if text.startswith("/start"):
            _handle_start(chat_id, message, text)
        elif text in ("📊 Cek Skor Kesehatan", "/score"):
            _handle_score(chat_id)
        elif text in ("🏦 Sisa Plafon Aman", "/plafon"):
            _handle_plafon(chat_id)
        elif text in ("📝 Update Profil", "/update"):
            _handle_update_profil_start(chat_id)
        elif text in ("📄 Upload Dokumen", "/upload"):
            _handle_upload_start(chat_id)
        elif text in ("👨\u200d👩\u200d👧\u200d👦 Family Sharing", "/family"):
            _handle_family_start(chat_id)
        elif text.startswith("/family_invite"):
            user_id = resolve_user_id_by_chat(chat_id)
            if user_id:
                _STATE[chat_id] = "family_invite:contact"
                _send(chat_id, "Masukkan email/nomor HP anggota keluarga:", kb=_cancel_keyboard())
            else:
                _send(chat_id, "🔐 Login dulu.")
        elif text.startswith("/family_accept"):
            parts = text.split(maxsplit=1)
            user_id = resolve_user_id_by_chat(chat_id)
            if not user_id:
                _send(chat_id, "🔐 Login dulu.")
            elif len(parts) >= 2:
                token = parts[1].strip()
                try:
                    result = accept_family_invite(user_id, token)
                    _send(chat_id, f"✅ <b>Berhasil!</b> Kamu sekarang bisa lihat data kredit anggota keluarga.")
                except Exception as e:
                    _send(chat_id, f"❌ {str(e)[:200]}")
            else:
                _STATE[chat_id] = "family_accept:token"
                _send(chat_id, "Paste invite token yang kamu terima:", kb=_cancel_keyboard())
        elif text in ("/add_cicilan", "➕ Tambah Cicilan"):
            _send(chat_id, "ℹ️ Fitur Tambah Cicilan sudah tidak aktif. Semua aktivitas pinjaman dikelola oleh Koperasi via API.")
        elif text in ("🛡️ Sertifikat Kredit", "/cert"):
            _handle_cert(chat_id)
        elif text in ("⚙️ Profil", "/profil"):
            _handle_profil(chat_id)
        elif text in ("🪪 Verifikasi KYC", "/kyc"):
            _handle_kyc_start(chat_id)
        elif text in ("🔄 Ganti Akun", "/reset"):
            _handle_reset(chat_id)
        elif text in ("💬 Tanya Otaru", "/ask"):
            _send(chat_id, "💬 <b>Otaru AI</b>\nHalo! Ada yang bisa Otaru bantu terkait skor kredit atau pengeluaranmu hari ini?")
        elif photo:
            # User kirim foto tanpa masuk state upload -> arahkan ke upload flow
            _handle_upload_start(chat_id)
        elif text and not text.startswith("/"):
            await _handle_freeform(chat_id, text)
        else:
            _send(chat_id, "Ketuk tombol di bawah untuk menggunakan fitur Otaru Financial.")
    except Exception as e:
        # CRITICAL: Catch ALL exceptions to prevent bot from hanging
        print(f"[finance_bot_worker] handler error for chat {chat_id}: {e}")
        try:
            _send(chat_id, f"⚠️ Terjadi kesalahan. Coba lagi ya.\n<i>{str(e)[:150]}</i>")
        except Exception:
            pass  # Even the error message failed, keep the worker alive


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

async def main() -> None:
    if not TOKEN:
        raise RuntimeError("TELEGRAM_FINANCE_BOT_TOKEN is required in environment")
    _disable_webhook()
    print("[finance_bot_worker] polling started (@otarufinance_bot)")
    offset: Optional[int] = None
    while True:
        try:
            updates = _get_updates(offset)
            for upd in updates:
                offset = upd["update_id"] + 1
                await handle_update(upd)
        except Exception as e:
            print(f"[finance_bot_worker] error: {e}")
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
