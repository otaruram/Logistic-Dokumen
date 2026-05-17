"""
Shared helpers for scan processing — credit check, ImageKit upload,
OCR pipeline, Supabase sync.  Used by scans.py, fraud.py, etc.
"""

import os
import hashlib
import tempfile
from datetime import date as dt_date
from typing import Optional, Tuple

from fastapi import HTTPException

from models.models import User, Scan, CreditHistory
from services.ocr_service import OCRService
from services.imagekit_qr_service import ImageKitQRService

SCAN_COST = 1  # Credit cost per scan


def confidence_to_status(confidence: str) -> str:
    """Map field confidence to fraud verification status.
    low  (0-1 fields found) → tampered  (ditolak)
    medium (2 fields found) → processing (diterima, perlu review)
    high (3+ fields found)  → verified   (terverifikasi)
    """
    mapping = {"low": "tampered", "medium": "processing", "high": "verified"}
    return mapping.get(confidence, "tampered")


# ── Credit helpers ───────────────────────────────────────────────────────────

def get_supabase_admin():
    """Lazy import to avoid circular dependencies."""
    from utils.auth import supabase_admin
    return supabase_admin


async def check_and_deduct_credits(
    user: User,
    db,
    *,
    action: str = "scan",
    reference_id: Optional[int] = None,
) -> int:
    """
    Verify the user has enough credits and deduct SCAN_COST.
    Returns the new credit balance.
    Raises HTTPException(402) when insufficient.
    Admin gets infinite credits (no deduction).
    """
    from config.settings import settings

    # Admin bypass — infinite credits
    user_email = getattr(user, "email", None)
    if isinstance(user_email, str) and user_email == settings.ADMIN_EMAIL:
        return 9999

    supabase_admin = get_supabase_admin()

    if supabase_admin:
        resp = (
            supabase_admin.table("profiles")
            .select("credits")
            .eq("id", str(user.id))
            .limit(1)
            .execute()
        )
        profile_rows = resp.data or []
        if not profile_rows:
            # New user — auto-initialize profile with default credits
            DEFAULT_CREDITS = 10
            try:
                upsert_data: dict = {"id": str(user.id), "credits": DEFAULT_CREDITS}
                email_val = getattr(user, "email", None)
                if email_val:
                    upsert_data["user_email"] = email_val
                supabase_admin.table("profiles").upsert(upsert_data, on_conflict="id").execute()
            except Exception as e:
                print(f"[credits] Failed to auto-init profile for {user.id}: {e}")
            available = DEFAULT_CREDITS
        else:
            profile = profile_rows[0] if isinstance(profile_rows[0], dict) else {}
            available = int(profile.get("credits") or 0)
    else:
        available = int(getattr(user, "credits", 0) or 0)

    if available < SCAN_COST:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Required: {SCAN_COST}, Available: {available}",
        )

    # Deduct
    new_balance = available - SCAN_COST
    if supabase_admin:
        supabase_admin.table("profiles").update({"credits": new_balance}).eq(
            "id", str(user.id)
        ).execute()
    else:
        setattr(user, "credits", new_balance)
        db.commit()

    setattr(user, "credits", new_balance)  # keep local object in sync

    # Log
    credit_log = CreditHistory(
        user_id=user.id,
        amount=-SCAN_COST,
        action=action,
        reference_id=reference_id,
    )
    db.add(credit_log)
    db.commit()

    return new_balance


# ── Upload + OCR pipeline ───────────────────────────────────────────────────

async def upload_and_ocr(
    content: bytes,
    filename: str,
    *,
    folder: str = "/qr-scans",
) -> Tuple[str, str, dict]:
    """
    1. Upload to ImageKit
    2. OCR the image via temp file

    Returns (image_url, extracted_text, ocr_result_dict).
    """
    # ImageKit
    ik = ImageKitQRService.upload_file(
        file=content, file_name=filename, folder=folder
    )
    image_url = ik.get("url", "")

    # Temp file → OCR
    suffix = os.path.splitext(filename)[1] or ".jpg"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(content)
    tmp.close()

    try:
        ocr_result = await OCRService.process_image(tmp.name, use_ai_enhancement=True)
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass

    extracted = (
        ocr_result.get("enhanced_text")
        or ocr_result.get("raw_text")
        or "No text detected"
    )
    return image_url, extracted, ocr_result


