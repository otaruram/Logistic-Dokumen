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
import os
import uuid
from typing import Any, Optional

import requests

from config.settings import settings
from services.telegram_service import (
    get_dashboard_summary,
    get_link_by_chat_id,
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


def send_message(chat_id: int, text: str) -> None:
    _api_call("sendMessage", {"chat_id": chat_id, "text": text})


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
            "Masukkan tele key dari web.\nContoh: /start YOUR_TELE_KEY",
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
            "Akun berhasil terhubung permanen.\n"
            "Sekarang Anda bisa pakai:\n"
            "- /dashboard\n"
            "- kirim foto untuk Fraud Scan\n"
            "- /menu",
        )
    except Exception as e:
        send_message(chat_id, f"Gagal link akun: {str(e)}")


def _handle_menu(chat_id: int) -> None:
    send_message(
        chat_id,
        "Perintah tersedia:\n"
        "/dashboard - cek Logistics Trust Score, revenue valid, tampered\n"
        "Kirim foto - jalankan Fraud Scan\n"
        "/menu - tampilkan menu ini",
    )


def _handle_dashboard(chat_id: int) -> None:
    link = get_link_by_chat_id(chat_id)
    if not link:
        send_message(chat_id, "Akun belum terhubung. Gunakan /start <tele_key> dari web.")
        return

    try:
        summary = get_dashboard_summary(link["user_id"])
        msg = (
            "Dashboard Fraud Summary\n"
            f"Logistics Trust Score: {summary['trust_score']}/1000\n"
            f"Total Pendapatan Valid: Rp {int(summary['total_revenue_valid']):,}\n"
            f"Verified: {summary['verified_documents']}\n"
            f"Processing: {summary['processing_documents']}\n"
            f"Tampered: {summary['tampered_documents']}\n"
            f"Fraud Scans: {summary['total_fraud_scans']}\n"
            f"Credits: {summary['credits']}"
        )
        send_message(chat_id, msg.replace(",", "."))
    except Exception as e:
        send_message(chat_id, f"Gagal ambil dashboard: {str(e)}")


async def _handle_photo(chat_id: int, message: dict[str, Any]) -> None:
    link = get_link_by_chat_id(chat_id)
    if not link:
        send_message(chat_id, "Akun belum terhubung. Gunakan /start <tele_key> dari web.")
        return

    photos = message.get("photo") or []
    if not photos:
        send_message(chat_id, "Foto tidak valid.")
        return

    file_id = photos[-1]["file_id"]
    caption = (message.get("caption") or "").strip()
    recipient_name = caption if caption else "Telegram User"

    send_message(chat_id, "Memproses Fraud Scan... tunggu sebentar.")

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

        response = (
            "Fraud Scan selesai\n"
            f"Status: {result['status']}\n"
            f"Confidence: {result['confidence']}\n"
            f"Nominal: {result.get('nominal_total') or '-'}\n"
            f"Klien: {result.get('nama_klien') or '-'}\n"
            f"Surat Jalan: {result.get('nomor_surat_jalan') or '-'}\n"
            f"Credits sisa: {result['credits_remaining']}"
        )
        send_message(chat_id, response)
    except Exception as e:
        send_message(chat_id, f"Fraud scan gagal: {str(e)}")


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
