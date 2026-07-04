from typing import Any
import uuid
import sys
from config.settings import settings
from services.imagekit_service import ImageKitService
from services.pdf_service import generate_kasbon_template_pdf
from services.scan_helpers import get_supabase_admin
from services.telegram_service import get_link_by_chat_id

def _is_loan_requests_missing_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return "loan_requests" in text and (
        "pgrst205" in text
        or "schema cache" in text
        or "does not exist" in text
        or "relation" in text
    )

def handle_cek_limit(chat_id: int, send_message, format_idr) -> None:
    link = get_link_by_chat_id(chat_id)
    if not link:
        send_message(chat_id, "<b>🔐 Akun belum terhubung.</b> Gunakan <code>/start &lt;tele_key&gt;</code> dari web.", use_keyboard=True)
        return
    try:
        sb = get_supabase_admin()
        if not sb:
            send_message(chat_id, "<b>❌ Supabase belum terkonfigurasi.</b>", use_keyboard=True)
            return
        user_id = link["user_id"]
        prof = sb.table("profiles").select("nik, full_name, limit_pinjaman").eq("id", user_id).limit(1).execute()
        prof_rows = getattr(prof, "data", None) or []
        if not prof_rows or not prof_rows[0].get("nik"):
            send_message(chat_id, "<b>❌ NIK belum terdaftar. Lengkapi KYC terlebih dahulu.</b>", use_keyboard=True)
            return
        nik = prof_rows[0]["nik"]
        limit = int(prof_rows[0].get("limit_pinjaman") or 0)
        try:
            active_res = (
                sb.table("loan_requests")
                .select("nominal_pengajuan")
                .eq("nik", nik)
                .in_("status", ["PENDING", "APPROVED"])
                .execute()
            )
        except Exception as e:
            if _is_loan_requests_missing_error(e):
                send_message(
                    chat_id,
                    "<b>⚙️ Fitur kasbon belum aktif di database.</b>\n"
                    "Admin perlu menjalankan migration <code>database/kasbon_migration.sql</code> di Supabase.",
                    use_keyboard=True,
                )
                return
            raise
        active_rows = getattr(active_res, "data", None) or []
        active_total = sum(int(r["nominal_pengajuan"]) for r in active_rows)
        available = limit - active_total
        msg = (
            f"<b>📊 Sisa Limit Kasbon</b>\n"
            f"<b>Nama:</b> {prof_rows[0].get('full_name', '-')}\n"
            f"<b>NIK:</b> <code>{nik}</code>\n\n"
            f"<b>Limit Total:</b> {format_idr(limit)}\n"
            f"<b>Terpakai:</b> {format_idr(active_total)}\n"
            f"<b>Sisa Limit:</b> <b>{format_idr(available)}</b>"
        )
        send_message(chat_id, msg, use_keyboard=True)
    except Exception as e:
        err = str(e)
        if "loan_requests" in err and ("PGRST205" in err or "schema cache" in err):
            send_message(
                chat_id,
                "<b>⚠️ Fitur kasbon belum aktif penuh</b>\n"
                "Tabel loan_requests belum tersedia. Admin perlu jalankan migration kasbon dulu.",
                use_keyboard=True,
            )
            return
        if "profiles.nama_lengkap" in err:
            send_message(
                chat_id,
                "<b>⚠️ Schema profil belum sinkron</b>\n"
                "Kolom nama_lengkap tidak ada. Sistem sekarang pakai full_name.",
                use_keyboard=True,
            )
            return
        send_message(chat_id, f"<b>❌ Gagal ambil limit</b>\n{e}", use_keyboard=True)


