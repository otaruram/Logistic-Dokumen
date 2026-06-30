"""
Telegram bot worker (long polling).

Run:
  python -m workers.telegram_bot_worker

Features:
- /start <tele_key>   => link Telegram chat with web account (permanent key)
- /menu               => show available commands
- /dashboard          => show Logistics Trust Score + revenue summary
- /ttd                => TTD/signature-only check (no credit deduction)
- 🔏 Cek TTD button   => same as /ttd
- Send photo          => run fraud scan pipeline (caption can be recipient name)

Notes:
- Requires TELEGRAM_BOT_TOKEN in environment.
- Uses Supabase table: telegram_links
"""

from __future__ import annotations

import asyncio
import re
import uuid
from typing import Any, Optional

import requests

from config.settings import settings
from services.imagekit_service import ImageKitService
from services.pdf_service import generate_kasbon_template_pdf
from services.otaru_finance_service import calculate_otaru_index, resolve_user_id_by_chat
from services.scan_helpers import get_supabase_admin
from services.telegram_service import (
    answer_freeform_question,
    analyze_signature,
    get_dashboard_summary,
    get_link_by_chat_id,
    get_recent_fraud_history,
    link_chat_to_user,
    process_fraud_scan_from_telegram,
    unlink_chat,
)

# Per-chat state for TTD-only mode: chat_id => True means awaiting a signature photo
_ttd_pending: set[int] = set()
# Per-chat state for kasbon upload mode
_kasbon_pending: set[int] = set()

TOKEN = settings.TELEGRAM_BOT_TOKEN
FINANCE_TOKEN = settings.TELEGRAM_FINANCE_BOT_TOKEN


def _api_call_for_token(token: str, method: str, payload: dict[str, Any]) -> dict[str, Any]:
    base_url = f"https://api.telegram.org/bot{token}" if token else ""
    r = requests.post(f"{base_url}/{method}", json=payload, timeout=30)
    r.raise_for_status()
    data = r.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram API error: {data}")
    return data


def _api_call(method: str, payload: dict[str, Any]) -> dict[str, Any]:
    return _api_call_for_token(TOKEN, method, payload)


def _main_menu_keyboard() -> dict[str, Any]:
    return {
        "keyboard": [
            [{"text": "📸 Upload Dokumen"}, {"text": "📜 Histori Fraud"}],
            [{"text": "🔄 Ganti Akun"}],
        ],
        "resize_keyboard": True,
        "persistent": True,
    }


def _format_idr(amount: float) -> str:
    return f"Rp {int(amount):,}".replace(",", ".")
from workers.handlers.dummy_doc_generator import make_dummy_png as _make_dummy_png


# Handlers moved to be/workers/handlers/kasbon_bot_handlers.py


def send_message(
    chat_id: int,
    text: str,
    *,
    use_keyboard: bool = False,
    token: str | None = None,
    finance_keyboard: bool = False,
) -> None:
    active_token = token or TOKEN
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if use_keyboard:
        payload["reply_markup"] = _main_menu_keyboard()
    try:
        _api_call_for_token(active_token, "sendMessage", payload)
    except Exception:
        # Fallback to plain text to prevent HTML parse errors (e.g., exceptions containing <...>)
        plain_text = re.sub(r"<[^>]+>", "", text)
        fallback_payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": plain_text[:3800],
            "disable_web_page_preview": True,
        }
        if use_keyboard:
            fallback_payload["reply_markup"] = _main_menu_keyboard()
        try:
            _api_call_for_token(active_token, "sendMessage", fallback_payload)
        except Exception:
            # Keep worker alive even if Telegram rejects payload again
            pass


