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
                supabase_admin.table("profiles").upsert(
                    {"id": str(user.id), "credits": DEFAULT_CREDITS},
                    on_conflict="id",
                ).execute()
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
        print(f"⚠️ Documents sync failed: {e}")

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