# ── Supabase sync ───────────────────────────────────────────────────────────

def sync_to_supabase(
    *,
    user_id: str,
    filename: str,
    image_url: str,
    content_hash: str,
    recipient_name: str,
    signature_url: str,
    structured: dict,
    ocr_result: dict,
    is_fraud: bool = False,
) -> None:
    """
    Insert into Supabase `documents` + `extracted_finance_data`,
    and optionally `fraud_scans`.
    """
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        return

    nominal_amount = structured.get("nominal_total") or 0

    # documents + finance
    try:
        doc_data = {
            "user_id": user_id,
            "file_name": filename,
            "file_url": image_url,
            "doc_hash": content_hash,
            "status": confidence_to_status(structured.get("confidence", "low")),
        }
        doc_result = supabase_admin.table("documents").insert(doc_data).execute()
        if doc_result.data:
            doc_id = doc_result.data[0]["id"]
            data_hash = hashlib.sha256(
                f"{recipient_name}_{dt_date.today()}_{nominal_amount}_{signature_url}".encode()
            ).hexdigest()
            finance_data = {
                "document_id": doc_id,
                "user_id": user_id,
                "vendor_name": recipient_name or "Unknown Vendor",
                "client_name": structured.get("nama_klien"),
                "invoice_number": structured.get("nomor_surat_jalan"),
                "due_date": structured.get("tanggal_jatuh_tempo"),
                "transaction_date": dt_date.today().isoformat(),
                "nominal_amount": nominal_amount,
                "field_confidence": structured.get("confidence", "low"),
                "data_hash": data_hash,
            }
            supabase_admin.table("extracted_finance_data").insert(finance_data).execute()
            print(f"✅ Synced to documents + finance_data")
    except Exception as e:
        return False