def send_document(
    chat_id: int,
    file_name: str,
    content: bytes,
    mime_type: str,
    caption: str = "",
) -> None:
    """Send a downloadable document to Telegram chat."""
    try:
        files = {
            "document": (file_name, content, mime_type),
        }
        data: dict[str, Any] = {
            "chat_id": str(chat_id),
            "disable_content_type_detection": "false",
        }
        if caption:
            data["caption"] = caption
            data["parse_mode"] = "HTML"

        requests.post(
            f"https://api.telegram.org/bot{TOKEN}/sendDocument",
            data=data,
            files=files,
            timeout=30,
        ).raise_for_status()
    except Exception as exc:
        send_message(chat_id, f"<b>❌ Gagal kirim file form</b>\n{str(exc)[:240]}", use_keyboard=True)


def _resolve_backend_base_url() -> str:
    """Resolve backend URL for worker calls, preferring Docker-internal service over localhost."""
    configured = (settings.BACKEND_BASE_URL or "").strip()
    if configured.startswith("http://localhost") or configured.startswith("http://127.0.0.1"):
        return "http://logistic-document-be:8000"
    return configured or "http://logistic-document-be:8000"


def get_updates(offset: Optional[int], *, token: str | None = None) -> list[dict[str, Any]]:
    active_token = token or TOKEN
    payload = {"timeout": 25, "allowed_updates": ["message"]}
    if offset is not None:
        payload["offset"] = offset
    data = _api_call_for_token(active_token, "getUpdates", payload)
    return data.get("result", [])


def _ensure_polling_mode(token: str, name: str) -> None:
    """Disable webhook so long-polling getUpdates can receive messages."""
    try:
        _api_call_for_token(token, "deleteWebhook", {"drop_pending_updates": False})
        print(f"[{name}] webhook disabled -> polling mode enabled")
    except Exception as e:
        print(f"[{name}] failed to disable webhook: {e}")


def get_file_bytes(file_id: str, *, token: str | None = None) -> bytes:
    active_token = token or TOKEN
    file_meta = _api_call_for_token(active_token, "getFile", {"file_id": file_id})
    file_path = file_meta["result"]["file_path"]
    file_url = f"https://api.telegram.org/file/bot{active_token}/{file_path}"
    r = requests.get(file_url, timeout=60)
    r.raise_for_status()
    return r.content


async def _handle_start(chat_id: int, message: dict[str, Any], text: str) -> None:
    parts = text.split()
    if len(parts) < 2:
        send_message(
            chat_id,
            "<b>🔐 Hubungkan Akun Dulu</b>\n"
            "Masukkan tele key dan nomor HP dari web.\n"
            "Format: <code>/start YOUR_TELE_KEY 08xxxxxxxxxx</code>\n\n"
            "Contoh: <code>/start abc123 081234567890</code>",
            use_keyboard=True,
        )
        return

    tele_key = parts[1].strip()
    phone_number = parts[2].strip() if len(parts) >= 3 else None

    # Validate phone if provided
    if phone_number:
        clean = phone_number.replace("+62", "0").replace("-", "").replace(" ", "")
        if not clean.isdigit() or len(clean) < 10 or len(clean) > 13 or not clean.startswith("0"):
            send_message(
                chat_id,
                "<b>❌ Nomor HP Tidak Valid</b>\n"
                "Format yang benar: <code>08xxxxxxxxxx</code> (10-13 digit)\n"
                "Contoh: <code>/start YOUR_KEY 081234567890</code>",
                use_keyboard=True,
            )
            return
        phone_number = clean

    from_user = message.get("from", {})

    try:
        link_chat_to_user(
            tele_key=tele_key,
            chat_id=chat_id,
            telegram_user_id=from_user.get("id"),
            username=from_user.get("username"),
            phone_number=phone_number,
        )
        phone_msg = f"\n📱 No. HP: <code>{phone_number}</code>" if phone_number else ""
        send_message(
            chat_id,
            f"<b>✅ Akun Berhasil Terhubung</b>{phone_msg}\n"
            "Gunakan menu di bawah:",
            use_keyboard=True,
        )
    except Exception as e:
        send_message(chat_id, f"<b>❌ Gagal link akun</b>\n{str(e)}", use_keyboard=True)