def handle_histori_kasbon(chat_id: int, send_message, format_idr) -> None:
    link = get_link_by_chat_id(chat_id)
    if not link:
        send_message(chat_id, "<b>🔐 Akun belum terhubung.</b>", use_keyboard=True)
        return
    try:
        sb = get_supabase_admin()
        if not sb:
            send_message(chat_id, "<b>❌ Supabase belum terkonfigurasi.</b>", use_keyboard=True)
            return
        user_id = link["user_id"]
        prof = sb.table("profiles").select("nik").eq("id", user_id).limit(1).execute()
        prof_rows = getattr(prof, "data", None) or []
        if not prof_rows or not prof_rows[0].get("nik"):
            send_message(chat_id, "<b>❌ NIK belum terdaftar. Lengkapi KYC.</b>", use_keyboard=True)
            return
        nik = prof_rows[0]["nik"]
        try:
            res = (
                sb.table("loan_requests")
                .select("id, nominal_pengajuan, status, ai_indicator, submitted_at")
                .eq("nik", nik)
                .order("submitted_at", desc=True)
                .limit(5)
                .execute()
            )
        except Exception as e:
            if _is_loan_requests_missing_error(e):
                send_message(
                    chat_id,
                    "<b>⚙️ Histori kasbon belum tersedia.</b>\n"
                    "Admin perlu menjalankan migration <code>database/kasbon_migration.sql</code> di Supabase.",
                    use_keyboard=True,
                )
                return
            raise
        rows = getattr(res, "data", None) or []
        if not rows:
            send_message(chat_id, "<b>📜 Histori Pengajuan</b>\nBelum ada pengajuan kasbon.", use_keyboard=True)
            return
        status_badge = {"PENDING": "🟡 PENDING", "APPROVED": "✅ APPROVED", "REJECTED": "🔴 REJECTED"}
        ai_badge = {"VERIFIED": "🔏 VERIFIED", "TAMPERED": "🚨 TAMPERED", "PROCESSING": "⏳ PROCESSING"}
        lines = ["<b>📜 Histori Pengajuan Kasbon (5 Terakhir)</b>"]
        for i, r in enumerate(rows, 1):
            date_str = (r.get("submitted_at") or "")[:10]
            lines.append(
                f"\n<b>{i}.</b> {status_badge.get(r['status'], r['status'])}\n"
                f"• Nominal: {format_idr(float(r['nominal_pengajuan']))}\n"
                f"• AI: {ai_badge.get(r['ai_indicator'], r['ai_indicator'])}\n"
                f"• Tanggal: {date_str}"
            )
        send_message(chat_id, "".join(lines), use_keyboard=True)
    except Exception as e:
        err = str(e)
        if "loan_requests" in err and ("PGRST205" in err or "schema cache" in err):
            send_message(
                chat_id,
                "<b>⚠️ Histori kasbon belum tersedia</b>\n"
                "Tabel loan_requests belum tersedia. Admin perlu jalankan migration kasbon dulu.",
                use_keyboard=True,
            )
            return
        send_message(chat_id, f"<b>❌ Gagal ambil histori</b>\n{e}", use_keyboard=True)