async def handle_save_scan_with_signature(request, file, recipient_name: str, signature_url: str, is_fraud_scan: str, current_user, db) -> dict:
    import hashlib
    from models.models import Scan, CreditHistory
    
    fraud_query = request.query_params.get("fraud", "false")
    is_fraud = is_fraud_scan.lower() == "true" or fraud_query.lower() == "true"

    print(f"📝 SAVE Request - Recipient: {recipient_name}, is_fraud: {is_fraud}")

    new_balance = await check_and_deduct_credits(
        user=current_user, db=db, action="scan"
    )

    content = await file.read()
    image_url, extracted, ocr_result = await upload_and_ocr(
        content, file.filename or "scan.jpg"
    )
    structured = ocr_result.get("structured_fields", {})

    if is_fraud:
        confidence = structured.get("confidence", "low")
        fraud_status = confidence_to_status(confidence)
        doc_type = structured.get("doc_type", "unknown")

        check_fields = [
            "nominal_total", "nomor_dokumen", "nama_penjual", "nama_klien",
            "tanggal_terbit", "metode_bayar", "no_referensi", "terminal_id",
            "nomor_surat_jalan", "tanggal_jatuh_tempo",
        ]
        filled = [k for k in check_fields if structured.get(k)]
        if len(filled) >= 4:
            confidence = "high"
        elif len(filled) >= 2:
            confidence = "medium"
        else:
            confidence = "low"
        fraud_status = confidence_to_status(confidence)

        if confidence == "low":
            tampered_scan = Scan(
                user_id=current_user.id,
                original_filename=file.filename,
                file_path="imagekit",
                file_size=len(content),
                file_type=file.content_type,
                imagekit_url=image_url,
                recipient_name=recipient_name,
                signature_url=signature_url,
                extracted_text=extracted,
                confidence_score=ocr_result.get("confidence_score", 0),
                processing_time=ocr_result.get("processing_time", 0),
                status="tampered",
                is_fraud_scan=True,
                fraud_nominal_total=structured.get("nominal_total") or 0,
                fraud_nama_klien=structured.get("nama_klien"),
                fraud_nomor_surat_jalan=structured.get("nomor_surat_jalan"),
                fraud_tanggal_jatuh_tempo=structured.get("tanggal_jatuh_tempo"),
                fraud_confidence="low",
            )
            db.add(tampered_scan)
            db.commit()
            db.refresh(tampered_scan)

            content_hash = hashlib.sha256(content).hexdigest()
            sync_to_supabase(
                user_id=str(current_user.id),
                filename=file.filename or "scan.jpg",
                image_url=image_url,
                content_hash=content_hash,
                recipient_name=recipient_name,
                signature_url=signature_url,
                structured=structured,
                ocr_result=ocr_result,
                is_fraud=True,
            )

            print(f"🟠 FRAUD ACCEPTED (tampered) - id={tampered_scan.id}, confidence=low, file={file.filename}")
            return {
                "id": tampered_scan.id,
                "file_path": image_url,
                "imagekit_url": image_url,
                "extracted_text": extracted,
                "recipient_name": recipient_name,
                "signature_url": signature_url,
                "status": "tampered",
                "is_fraud_scan": True,
                "field_confidence": "low",
                "fraud_status": "tampered",
                "credits_remaining": new_balance,
                "rejected": False,
                "rejection_reason": None,
            }

        new_scan = Scan(
            user_id=current_user.id,
            original_filename=file.filename,
            file_path="imagekit",
            file_size=len(content),
            file_type=file.content_type,
            imagekit_url=image_url,
            recipient_name=recipient_name,
            signature_url=signature_url,
            extracted_text=extracted,
            confidence_score=ocr_result.get("confidence_score", 0),
            processing_time=ocr_result.get("processing_time", 0),
            status=fraud_status,
            is_fraud_scan=True,
            fraud_nominal_total=structured.get("nominal_total") or 0,
            fraud_nama_klien=structured.get("nama_klien"),
            fraud_nomor_surat_jalan=structured.get("nomor_surat_jalan"),
            fraud_tanggal_jatuh_tempo=structured.get("tanggal_jatuh_tempo"),
            fraud_confidence=confidence,
        )
    else:
        new_scan = Scan(
            user_id=current_user.id,
            original_filename=file.filename,
            file_path="imagekit",
            file_size=len(content),
            file_type=file.content_type,
            imagekit_url=image_url,
            recipient_name=recipient_name,
            signature_url=signature_url,
            extracted_text=extracted,
            confidence_score=ocr_result.get("confidence_score", 0),
            processing_time=ocr_result.get("processing_time", 0),
            status="completed",
            is_fraud_scan=False,
        )

    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)

    last_log = (
        db.query(CreditHistory)
        .filter(CreditHistory.user_id == current_user.id)
        .order_by(CreditHistory.id.desc())
        .first()
    )
    if last_log and last_log.reference_id is None:
        last_log.reference_id = new_scan.id
        db.commit()

    print(f"✅ Scan saved: id={new_scan.id}, is_fraud={is_fraud}, status={new_scan.status}")

    content_hash = hashlib.sha256(content).hexdigest()
    sync_to_supabase(
        user_id=str(current_user.id),
        filename=file.filename or "scan.jpg",
        image_url=image_url,
        content_hash=content_hash,
        recipient_name=recipient_name,
        signature_url=signature_url,
        structured=structured,
        ocr_result=ocr_result,
        is_fraud=is_fraud,
    )

    return {
        "id": new_scan.id,
        "file_path": image_url,
        "imagekit_url": image_url,
        "extracted_text": extracted,
        "recipient_name": recipient_name,
        "signature_url": signature_url,
        "status": new_scan.status,
        "is_fraud_scan": bool(new_scan.is_fraud_scan),
        "field_confidence": getattr(new_scan, "fraud_confidence", None) or "low",
        "fraud_status": new_scan.status if is_fraud else None,
        "credits_remaining": new_balance,
        "rejected": False,
    }


    # fraud_scans (only when is_fraud)
    if is_fraud:
        try:
            fraud_status = confidence_to_status(structured.get("confidence", "low"))
            # Tampered docs get nominal = 0 (rejected, no valid amount)
            fraud_nominal_total = 0 if fraud_status == "tampered" else (structured.get("nominal_total") or 0)
            fraud_nominal_subtotal = None if fraud_status == "tampered" else structured.get("nominal_subtotal")
            fraud_nominal_ppn = None if fraud_status == "tampered" else structured.get("nominal_ppn")

            fraud_data_full = {
                "user_id": user_id,
                "original_filename": filename,
                "file_url": image_url,
                "imagekit_url": image_url,
                "signature_url": signature_url,
                "recipient_name": recipient_name,
                "extracted_text": ocr_result.get("enhanced_text") or "",
                "confidence_score": ocr_result.get("confidence_score", 0),
                "processing_time": ocr_result.get("processing_time", 0),
                "nominal_total": fraud_nominal_total,
                # Legacy fields (kept for backward compat)
                "nama_klien": structured.get("nama_klien"),
                "nomor_surat_jalan": structured.get("nomor_surat_jalan"),
                "tanggal_jatuh_tempo": structured.get("tanggal_jatuh_tempo"),
                "field_confidence": structured.get("confidence", "low"),
                "doc_hash": content_hash,
                "status": fraud_status,
                # Universal invoice fields
                "doc_type": structured.get("doc_type"),
                "nomor_dokumen": structured.get("nomor_dokumen"),
                "tanggal_terbit": structured.get("tanggal_terbit"),
                "nama_penjual": structured.get("nama_penjual"),
                "nominal_subtotal": fraud_nominal_subtotal,
                "nominal_ppn": fraud_nominal_ppn,
                "metode_bayar": structured.get("metode_bayar"),
                "terminal_id": structured.get("terminal_id"),
                "no_referensi": structured.get("no_referensi"),
            }
            # Remove None values
            fraud_data = {k: v for k, v in fraud_data_full.items() if v is not None}
            try:
                supabase_admin.table("fraud_scans").insert(fraud_data).execute()
                print(f"✅ Fraud scan saved to Supabase fraud_scans (doc_type={structured.get('doc_type')})")
                # Apply SHA-256 integrity seal
                try:
                    from services.ledger_service import seal_scan as _seal
                    # Re-fetch the inserted row to get its id + created_at
                    last_row = (
                        supabase_admin.table("fraud_scans")
                        .select("id, user_id, nominal_total, created_at")
                        .eq("user_id", user_id)
                        .order("created_at", desc=True)
                        .limit(1)
                        .execute()
                    )
                    if getattr(last_row, "data", None):
                        _seal(supabase_admin, last_row.data[0])
                except Exception as seal_err:
                    print(f"⚠️ Ledger seal failed (non-blocking): {seal_err}")
            except Exception as insert_err:
                err_str = str(insert_err)
                # If new columns don't exist yet, fall back to legacy-only insert
                new_cols = {"doc_type", "nomor_dokumen", "tanggal_terbit", "nama_penjual",
                            "nominal_subtotal", "nominal_ppn", "metode_bayar", "terminal_id", "no_referensi"}
                if any(col in err_str for col in new_cols):
                    print(f"⚠️ New columns not yet in DB, retrying with legacy fields: {insert_err}")
                    legacy_data = {k: v for k, v in fraud_data.items() if k not in new_cols}
                    supabase_admin.table("fraud_scans").insert(legacy_data).execute()
                    print(f"✅ Fraud scan saved (legacy fallback)")
                else:
                    raise
        except Exception as e:
            print(f"❌ fraud_scans insert failed: {e}")