def _handle_menu(chat_id: int) -> None:
    send_message(
        chat_id,
        "<b>📌 Menu OtaruChain Bot</b>\n"
        "📸 <b>Upload Dokumen</b> → Foto receipt/invoice untuk fraud scan\n"
        "📜 <b>Histori Fraud</b>  → 5 scan fraud terakhir\n"
        "🔄 <b>Ganti Akun</b>    → Pindah ke akun lain\n"
        "🔏 <b>Cek TTD</b>       → Verifikasi tanda tangan dokumen",
        use_keyboard=True,
    )


def _handle_cek_limit(chat_id: int) -> None:
    from workers.handlers.kasbon_bot_handlers import handle_cek_limit
    handle_cek_limit(chat_id, send_message, _format_idr)

def _handle_histori_kasbon(chat_id: int) -> None:
    from workers.handlers.kasbon_bot_handlers import handle_histori_kasbon
    handle_histori_kasbon(chat_id, send_message, _format_idr)


def _handle_minta_foto_dummy(chat_id: int) -> None:
    """Send pre-filled dummy document images (slip gaji + invoice) for OCR beta testing."""
    send_message(
        chat_id,
        "<b>📷 Minta Foto Dummy</b>\n"
        "Mengirim 2 file dummy yang sudah terisi data:\n"
        "• Slip Gaji\n• Invoice\n\n"
        "Download, lalu upload ulang ke form OCR atau menu <b>📸 Upload Pengajuan</b>.",
        use_keyboard=True,
    )
    for kind in ("slip_gaji", "invoice"):
        try:
            png_bytes = _make_dummy_png(kind)
            label = "Slip Gaji" if kind == "slip_gaji" else "Invoice"
            send_document(
                chat_id,
                f"otaru_dummy_{kind}.png",
                png_bytes,
                "image/png",
                caption=f"<b>Dummy {label}</b>\nData sudah terisi. Ini adalah dokumen simulasi beta Otaru.",
            )
        except Exception as exc:
            send_message(chat_id, f"<b>❌ Gagal kirim dummy {kind}</b>\n{str(exc)[:200]}", use_keyboard=True)


def _handle_download_form(chat_id: int) -> None:
    from workers.handlers.kasbon_bot_handlers import handle_download_form
    handle_download_form(chat_id, send_message, send_document)


def _handle_kasbon_prompt(chat_id: int) -> None:
    """Enter kasbon upload mode."""
    link = get_link_by_chat_id(chat_id)
    if not link:
        send_message(chat_id, "<b>🔐 Akun belum terhubung.</b>", use_keyboard=True)
        return
    _kasbon_pending.add(chat_id)
    send_message(
        chat_id,
        "<b>📸 Mode Upload Pengajuan Kasbon</b>\n\n"
        "Kirimkan <b>foto Tabel Angsuran Kasbon</b>.\n"
        "Pastikan foto jelas, tidak buram, dan seluruh tabel terlihat.",
        use_keyboard=False,
    )


def _handle_history(chat_id: int) -> None:
    from workers.handlers.fraud_bot_handlers import handle_history
    handle_history(chat_id, send_message, _format_idr)


def _handle_dashboard(chat_id: int) -> None:
    from workers.handlers.fraud_bot_handlers import handle_dashboard
    handle_dashboard(chat_id, send_message, _format_idr)


async def _handle_kasbon_photo(chat_id: int, message: dict[str, Any]) -> None:
    _kasbon_pending.discard(chat_id)
    from workers.handlers.kasbon_bot_handlers import handle_kasbon_photo
    await handle_kasbon_photo(chat_id, message, send_message, get_file_bytes, _resolve_backend_base_url, _format_idr)


async def _handle_photo(chat_id: int, message: dict[str, Any]) -> None:
    from workers.handlers.fraud_bot_handlers import handle_photo
    await handle_photo(chat_id, message, send_message, get_file_bytes)


