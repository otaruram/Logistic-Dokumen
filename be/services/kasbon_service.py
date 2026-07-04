import hashlib
from html import escape
import os
import sys
import tempfile
from datetime import datetime, timezone
from typing import Optional
import requests
from services.fraud_ai_service import analyze_fraud_with_gemini
from fastapi import HTTPException
from config.settings import settings
from services.scan_helpers import get_supabase_admin
from services.ocr_service import OCRService
from services.pdf_service import generate_kasbon_pdf
from services.imagekit_service import ImageKitService
from services.kasbon_sop import (
    detect_tampering_sop,
    extract_cicilan_from_ocr,
    extract_nik_and_nominal,
    extract_tenor,
    update_credit_score,
)
from services.telegram_service import send_telegram_notif

def _get_sb():
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    return sb

def _is_loan_requests_missing_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return "loan_requests" in text and (
        "pgrst205" in text
        or "schema cache" in text
        or "does not exist" in text
        or "relation" in text
    )

def _ensure_loan_requests_ready(sb) -> None:
    try:
        sb.table("loan_requests").select("id").limit(1).execute()
    except Exception as exc:
        if _is_loan_requests_missing_error(exc):
            raise HTTPException(
                status_code=503,
                detail="Tabel loan_requests belum tersedia. Jalankan migration database/kasbon_migration.sql di Supabase.",
            )
        raise

def _get_profile_by_nik(sb, nik: str) -> dict:
    res = sb.table("profiles").select("id, nik, full_name, user_email, limit_pinjaman").eq("nik", nik).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail=f"NIK {nik} tidak ditemukan.")
    return rows[0]

def _active_loan_total(sb, nik: str) -> int:
    res = sb.table("loan_requests").select("nominal_pengajuan").eq("nik", nik).in_("status", ["PENDING", "APPROVED"]).execute()
    rows = getattr(res, "data", None) or []
    return sum(int(r["nominal_pengajuan"]) for r in rows)

def _resolve_nik_from_telegram_chat(sb, chat_id: int) -> Optional[str]:
    link_res = sb.table("telegram_links").select("user_id").eq("telegram_chat_id", str(chat_id)).eq("is_linked", True).limit(1).execute()
    link_rows = getattr(link_res, "data", None) or []
    if not link_rows:
        return None
    user_id = link_rows[0].get("user_id")
    if not user_id:
        return None
    prof_res = sb.table("profiles").select("nik").eq("id", user_id).limit(1).execute()
    prof_rows = getattr(prof_res, "data", None) or []
    return prof_rows[0].get("nik") if prof_rows else None

ADMIN_WHITELIST = {
    "okitr52@gmail.com",
    settings.ADMIN_EMAIL, 
}

def _is_authorized_admin(sb, email: str) -> bool:
    if email.lower().strip() in {e.lower() for e in ADMIN_WHITELIST if e}:
        return True
    try:
        res = sb.table("authorized_admins").select("id").eq("email", email.lower().strip()).limit(1).execute()
        rows = getattr(res, "data", None) or []
        return len(rows) > 0
    except Exception:
        return False

def _resolve_chat_id(sb, nik: str) -> Optional[int]:
    try:
        pr = sb.table("profiles").select("id").eq("nik", nik).limit(1).execute()
        pr_rows = getattr(pr, "data", None) or []
        if not pr_rows:
            return None
        user_id = pr_rows[0]["id"]
        tl = sb.table("telegram_links").select("telegram_chat_id").eq("user_id", user_id).eq("is_linked", True).limit(1).execute()
        tl_rows = getattr(tl, "data", None) or []
        if not tl_rows or not tl_rows[0].get("telegram_chat_id"):
            return None
        return int(tl_rows[0]["telegram_chat_id"])
    except Exception:
        return None

