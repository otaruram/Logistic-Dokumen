"""
Telegram bot worker (long polling).

Run:
  python -m workers.telegram_bot_worker

Features:
- /start <tele_key>   => link Telegram chat with web account (permanent key)
- /menu               => show available commands
- /dashboard          => show Logistics Trust Score + revenue summary
- Send photo          => run fraud scan pipeline (caption can be recipient name)

Notes:
- Requires TELEGRAM_BOT_TOKEN in environment.
- Uses Supabase table: telegram_links
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any, Optional

import requests

from config.settings import settings
from services.telegram_service import (
    get_dashboard_summary,
    get_link_by_chat_id,
    get_recent_fraud_history,
    link_chat_to_user,
    process_fraud_scan_from_telegram,
)

TOKEN = settings.TELEGRAM_BOT_TOKEN
BASE_URL = f"https://api.telegram.org/bot{TOKEN}" if TOKEN else ""


def _api_call(method: str, payload: dict[str, Any]) -> dict[str, Any]:
    r = requests.post(f"{BASE_URL}/{method}", json=payload, timeout=30)
    r.raise_for_status()
    data = r.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram API error: {data}")
    return data


def _main_menu_keyboard() -> dict[str, Any]:
    return {
        "keyboard": [
            [{"text": "/dashboard"}, {"text": "/history"}],
            [{"text": "/menu"}],
        ],
        "resize_keyboard": True,
    }


def _format_idr(amount: float) -> str:
    return f"Rp {int(amount):,}".replace(",", ".")


def send_message(chat_id: int, text: str, *, use_keyboard: bool = False) -> None:
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if use_keyboard:
        payload["reply_markup"] = _main_menu_keyboard()
    _api_call("sendMessage", payload)


def get_updates(offset: Optional[int]) -> list[dict[str, Any]]:
    payload = {"timeout": 25, "allowed_updates": ["message"]}
    if offset is not None:
        payload["offset"] = offset
    data = _api_call("getUpdates", payload)
    return data.get("result", [])


def get_file_bytes(file_id: str) -> bytes:
    file_meta = _api_call("getFile", {"file_id": file_id})
    file_path = file_meta["result"]["file_path"]
    file_url = f"https://api.telegram.org/file/bot{TOKEN}/{file_path}"
    r = requests.get(file_url, timeout=60)
    r.raise_for_status()
    return r.content


async def _handle_start(chat_id: int, message: dict[str, Any], text: str) -> None:
    parts = text.split(maxsplit=1)
    if len(parts) < 2:
        send_message(
            chat_id,
            "<b>🔐 Hubungkan Akun Dulu</b>\n"
            "Masukkan tele key dari web.\n"
            "Contoh: <code>/start YOUR_TELE_KEY</code>",
            use_keyboard=True,
        )
        return

    tele_key = parts[1].strip()
    from_user = message.get("from", {})

    try:
        link_chat_to_user(
            tele_key=tele_key,
            chat_id=chat_id,
            telegram_user_id=from_user.get("id"),
            username=from_user.get("username"),
        )
        send_message(
            chat_id,
            "<b>✅ Akun Berhasil Terhubung Permanen</b>\n"
            "Sekarang Anda bisa:\n"
            "• <code>/dashboard</code> untuk cek analitik\n"
            "• <code>/history</code> untuk log fraud terbaru\n"
            "• Kirim foto untuk <b>Fraud Scan</b>\n"
            "• <code>/menu</code> untuk lihat perintah",
            use_keyboard=True,
        )
    except Exception as e:
        send_message(chat_id, f"<b>❌ Gagal link akun</b>\n{str(e)}", use_keyboard=True)


def _handle_menu(chat_id: int) -> None:
    send_message(
        chat_id,
        "<b>📌 Menu OtaruChain Bot</b>\n"
        "<code>/dashboard</code> → Logistics Trust Score, revenue valid, status fraud\n"
        "<code>/history</code>   → Log historis fraud terbaru\n"
        "<i>Kirim foto</i>       → Jalankan Fraud Scan ketat\n"
        "<code>/menu</code>      → Tampilkan menu ini",
        use_keyboard=True,
    )


def _handle_history(chat_id: int) -> None:
    link = get_link_by_chat_id(chat_id)
    if not link:
        send_message(chat_id, "<b>🔐 Akun belum terhubung.</b> Gunakan <code>/start &lt;tele_key&gt;</code> dari web.", use_keyboard=True)
        return

    try:
        logs = get_recent_fraud_history(link["user_id"], limit=5)
        if not logs:
            send_message(
                chat_id,
                "<b>🧾 Histori Fraud</b>\nBelum ada data scan fraud.",
                use_keyboard=True,
            )
            return

        lines = ["<b>🧾 Histori Fraud Terbaru (5)</b>"]
        for i, row in enumerate(logs, start=1):
            status = str(row.get("status", "processing"))
            badge = {
                "verified": "✅ VERIFIED",
                "processing": "🟡 PROCESSING",
                "tampered": "🚫 TAMPERED",
            }.get(status, f"ℹ️ {status.upper()}")
            nominal = _format_idr(float(row.get("nominal_total") or 0))
            lines.append(
                f"\n<b>{i}.</b> {badge}\n"
                f"• Klien: {row.get('nama_klien') or '-'}\n"
                f"• Surat Jalan: {row.get('nomor_surat_jalan') or '-'}\n"
                f"• Nominal: {nominal}\n"
                f"• Confidence: {row.get('field_confidence') or '-'}"
            )

        send_message(chat_id, "".join(lines), use_keyboard=True)
    except Exception as e:
        send_message(chat_id, f"<b>❌ Gagal ambil histori fraud</b>\n{str(e)}", use_keyboard=True)


def _handle_dashboard(chat_id: int) -> None:
    link = get_link_by_chat_id(chat_id)
    if not link:
        send_message(chat_id, "<b>🔐 Akun belum terhubung.</b> Gunakan <code>/start &lt;tele_key&gt;</code> dari web.", use_keyboard=True)
        return

    try:
        summary = get_dashboard_summary(link["user_id"])
        if summary["tampered_documents"] > summary["verified_documents"]:
            risk = "🔴 Tinggi"
        elif summary["tampered_documents"] > 0:
            risk = "🟡 Sedang"
        else:
            risk = "🟢 Rendah"

        msg = (
            "<b>📊 Fraud Dashboard</b>\n"
            f"<b>Logistics Trust Score:</b> {summary['trust_score']}/1000\n"
            f"<b>Total Pendapatan Valid:</b> {_format_idr(summary['total_revenue_valid'])}\n"
            f"<b>Verified:</b> {summary['verified_documents']}\n"
            f"<b>Processing:</b> {summary['processing_documents']}\n"
            f"<b>Tampered:</b> {summary['tampered_documents']}\n"
            f"<b>Fraud Scans:</b> {summary['total_fraud_scans']}\n"
            f"<b>Risk Level:</b> {risk}\n"
            f"<b>Credits:</b> {summary['credits']}/10"
        )
        send_message(chat_id, msg, use_keyboard=True)
    except Exception as e:
        send_message(chat_id, f"<b>❌ Gagal ambil dashboard</b>\n{str(e)}", use_keyboard=True)


async def _handle_photo(chat_id: int, message: dict[str, Any]) -> None:
    link = get_link_by_chat_id(chat_id)
    if not link:
        send_message(chat_id, "<b>🔐 Akun belum terhubung.</b> Gunakan <code>/start &lt;tele_key&gt;</code> dari web.", use_keyboard=True)
        return

    photos = message.get("photo") or []
    if not photos:
        send_message(chat_id, "<b>❌ Foto tidak valid.</b>", use_keyboard=True)
        return

    file_id = photos[-1]["file_id"]
    caption = (message.get("caption") or "").strip()
    recipient_name = caption if caption else "Telegram User"

    send_message(chat_id, "<b>🔍 Memproses Fraud Scan...</b> tunggu sebentar ya.", use_keyboard=True)

    try:
        content = get_file_bytes(file_id)
        filename = f"tg_{uuid.uuid4().hex[:10]}.jpg"

        result = await process_fraud_scan_from_telegram(
            user_id=link["user_id"],
            recipient_name=recipient_name,
            signature_url="telegram:auto",
            content=content,
            filename=filename,
        )

        summary = get_dashboard_summary(link["user_id"])

        status = str(result.get("status", "processing"))
        status_badge = {
            "verified": "✅ VERIFIED",
            "processing": "🟡 PROCESSING",
            "tampered": "🚫 TAMPERED",
        }.get(status, f"ℹ️ {status.upper()}")
        nominal = result.get("nominal_total")
        nominal_text = _format_idr(float(nominal)) if nominal not in (None, "", 0) else "-"

        response = (
            "<b>🧾 Fraud Scan Selesai</b>\n"
            f"<b>Status:</b> {status_badge}\n"
            f"<b>Confidence:</b> {result.get('confidence', '-')}\n"
            f"<b>Nominal:</b> {nominal_text}\n"
            f"<b>Klien:</b> {result.get('nama_klien') or '-'}\n"
            f"<b>Surat Jalan:</b> {result.get('nomor_surat_jalan') or '-'}\n"
            f"<b>Credits sisa:</b> {result['credits_remaining']}/10\n"
            f"<b>Trust Score:</b> {summary['trust_score']}/1000\n"
            f"<b>Total Fraud Logs:</b> {summary['total_fraud_scans']}"
        )
        if result.get("cached"):
            response += "\n\n<i>⚡ Hasil diambil dari cache (dokumen sama).</i>"
        send_message(chat_id, response, use_keyboard=True)
    except Exception as e:
        send_message(chat_id, f"<b>❌ Fraud scan gagal</b>\n{str(e)}", use_keyboard=True)


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

    if text.startswith("/menu"):
        _handle_menu(chat_id)
        return

    if text.startswith("/dashboard"):
        _handle_dashboard(chat_id)
        return

    if text.startswith("/history"):
        _handle_history(chat_id)
        return

    if message.get("photo"):
        await _handle_photo(chat_id, message)
        return


async def main() -> None:
    if not TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required in environment")

    print("Telegram bot worker started")
    offset = None
    while True:
        try:
            updates = get_updates(offset)
            for upd in updates:
                offset = upd["update_id"] + 1
                await handle_update(upd)
        except Exception as e:
            print(f"[telegram_bot_worker] error: {e}")
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