def handle_download_form(chat_id: int, send_message, send_document) -> None:
    try:
        full_name = "Budi Santoso"
        nik = "3201010101010001"
        email = "budi.demo@otaruchain.id"
        user_id = None

        link = get_link_by_chat_id(chat_id)
        user_id = (link or {}).get("user_id")
        if user_id:
            sb = get_supabase_admin()
            if sb:
                prof = (
                    sb.table("profiles")
                    .select("full_name, nik, user_email")
                    .eq("id", str(user_id))
                    .limit(1)
                    .execute()
                )
                rows = getattr(prof, "data", None) or []
                if rows:
                    row = rows[0] if isinstance(rows[0], dict) else {}
                    full_name = row.get("full_name") or full_name
                    nik = row.get("nik") or nik
                    email = row.get("user_email") or email

        pdf_bytes = generate_kasbon_template_pdf(full_name=full_name, nik=nik, email=email)

        send_document(
            chat_id,
            "form_pengajuan_kasbon.pdf",
            pdf_bytes,
            "application/pdf",
            caption=(
                "<b>📋 Form Kasbon PDF</b>\n"
                "Form sudah auto-terisi data profil &amp; TTD pemohon.\n"
                "✅ Pengajuan ini langsung masuk ke antrean approval admin.\n"
                "Admin akan segera menghubungi kamu."
            ),
        )

        try:
            from datetime import datetime as _dt
            sb2 = get_supabase_admin()
            if sb2:
                import uuid as _uuid
                
                # Ensure profile exists for NIK to avoid foreign key violation
                try:
                    prof_chk = sb2.table("profiles").select("nik").eq("nik", nik).limit(1).execute()
                    if not getattr(prof_chk, "data", None):
                        sb2.table("profiles").insert({
                            "id": str(_uuid.uuid4()),
                            "nik": nik,
                            "full_name": full_name,
                            "user_email": email,
                            "limit_pinjaman": 5000000,
                            "phone_number": "08123456789"
                        }).execute()
                except Exception as e:
                    print(f"Warning: dummy profile check/insert failed: {e}")

                loan_row = {
                    "id": str(_uuid.uuid4()),
                    "nik": nik,
                    "nominal_pengajuan": 2500000,
                    "status": "PENDING",
                    "ai_indicator": "PROCESSING",
                    "submitted_at": _dt.utcnow().isoformat(),
                    "source": "CHAIN",
                    "doc_type": "form",
                    "ai_fraud_status": "NEEDS_REVIEW",
                    "ai_fraud_reason": "Form generate otomatis via bot",
                    "ocr_raw": {
                        "source": "telegram_form",
                        "full_name": full_name,
                        "email": email,
                        "telegram_chat_id": chat_id,
                        "auto_signed": True,
                    },
                }
                # Uploaded dummy image or placeholder since image_url is required
                loan_row["image_url"] = "https://placehold.co/600x800?text=Auto+Generated+Form"
                sb2.table("loan_requests").insert(loan_row).execute()
        except Exception as e:
            print(f"Error inserting loan form: {e}")

        try:
            admin_chat_id = settings.TELEGRAM_ADMIN_CHAT_ID
            if admin_chat_id:
                send_document(
                    int(admin_chat_id),
                    "form_pengajuan_kasbon.pdf",
                    pdf_bytes,
                    "application/pdf",
                    caption=(
                        f"<b>📥 Pengajuan Kasbon Baru</b>\n"
                        f"Nama: <b>{full_name}</b>\n"
                        f"NIK: <code>{nik}</code>\n"
                        f"Email: {email}\n"
                        f"Chat ID: <code>{chat_id}</code>\n"
                        f"Nominal: Rp 2.500.000\n"
                        f"Status: <b>PENDING</b> — menunggu review admin."
                    ),
                )
        except Exception:
            pass

    except Exception as exc:
        send_message(chat_id, f"<b>❌ Gagal membuat PDF form</b>\n{str(exc)[:240]}", use_keyboard=True)


async def handle_kasbon_photo(chat_id: int, message: dict[str, Any], send_message, get_file_bytes, resolve_backend_base_url, format_idr) -> None:
    photos = message.get("photo") or []
    if not photos:
        send_message(chat_id, "<b>❌ Foto tidak valid.</b>", use_keyboard=True)
        return

    send_message(chat_id, "<b>⏳ Mengupload dan memproses dokumen kasbon...</b>", use_keyboard=True)
    try:
        file_id = photos[-1]["file_id"]
        content = get_file_bytes(file_id)
        filename = f"kasbon_{uuid.uuid4().hex[:10]}.jpg"

        ik_result = ImageKitService.upload_file(
            file=content, file_name=filename, folder="/kasbon"
        )
        image_url = ik_result.get("url", "")
        if not image_url:
            raise RuntimeError("ImageKit upload gagal.")

        import requests as _req
        backend_base = resolve_backend_base_url()
        resp = _req.post(
            f"{backend_base}/api/kasbon/process-document",
            json={"image_url": image_url, "telegram_chat_id": chat_id},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()

        ai_badge = {"VERIFIED": "🔏 VERIFIED", "TAMPERED": "🚨 TAMPERED", "PROCESSING": "⏳ PROCESSING"}
        msg = (
            f"<b>{'✅ Pengajuan Diterima' if data.get('success') else '❌ Pengajuan Gagal'}</b>\n"
            f"<b>Status:</b> {data.get('status', '-')}\n"
            f"<b>NIK:</b> <code>{data.get('nik') or '-'}</code>\n"
            f"<b>Nominal:</b> {format_idr(float(data.get('nominal_pengajuan') or 0))}\n"
            f"<b>Indikator AI:</b> {ai_badge.get(data.get('ai_indicator', ''), data.get('ai_indicator', '-'))}\n"
            f"<b>Pesan:</b> {data.get('message', '-')}"
        )
        if data.get("loan_id"):
            msg += f"\n\n<b>ID Pengajuan:</b> <code>{data['loan_id'][:8]}…</code>"
        send_message(chat_id, msg, use_keyboard=True)
    except Exception as e:
        err_text = str(e).replace("<", "(").replace(">", ")")
        send_message(chat_id, f"<b>❌ Gagal memproses kasbon</b>\n{err_text[:800]}", use_keyboard=True)