def _generate_and_upload_pdf(loan: dict, profile: dict, sha256_hash: str = "") -> Optional[str]:
    try:
        pdf_bytes = generate_kasbon_pdf(
            loan, profile, sha256_hash,
            source=loan.get("source") or "CHAIN",
            image_url=loan.get("image_url") or "",
        )
        no_ref = (loan.get("ocr_raw") or {}).get("no_referensi") or str(loan.get("id", ""))[:8].upper()
        result = ImageKitService.upload_file(
            pdf_bytes,
            file_name=f"kasbon_{no_ref}_{loan.get('status', 'DOC').lower()}.pdf",
            folder="/kasbon_forms",
        )
        return result.get("url")
    except Exception as exc:
        print(f"[KASBON] PDF upload failed: {exc}", file=sys.stderr)
        return None

async def kasbon_approve_loan(sb, current_user: dict, loan_id: str, admin_signature: str, stamp_applied: bool, stamp_style: str, stamp_color: str = "red", stamp_name: str = "KOPERASI MITRA SEJAHTERA", coords: Optional[dict] = None):
    _ensure_loan_requests_ready(sb)

    res = sb.table("loan_requests").select("id, nik, nominal_pengajuan, status, ocr_raw, source, doc_type, image_url").eq("id", loan_id).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Pengajuan tidak ditemukan.")

    loan = rows[0]
    if loan["status"] != "PENDING":
        raise HTTPException(status_code=409, detail=f"Pengajuan sudah berstatus {loan['status']}. Tidak bisa di-approve ulang.")

    ocr_raw = loan.get("ocr_raw") or {}
    stamp_style = stamp_style if stamp_style in {"classic", "embossed"} else "classic"
    no_referensi = ocr_raw.get("no_referensi") or loan["id"]
    payload = f"{no_referensi}{loan['id']}{loan['nominal_pengajuan']}{loan['nik']}{admin_signature}"
    sha256_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()

    sb.table("loan_requests").update({
        "status": "APPROVED",
        "sha256_hash": sha256_hash,
        "ai_indicator": "VERIFIED",
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": str(current_user["id"]),
        "ocr_raw": {
            **ocr_raw,
            "admin_signature": admin_signature,
            "stamp_applied": True,
            "stamp_style": stamp_style,
            "coords": coords,
        },
    }).eq("id", loan_id).execute()

    update_credit_score(sb, loan["nik"], "VERIFIED")

    try:
        prof_sync_res = sb.table("profiles").select("id,credit_score,fraud_flags").eq("nik", loan["nik"]).limit(1).execute()
        prof_sync_rows = getattr(prof_sync_res, "data", None) or []
        if prof_sync_rows:
            ps = prof_sync_rows[0]
            new_score = int(ps.get("credit_score") or 0)
            new_flags = int(ps.get("fraud_flags") or 0)
            if new_score >= 700:
                new_integrity = "HIGH"
            elif new_score >= 400:
                new_integrity = "MEDIUM"
            else:
                new_integrity = "LOW"
            sb.table("integrity_metrics").upsert({
                "user_id": ps["id"],
                "nik": loan["nik"],
                "integrity_level": new_integrity,
                "tampered_attempts": new_flags,
                "last_verified_at": datetime.now(timezone.utc).isoformat(),
                "sha256_latest": sha256_hash,
            }).execute()
            
            calculate_otaru_index(ps["id"])
    except Exception:
        pass

    prof_res = sb.table("profiles").select("full_name, user_email").eq("nik", loan["nik"]).limit(1).execute()
    prof_rows = getattr(prof_res, "data", None) or []
    profile_raw = prof_rows[0] if prof_rows else {}
    profile = {
        "full_name": profile_raw.get("full_name"),
        "email": profile_raw.get("user_email"),
    }

    loan_for_pdf = {
        **loan,
        "status": "APPROVED",
        "ocr_raw": {
            **ocr_raw,
            "admin_signature": admin_signature,
            "stamp_applied": True,
            "stamp_style": stamp_style,
        },
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }
    pdf_url = _generate_and_upload_pdf(loan_for_pdf, profile, sha256_hash)

    stamped_image_url = None
    original_image_url = loan.get("image_url") or ""
    if original_image_url:
        try:
            from services.stamp_service import stamp_original_image
            stamped_bytes = stamp_original_image(
                original_image_url=original_image_url,
                admin_signature_b64=admin_signature,
                stamp_applied=stamp_applied,
                sha256_hash=sha256_hash,
                source=loan.get("source") or "CHAIN",
                doc_type=loan.get("doc_type") or "receipt",
                nominal=loan.get("nominal_pengajuan", 0),
                coords=coords,
                stamp_color=stamp_color,
                stamp_name=stamp_name,
            )
            if stamped_bytes:
                no_ref_stamp = ocr_raw.get("no_referensi") or str(loan.get("id", ""))[:8].upper()
                stamp_result = ImageKitService.upload_file(
                    stamped_bytes,
                    file_name=f"stamped_{no_ref_stamp}.jpg",
                    folder="/stamped_docs",
                )
                stamped_image_url = stamp_result.get("url")
                sb.table("loan_requests").update({
                    "stamped_image_url": stamped_image_url,
                }).eq("id", loan_id).execute()
        except Exception as e:
            print(f"[Stamp] Non-blocking stamp error: {e}")

    try:
        scan_id = (loan.get("ocr_raw") or {}).get("scan_id")
        if scan_id:
            sb.table("fraud_scans").update({
                "admin_reviewed": True,
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
                "admin_reviewed_by": str(current_user["id"]),
            }).eq("id", scan_id).execute()
    except Exception:
        pass

    chat_id = _resolve_chat_id(sb, loan["nik"])
    if chat_id:
        loan_source = loan.get("source") or "CHAIN"
        doc_info = {
            "nominal": loan["nominal_pengajuan"],
            "no_referensi": no_referensi,
            "doc_type": loan.get("doc_type") or "receipt",
        }
        msg = f"<b>Pemberitahuan</b>\nStatus Dokumen Kamu: <b>APPROVED</b>\nNominal: Rp {doc_info['nominal']:,}".replace(",", ".")
        msg += f"\n\n🛡️ <b>SHA-256 Seal:</b> <code>{sha256_hash[:16]}…</code>"
        if stamped_image_url:
            msg += f"\n\n🖼️ <a href='{stamped_image_url}'>Lihat Dokumen Berstempel</a>"
        # PDF form link disabled (sementara dinonaktifkan)
        # if pdf_url:
        #     msg += f"\n\n📄 <a href='{pdf_url}'>Lihat Form Persetujuan (PDF)</a>"
        send_telegram_notif(chat_id, msg)

    try:
        prof_gam = sb.table("profiles").select("id").eq("nik", loan["nik"]).limit(1).execute()
        prof_gam_rows = getattr(prof_gam, "data", None) or []
        if prof_gam_rows:
            from api.gamification import check_and_award_badges
            check_and_award_badges(str(prof_gam_rows[0]["id"]))
    except Exception as e:
        print(f"[Gamification] Non-blocking badge update error: {e}")

    return {
        "success": True, "loan_id": loan_id, "sha256_hash": sha256_hash,
        "message": "Kasbon berhasil di-approve dan data telah disegel dengan SHA-256.",
    }


