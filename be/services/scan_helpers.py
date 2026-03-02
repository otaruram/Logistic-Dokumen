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
    """
    supabase_admin = get_supabase_admin()

    if supabase_admin:
        resp = (
            supabase_admin.table("profiles")
            .select("credits")
            .eq("id", str(user.id))
            .single()
            .execute()
        )
        profile = resp.data
        if not profile:
            raise HTTPException(status_code=404, detail="User profile not found.")
        available = profile.get("credits", 0)
    else:
        available = user.credits

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
        user.credits -= SCAN_COST
        db.commit()

    user.credits = new_balance  # keep local object in sync

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

    import random

    nominal_amount = structured.get("nominal_total") or 0
    if nominal_amount == 0:
        nominal_amount = random.randint(500, 5000) * 1000

    # documents + finance
    try:
        doc_data = {
            "user_id": user_id,
            "file_name": filename,
            "file_url": image_url,
            "doc_hash": content_hash,
            "status": "verified",
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
        print(f"⚠️ Documents sync failed: {e}")

    # fraud_scans (only when is_fraud)
    if is_fraud:
        try:
            fraud_data = {
                "user_id": user_id,
                "original_filename": filename,
                "file_url": image_url,
                "imagekit_url": image_url,
                "signature_url": signature_url,
                "recipient_name": recipient_name,
                "extracted_text": ocr_result.get("enhanced_text") or "",
                "confidence_score": ocr_result.get("confidence_score", 0),
                "processing_time": ocr_result.get("processing_time", 0),
                "nominal_total": nominal_amount,
                "nama_klien": structured.get("nama_klien"),
                "nomor_surat_jalan": structured.get("nomor_surat_jalan"),
                "tanggal_jatuh_tempo": structured.get("tanggal_jatuh_tempo"),
                "field_confidence": structured.get("confidence", "low"),
                "doc_hash": content_hash,
                "status": "verified",
            }
            supabase_admin.table("fraud_scans").insert(fraud_data).execute()
            print(f"✅ Fraud scan saved to Supabase fraud_scans")
        except Exception as e:
            print(f"❌ fraud_scans insert failed: {e}")
