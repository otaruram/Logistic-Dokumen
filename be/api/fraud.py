"""
Fraud scan routes — /api/scans/fraud-history, /debug-fraud, /save-fraud
"""

import hashlib
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from config.database import get_db
from models.models import User, Scan
from utils.auth import get_current_active_user
from services.scan_helpers import (
    SCAN_COST,
    check_and_deduct_credits,
    upload_and_ocr,
    sync_to_supabase,
    get_supabase_admin,
    confidence_to_status,
)

router = APIRouter()


@router.get("/fraud-history")
async def get_fraud_scan_history(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
):
    """Get fraud scan history from Supabase fraud_scans table"""
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    try:
        result = (
            supabase_admin.table("fraud_scans")
            .select("*")
            .eq("user_id", str(current_user.id))
            .order("created_at", desc=True)
            .range(skip, skip + limit - 1)
            .execute()
        )
        records = result.data or []
        print(
            f"📋 GET /api/scans/fraud-history - "
            f"Found {len(records)} fraud records for user {current_user.id}"
        )
        return {
            "total": len(records),
            "records": [
                {
                    "id": r.get("id"),
                    "original_filename": r.get("original_filename", ""),
                    "imagekit_url": r.get("imagekit_url") or r.get("file_url", ""),
                    "file_url": r.get("file_url", ""),
                    "signature_url": r.get("signature_url", ""),
                    "recipient_name": r.get("recipient_name", ""),
                    "extracted_text": r.get("extracted_text", ""),
                    "confidence_score": r.get("confidence_score", 0),
                    "processing_time": r.get("processing_time", 0),
                    "status": r.get("status", "processing"),
                    "created_at": r.get("created_at"),
                    "nominal_total": r.get("nominal_total", 0),
                    "nama_klien": r.get("nama_klien"),
                    "nomor_surat_jalan": r.get("nomor_surat_jalan"),
                    "tanggal_jatuh_tempo": r.get("tanggal_jatuh_tempo"),
                    "field_confidence": r.get("field_confidence", "low"),
                    "doc_hash": r.get("doc_hash"),
                }
                for r in records
            ],
        }
    except Exception as e:
        print(f"❌ Error loading fraud history: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to load fraud history: {str(e)}"
        )


@router.delete("/fraud/{fraud_id}")
async def delete_fraud_scan(
    fraud_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Delete a fraud scan record from Supabase fraud_scans table."""
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    try:
        # Delete from fraud_scans (verify user ownership)
        result = (
            supabase_admin.table("fraud_scans")
            .delete()
            .eq("id", fraud_id)
            .eq("user_id", str(current_user.id))
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Fraud record not found")

        print(f"🗑️ Deleted fraud scan {fraud_id} for user {current_user.id}")
        return {"message": "Fraud record deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting fraud scan: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete fraud record: {str(e)}")


@router.get("/debug-fraud")
async def debug_fraud_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Debug: check fraud scan status across all data sources"""
    supabase_admin = get_supabase_admin()

    all_scans = db.query(Scan).filter(Scan.user_id == current_user.id).all()
    fraud_local = [s for s in all_scans if s.is_fraud_scan]
    default_local = [s for s in all_scans if not s.is_fraud_scan]

    supabase_fraud_count = 0
    supabase_status = "not_configured"
    if supabase_admin:
        try:
            result = (
                supabase_admin.table("fraud_scans")
                .select("id, created_at, status")
                .eq("user_id", str(current_user.id))
                .execute()
            )
            supabase_fraud_count = len(result.data) if result.data else 0
            supabase_status = "ok"
        except Exception as e:
            supabase_status = f"error: {str(e)}"

    return {
        "user_id": str(current_user.id),
        "sqlalchemy_total_scans": len(all_scans),
        "sqlalchemy_fraud_scans": len(fraud_local),
        "sqlalchemy_default_scans": len(default_local),
        "supabase_fraud_scans_count": supabase_fraud_count,
        "supabase_status": supabase_status,
        "fraud_scan_ids": [
            {
                "id": s.id,
                "filename": s.original_filename,
                "created": str(s.created_at),
            }
            for s in fraud_local[:10]
        ],
    }


@router.post("/save-fraud")
async def save_fraud_scan(
    file: UploadFile = File(...),
    recipient_name: str = Form(""),
    signature_url: str = Form(""),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Dedicated endpoint for FRAUD scans — always is_fraud_scan=True
    
    Confidence → Status mapping:
      low  (0-1 fields) → tampered  → REJECTED, not saved
      medium (2 fields) → processing → saved, needs manual review
      high (3+ fields)  → verified   → saved, document is authentic
    """
    print(f"🔴 FRAUD SCAN Request - Recipient: {recipient_name}, File: {file.filename}")

    # 1. Check & deduct credits
    new_balance = await check_and_deduct_credits(user=current_user, db=db, action="fraud_scan")

    try:
        content = await file.read()

        # 2. Upload + OCR
        image_url, extracted, ocr_result = await upload_and_ocr(
            content, file.filename or "fraud_scan.jpg"
        )
        structured = ocr_result.get("structured_fields", {})
        confidence = structured.get("confidence", "low")
        fraud_status = confidence_to_status(confidence)

        # 3. LOW confidence → REJECT immediately, don't save anywhere
        if confidence == "low":
            print(f"🚫 FRAUD REJECTED (tampered) - confidence=low, file={file.filename}")
            return {
                "id": None,
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
                "rejected": True,
                "rejection_reason": "Document has insufficient verifiable fields. Authenticity cannot be confirmed — flagged as tampered.",
            }

        # 4. MEDIUM or HIGH → Save to local DB
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
            status=fraud_status,  # "processing" or "verified"
            is_fraud_scan=True,
            fraud_nominal_total=structured.get("nominal_total") or 0,
            fraud_nama_klien=structured.get("nama_klien"),
            fraud_nomor_surat_jalan=structured.get("nomor_surat_jalan"),
            fraud_tanggal_jatuh_tempo=structured.get("tanggal_jatuh_tempo"),
            fraud_confidence=confidence,
        )
        db.add(new_scan)
        db.commit()
        db.refresh(new_scan)

        # Update credit log reference
        from models.models import CreditHistory

        last_log = (
            db.query(CreditHistory)
            .filter(CreditHistory.user_id == current_user.id)
            .order_by(CreditHistory.id.desc())
            .first()
        )
        if last_log and last_log.reference_id is None:
            last_log.reference_id = new_scan.id
            db.commit()

        print(f"✅ FRAUD scan saved: id={new_scan.id}, status={fraud_status}, confidence={confidence}")

        # 5. Supabase sync (only for medium/high)
        content_hash = hashlib.sha256(content).hexdigest()
        sync_to_supabase(
            user_id=str(current_user.id),
            filename=file.filename or "fraud_scan.jpg",
            image_url=image_url,
            content_hash=content_hash,
            recipient_name=recipient_name,
            signature_url=signature_url,
            structured=structured,
            ocr_result=ocr_result,
            is_fraud=True,
        )

        return {
            "id": new_scan.id,
            "file_path": image_url,
            "imagekit_url": image_url,
            "extracted_text": extracted,
            "recipient_name": recipient_name,
            "signature_url": signature_url,
            "status": fraud_status,
            "is_fraud_scan": True,
            "field_confidence": confidence,
            "fraud_status": fraud_status,
            "credits_remaining": new_balance,
            "rejected": False,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Fraud scan error: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Fraud scan failed: {str(e)}")