async def kasbon_reject_loan(sb, current_user: dict, loan_id: str, reason: str):
    _ensure_loan_requests_ready(sb)

    res = sb.table("loan_requests").select("id, status").eq("id", loan_id).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Pengajuan tidak ditemukan.")
    if rows[0]["status"] != "PENDING":
        raise HTTPException(status_code=409, detail=f"Pengajuan sudah berstatus {rows[0]['status']}.")

    lr = sb.table("loan_requests").select("id, nik, nominal_pengajuan, ocr_raw, submitted_at, source, doc_type").eq("id", loan_id).limit(1).execute()
    lr_rows = getattr(lr, "data", None) or []
    loan_full = lr_rows[0] if lr_rows else rows[0]
    nik_rej = loan_full.get("nik", "")

    reject_reason = reason or "Ditolak oleh admin"
    existing_ocr = loan_full.get("ocr_raw") or {}

    reason_upper = reject_reason.upper()
    is_tampered = any(kw in reason_upper for kw in ("TAMPER", "MANIPULASI", "PALSU", "FRAUD", "PEMALSUAN"))
    ai_status = "TAMPERED" if is_tampered else existing_ocr.get("ai_indicator", "PROCESSING")

    sb.table("loan_requests").update({
        "status": "REJECTED",
        "ai_indicator": ai_status,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": str(current_user["id"]),
        "ocr_raw": {**existing_ocr, "reject_reason": reject_reason},
    }).eq("id", loan_id).execute()

    if is_tampered:
        try:
            update_credit_score(sb, nik_rej, "TAMPERED")
            prof_tm_res = sb.table("profiles").select("id,credit_score,fraud_flags").eq("nik", nik_rej).limit(1).execute()
            prof_tm_rows = getattr(prof_tm_res, "data", None) or []
            if prof_tm_rows:
                ps_tm = prof_tm_rows[0]
                new_score_tm = int(ps_tm.get("credit_score") or 0)
                new_flags_tm = int(ps_tm.get("fraud_flags") or 0)
                if new_score_tm >= 700:
                    new_int_tm = "HIGH"
                elif new_score_tm >= 400:
                    new_int_tm = "MEDIUM"
                else:
                    new_int_tm = "LOW"
                sb.table("integrity_metrics").upsert({
                    "user_id": ps_tm["id"],
                    "nik": nik_rej,
                    "integrity_level": new_int_tm,
                    "tampered_attempts": new_flags_tm,
                    "last_verified_at": datetime.now(timezone.utc).isoformat(),
                }).execute()
                
                calculate_otaru_index(ps_tm["id"])
        except Exception:
            pass

    try:
        scan_id = existing_ocr.get("scan_id")
        if scan_id:
            sb.table("fraud_scans").update({
                "admin_reviewed": True,
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
                "admin_reviewed_by": str(current_user["id"]),
            }).eq("id", scan_id).execute()
    except Exception:
        pass

    chat_id = _resolve_chat_id(sb, nik_rej)
    if chat_id:
        loan_source = loan_full.get("source") or "CHAIN"
        doc_info = {
            "nominal": loan_full.get("nominal_pengajuan", 0),
            "no_referensi": existing_ocr.get("no_referensi") or str(loan_full.get("id", ""))[:8].upper(),
            "doc_type": loan_full.get("doc_type") or "receipt",
        }
        notif_status = "TAMPERED" if is_tampered else "REJECTED"
        msg = f"<b>Pemberitahuan</b>\nStatus Dokumen Kamu: <b>{notif_status}</b>\nNominal: Rp {doc_info['nominal']:,}".replace(",", ".")
        if reject_reason:
            msg += f"\n\n📝 <b>Catatan Admin:</b>\n{escape(reject_reason)}"
        send_telegram_notif(chat_id, msg)

    return {"success": True, "loan_id": loan_id, "message": "Pengajuan berhasil ditolak."}