def _handle_ttd_prompt(chat_id: int) -> None:
    """Enter TTD-only mode: ask the user to send a photo for signature analysis."""
    link = get_link_by_chat_id(chat_id)
    if not link:
        send_message(
            chat_id,
            "<b>🔐 Akun belum terhubung.</b> Gunakan <code>/start &lt;tele_key&gt;</code> dari web.",
            use_keyboard=True,
        )
        return
    _ttd_pending.add(chat_id)
    send_message(
        chat_id,
        "<b>🔏 Mode Cek TTD Aktif</b>\n\n"
        "Kirimkan <b>foto dokumen</b> yang ingin dicek tanda tangan dan stempelnya.\n"
        "<i>Analisis ini <b>tidak</b> memotong kredit.</i>",
        use_keyboard=False,
    )


async def _handle_ttd_photo(chat_id: int, message: dict[str, Any]) -> None:
    """Process a photo in TTD-only mode — no credit deduction, no fraud_scans insert."""
    _ttd_pending.discard(chat_id)

    photos = message.get("photo") or []
    if not photos:
        send_message(chat_id, "<b>❌ Foto tidak valid.</b>", use_keyboard=True)
        return

    send_message(chat_id, "<b>🔍 Menganalisis TTD & stempel...</b> tunggu sebentar.", use_keyboard=True)

    try:
        file_id = photos[-1]["file_id"]
        content = get_file_bytes(file_id)
        result = analyze_signature(content)

        verdict = result.get("verdict", "tidak ada TTD")
        verdict_badge = {
            "asli": "✅ ASLI",
            "mencurigakan": "🚨 MENCURIGAKAN",
            "tidak ada TTD": "⚠️ TIDAK ADA TTD",
        }.get(verdict, f"ℹ️ {verdict.upper()}")

        ttd_icon = "✅" if result.get("found") else "❌"
        stempel_icon = "✅" if result.get("stempel") else "❌"

        msg = (
            "<b>🔏 Hasil Analisis TTD</b>\n"
            f"<b>Verdict:</b> {verdict_badge}\n"
            f"<b>Tanda Tangan:</b> {ttd_icon} {'Terdeteksi' if result.get('found') else 'Tidak ditemukan'}\n"
            f"<b>Stempel/Cap:</b> {stempel_icon} {'Terdeteksi' if result.get('stempel') else 'Tidak ditemukan'}\n"
            f"<b>Keyakinan AI:</b> {result.get('confidence', 'low').capitalize()}\n"
            f"<b>Detail:</b> {result.get('detail', '-')}\n\n"
            "<i>Mode Cek TTD tidak memotong kredit.</i>"
        )
        send_message(chat_id, msg, use_keyboard=True)
    except Exception as e:
        send_message(chat_id, f"<b>❌ Gagal analisis TTD</b>\n{str(e)}", use_keyboard=True)


def _handle_reset(chat_id: int) -> None:
    """Unlink this Telegram chat from its current web account.

    After reset the user can send /start <new_tele_key> to link to a different
    (or the same) web account.  This is the fix for the multi-account confusion
    where user A and user B both appear as the same account in the bot.
    """
    current_link = get_link_by_chat_id(chat_id)
    ok = unlink_chat(chat_id)
    if ok and current_link:
        send_message(
            chat_id,
            "<b>🔄 Akun Berhasil Di-reset</b>\n\n"
            "Telegram kamu sudah diputus dari akun web sebelumnya.\n"
            "Untuk menghubungkan ulang (atau ke akun lain), buka web lalu salin "
            "<b>Tele Key</b> dan kirim:\n\n"
            "<code>/start &lt;tele_key_baru&gt;</code>",
            use_keyboard=False,
        )
    elif ok:
        send_message(
            chat_id,
            "<b>ℹ️ Tidak ada akun tertaut.</b>\n"
            "Gunakan <code>/start &lt;tele_key&gt;</code> untuk menghubungkan.",
            use_keyboard=False,
        )
    else:
        send_message(
            chat_id,
            "<b>❌ Gagal reset akun.</b> Coba lagi nanti.",
            use_keyboard=True,
        )


