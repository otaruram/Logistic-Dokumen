from typing import Any
import uuid
from config.settings import settings
from services.telegram_service import get_link_by_chat_id, get_recent_fraud_history, get_dashboard_summary, process_fraud_scan_from_telegram
from services.scan_helpers import get_supabase_admin
from services.imagekit_service import ImageKitService


def handle_history(chat_id: int, send_message, format_idr) -> None:
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
            nominal = format_idr(float(row.get("nominal_total") or 0))
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


def handle_dashboard(chat_id: int, send_message, format_idr) -> None:
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
            f"<b>Total Pendapatan Valid:</b> {format_idr(summary['total_revenue_valid'])}\n"
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


async def handle_photo(chat_id: int, message: dict[str, Any], send_message, get_file_bytes) -> None:
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

    send_message(chat_id, "<b>📤 Mengupload dokumen...</b> tunggu sebentar ya.", use_keyboard=True)

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

        try:
            ik_result = ImageKitService.upload_file(
                file=content, file_name=filename, folder="/approval_queue"
            )
            image_url = ik_result.get("url", "")
        except Exception:
            image_url = ""

        try:
            sb = get_supabase_admin()
            if sb and image_url:
                user_id = link["user_id"]
                prof = sb.table("profiles").select("nik, full_name").eq("id", user_id).limit(1).execute()
                prof_rows = getattr(prof, "data", None) or []
                nik = prof_rows[0].get("nik") if prof_rows else None

                if nik:
                    nominal = result.get("nominal_total") or 0
                    sb.table("loan_requests").insert({
                        "nik": nik,
                        "nominal_pengajuan": int(nominal) if nominal else 100000,
                        "image_url": image_url,
                        "status": "PENDING",
                        "ai_indicator": str(result.get("status", "PROCESSING")).upper(),
                        "source": "CHAIN",
                        "doc_type": result.get("doc_type") or "receipt",
                        "ocr_raw": {
                            "source": "telegram_auto_queue",
                            "recipient_name": recipient_name,
                            "scan_id": result.get("scan_id"),
                            "confidence": result.get("confidence"),
                        },
                    }).execute()
        except Exception:
            pass 

        credits_remaining = result.get("credits_remaining", "?")
        response = (
            "<b>✅ Dokumen Diterima</b>\n\n"
            "Dokumen kamu sudah masuk ke <b>antrean verifikasi Admin</b>.\n"
            "Admin akan mereview dan memberikan stamp verifikasi.\n\n"
            f"<b>Credits sisa:</b> {credits_remaining}/10\n"
            "<i>Kamu akan mendapat notifikasi setelah Admin selesai mereview.</i>"
        )
        send_message(chat_id, response, use_keyboard=True)

        try:
            admin_chat_id = settings.TELEGRAM_ADMIN_CHAT_ID
            if admin_chat_id and image_url:
                admin_msg = (
                    "<b>📥 Dokumen Baru Masuk</b>\n"
                    f"<b>Dari:</b> {recipient_name}\n"
                    f"<b>User:</b> <code>{link['user_id'][:8]}…</code>\n"
                    f"<b>Status AI:</b> {str(result.get('status', 'processing')).upper()}\n\n"
                    "Cek Approval Queue di Partner Portal untuk review."
                )
                send_message(int(admin_chat_id), admin_msg)
        except Exception:
            pass

    except Exception as e:
        send_message(chat_id, f"<b>❌ Upload gagal</b>\n{str(e)[:300]}", use_keyboard=True)