async def kasbon_process_document(sb, image_url: str, telegram_chat_id: Optional[int], tenor_bulan: Optional[int], no_referensi: Optional[str]):
    _ensure_loan_requests_ready(sb)

    if settings.KASBON_FAST_QUEUE and telegram_chat_id:
        nik_fast = _resolve_nik_from_telegram_chat(sb, telegram_chat_id)
        if nik_fast:
            # ── Dynamic amount extraction via Gemini Vision (replaces hardcoded 100K) ──
            nominal_fast = 0
            try:
                from services.fraud_ai_service import extract_amount_from_image
                nominal_fast = await extract_amount_from_image(image_url)
                print(f"[FastQueue] Gemini Vision extracted: Rp {nominal_fast:,}")
            except Exception as e:
                print(f"[FastQueue] Gemini Vision failed: {e}")

            # Fallback: OCR Tesseract + regex if Gemini returned 0
            if nominal_fast <= 0:
                try:
                    import tempfile
                    resp_img = requests.get(image_url, timeout=30)
                    resp_img.raise_for_status()
                    suffix = os.path.splitext(image_url.split("?")[0])[1] or ".jpg"
                    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
                    tmp.write(resp_img.content)
                    tmp.close()
                    raw_text_fb, _, _ = await OCRService.extract_text_tesseract(tmp.name)
                    os.unlink(tmp.name)
                    _, nominal_ocr = extract_nik_and_nominal(raw_text_fb or "")
                    if nominal_ocr and nominal_ocr > 0:
                        nominal_fast = nominal_ocr
                        print(f"[FastQueue] OCR fallback extracted: Rp {nominal_fast:,}")
                except Exception as e2:
                    print(f"[FastQueue] OCR fallback also failed: {e2}")

            # Final fallback: reject if we couldn't extract any amount
            if nominal_fast <= 0:
                return {
                    "success": False, "nik": nik_fast, "nominal_pengajuan": 0,
                    "ai_indicator": "PROCESSING", "status": "ERROR",
                    "message": "Nominal tidak terdeteksi dari gambar. Pastikan foto bon/struk jelas dan memuat angka total.",
                }

            profile_fast = _get_profile_by_nik(sb, nik_fast)
            available_fast = int(profile_fast.get("limit_pinjaman") or 0) - _active_loan_total(sb, nik_fast)
            if nominal_fast > available_fast:
                return {
                    "success": False, "nik": nik_fast, "nominal_pengajuan": nominal_fast,
                    "ai_indicator": "PROCESSING", "status": "REJECTED",
                    "message": f"Fast queue gagal: sisa limit tidak cukup. Sisa limit: Rp {available_fast:,}",
                }
            ins = sb.table("loan_requests").insert({
                "nik": nik_fast, "nominal_pengajuan": nominal_fast,
                "image_url": image_url, "status": "PENDING",
                "ai_indicator": "PROCESSING",
                "source": "CHAIN",
                "doc_type": "receipt",
                "ai_fraud_status": "NEEDS_REVIEW",
                "ai_fraud_reason": "Dokumen fast-queue. Nominal diekstrak otomatis via Gemini Vision. Review manual diperlukan.",
                "ocr_raw": {"mode": "fast_queue_gemini_vision", "source": "telegram", "ocr_extracted_amount": nominal_fast},
            }).execute()
            rows = getattr(ins, "data", None) or []
            loan_id = rows[0]["id"] if rows else None
            return {
                "success": True, "loan_id": str(loan_id) if loan_id else None,
                "nik": nik_fast, "nominal_pengajuan": nominal_fast,
                "ai_indicator": "PROCESSING", "status": "PENDING",
                "message": f"Pengajuan kasbon Rp {nominal_fast:,} berhasil diterima (fast queue, nominal diekstrak otomatis).",
            }

    tmp_name = ""
    try:
        resp = requests.get(image_url, timeout=30)
        resp.raise_for_status()
        suffix = os.path.splitext(image_url.split("?")[0])[1] or ".jpg"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(resp.content)
        tmp.close()
        tmp_name = tmp.name
        raw_text_extracted, conf_score, _ = await OCRService.extract_text_tesseract(tmp_name)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"OCR gagal: {exc}")
    finally:
        if tmp_name:
            try:
                os.unlink(tmp_name)
            except OSError:
                pass

    raw_text: str = raw_text_extracted or ""
    confidence_scores: list[float] = [float(conf_score)] if conf_score else []

    nik, nominal = extract_nik_and_nominal(raw_text)
    if not nik:
        return {
            "success": False, "ai_indicator": "PROCESSING", "status": "ERROR",
            "message": "NIK tidak terdeteksi oleh OCR. Pastikan foto jelas.",
        }
    if not nominal or nominal <= 0:
        return {
            "success": False, "nik": nik, "ai_indicator": "PROCESSING", "status": "ERROR",
            "message": "Nominal tidak terdeteksi oleh OCR.",
        }

    profile = _get_profile_by_nik(sb, nik)
    available_limit = int(profile.get("limit_pinjaman") or 0) - _active_loan_total(sb, nik)
    if nominal > available_limit:
        return {
            "success": False, "nik": nik, "nominal_pengajuan": nominal,
            "ai_indicator": "PROCESSING", "status": "REJECTED",
            "message": f"Nominal melebihi sisa limit. Sisa limit: Rp {available_limit:,}",
        }

    tenor = tenor_bulan or extract_tenor(raw_text)
    cicilan_ocr = extract_cicilan_from_ocr(raw_text)
    ai_indicator, dsr_status, auto_reject, cicilan_sistem = detect_tampering_sop(
        raw_text, confidence_scores, nominal, tenor, cicilan_ocr
    )

    update_credit_score(sb, nik, ai_indicator)

    # ── AI Fraud Analysis via Gemini 2.5 Flash ──────────────────────────
    try:
        fraud_result = await analyze_fraud_with_gemini(
            ocr_text=raw_text,
            source="CHAIN",
            doc_type="receipt",
        )
    except Exception as fraud_exc:
        print(f"[FraudAI] Non-blocking error: {fraud_exc}")
        fraud_result = {"status": "NEEDS_REVIEW", "reason": "Analisis AI gagal. Admin harus review manual."}

    try:
        ins = sb.table("loan_requests").insert({
            "nik": nik, "nominal_pengajuan": nominal, "image_url": image_url,
            "status": "PENDING", "ai_indicator": ai_indicator,
            "source": "CHAIN",
            "doc_type": "receipt",
            "ai_fraud_status": fraud_result["status"],
            "ai_fraud_reason": fraud_result["reason"],
            "ocr_raw": {
                "text": raw_text[:2000], "tenor_bulan": tenor,
                "cicilan_sistem": cicilan_sistem, "cicilan_ocr": cicilan_ocr,
                "dsr_status": dsr_status, "no_referensi": no_referensi,
            },
        }).execute()
        ins_rows = getattr(ins, "data", None) or []
        loan_id = ins_rows[0]["id"] if ins_rows else None
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan pengajuan: {exc}")

    return {
        "success": True, "loan_id": str(loan_id) if loan_id else None,
        "nik": nik, "nominal_pengajuan": nominal, "tenor_bulan": tenor,
        "cicilan_sistem": cicilan_sistem, "dsr_status": dsr_status,
        "ai_indicator": ai_indicator, "status": "PENDING",
        "message": f"Pengajuan kasbon Rp {nominal:,} berhasil diterima dan sedang menunggu persetujuan.",
    }