def _handle_profile(chat_id: int) -> None:
    link = get_link_by_chat_id(chat_id)
    if not link:
        send_message(chat_id, "<b>🔐 Akun belum terhubung.</b> Gunakan <code>/start &lt;tele_key&gt;</code> dari web.", use_keyboard=True)
        return

    try:
        from services.scan_helpers import get_supabase_admin
        sb = get_supabase_admin()
        user_id = link["user_id"]
        email = "-"
        credits = 0
        if sb:
            prof = sb.table("profiles").select("credits").eq("id", user_id).limit(1).execute()
            if prof.data:
                credits = int((prof.data[0] or {}).get("credits", 0) or 0)
            # Try to get email from users table (local DB not available here — skip gracefully)
        send_message(
            chat_id,
            "<b>⚙️ Profil Akun</b>\n"
            f"<b>User ID:</b> <code>{user_id[:8]}…</code>\n"
            f"<b>Credits:</b> {credits}/10\n"
            f"<b>Status:</b> {'🟢 Terhubung' if link.get('is_linked') else '🔴 Belum terhubung'}",
            use_keyboard=True,
        )
    except Exception as e:
        send_message(chat_id, f"<b>❌ Gagal ambil profil</b>\n{str(e)}", use_keyboard=True)





async def handle_update(update: dict[str, Any]) -> None:
    message = update.get("message")
    if not message:
        return

    chat = message.get("chat", {})
    chat_id = chat.get("id")
    if chat_id is None:
        return

    text = (message.get("text") or "").strip()

    if text.startswith("/start"):
        await _handle_start(chat_id, message, text)
        return

    # Handle 4-button persistent menu
    if text in ("📜 Histori Fraud", "/histori", "📜 Histori", "/history"):
        _handle_history(chat_id)
        return

    if text in ("⚙️ Profil", "/profil"):
        _handle_profile(chat_id)
        return

    if text in ("/menu", "📋 Menu"):
        _handle_menu(chat_id)
        return

    if text in ("🔄 Ganti Akun", "/reset"):
        _handle_reset(chat_id)
        return

    if text in ("🔏 Cek TTD", "/ttd"):
        _handle_ttd_prompt(chat_id)
        return

    if text in ("📸 Upload Dokumen",):
        send_message(chat_id, "<b>📸 Siap menerima foto dokumen</b>\nKirimkan foto dokumen fisik (receipt/invoice) sekarang.", use_keyboard=True)
        return

    # Legacy fraud scan shortcut kept for backward compat
    if text == "📸 Kirim Foto Nota":
        link = get_link_by_chat_id(chat_id)
        if not link:
            send_message(chat_id, "<b>🔐 Akun belum terhubung.</b>", use_keyboard=True)
        else:
            send_message(chat_id, "<b>📸 Siap menerima foto nota</b>\nKirimkan foto dokumen fisik sekarang.", use_keyboard=True)
        return

    if message.get("photo"):
        if chat_id in _kasbon_pending:
            await _handle_kasbon_photo(chat_id, message)
        elif chat_id in _ttd_pending:
            await _handle_ttd_photo(chat_id, message)
        else:
            await _handle_photo(chat_id, message)
        return

    # Unknown text — guide user to the menu
    if text and not text.startswith("/"):
        send_message(
            chat_id,
            "Ketuk tombol di bawah untuk menggunakan fitur OtaruChain. "
            "Upload foto bukti atau surat jalan untuk verifikasi dokumen.",
            use_keyboard=True,
        )
        return


async def main() -> None:
    """Main poll loop for @otaruchain_bot only.
    @otarufinance_bot is handled by workers.finance_bot_worker (separate container).
    """
    if not TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required in environment")

    _ensure_polling_mode(TOKEN, "telegram_bot_worker")
    print("telegram_bot_worker polling started (@otaruchain_bot)")
    offset: Optional[int] = None
    while True:
        try:
            updates = get_updates(offset, token=TOKEN)
            for upd in updates:
                offset = upd["update_id"] + 1
                await handle_update(upd)
        except Exception as e:
            print(f"[telegram_bot_worker] error: {e}")
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