async def kasbon_need_revision(sb, current_user: dict, loan_id: str, notes: str):
    _ensure_loan_requests_ready(sb)

    res = sb.table("loan_requests").select("*").eq("id", loan_id).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Pengajuan tidak ditemukan.")
    if rows[0].get("status") != "PENDING":
        raise HTTPException(status_code=409, detail=f"Pengajuan sudah berstatus {rows[0].get('status')}.")

    loan = rows[0]
    existing_ocr = loan.get("ocr_raw") or {}

    sb.table("loan_requests").update({
        "status": "NEED_REVISION",
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": str(current_user["id"]),
        "ocr_raw": {**existing_ocr, "revision_notes": notes},
    }).eq("id", loan_id).execute()

    nik_rev = loan.get("nik", "")
    chat_id = _resolve_chat_id(sb, nik_rev)
    if chat_id:
        loan_source = loan.get("source") or "CHAIN"
        doc_info = {
            "nominal": loan.get("nominal_pengajuan", 0),
            "no_referensi": existing_ocr.get("no_referensi") or str(loan.get("id", ""))[:8].upper(),
            "doc_type": loan.get("doc_type") or "receipt",
        }
        msg = f"<b>Pemberitahuan</b>\nStatus Dokumen Kamu: <b>REVISION</b>\nNominal: Rp {doc_info['nominal']:,}".replace(",", ".")
        
        msg += f"\n\n📝 <b>Catatan Admin:</b>\n{escape(notes)}\n\n<i>Silakan perbaiki dokumen dan kirim ulang pengajuan.</i>"
        send_telegram_notif(chat_id, msg)

    return {"success": True, "loan_id": loan_id, "message": "Notifikasi revisi berhasil dikirim."}

