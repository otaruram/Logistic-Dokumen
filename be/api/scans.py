"""
Core scan routes — CRUD, upload, save-with-signature, cleanup-preview.
Fraud routes  → api/fraud.py
Export routes → api/exports.py
Batch routes  → api/batch_scans.py
"""

# pyright: reportGeneralTypeIssues=false, reportAssignmentType=false, reportArgumentType=false

import os
import hashlib
from datetime import datetime, timedelta

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from sqlalchemy.orm import Session
from typing import List

from config.database import get_db
from models.models import User, Scan, CreditHistory
from schemas.schemas import ScanResponse, ScanUpdate
from utils.auth import get_current_active_user
from utils.file_handler import FileHandler
from services.ocr_service import OCRService
from services.scan_helpers import (
    SCAN_COST,
    check_and_deduct_credits,
    upload_and_ocr,
    sync_to_supabase,
    get_supabase_admin,
)

router = APIRouter()


# ── Background helper ────────────────────────────────────────────────────────

async def process_scan_background(scan_id: int, file_path: str, db: Session):
    """Background task to process OCR on an uploaded file."""
    try:
        result = await OCRService.process_image(file_path, use_ai_enhancement=True)
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if scan:
            setattr(scan, "extracted_text", result["enhanced_text"])
            setattr(scan, "confidence_score", result["confidence_score"])
            setattr(scan, "processing_time", result["processing_time"])
            setattr(scan, "status", "completed")
            db.commit()
    except Exception as e:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if scan:
            setattr(scan, "status", "failed")
            setattr(scan, "error_message", str(e))
            db.commit()


# ── POST /upload ──────────────────────────────────────────────────────────────

@router.post("/upload", response_model=ScanResponse, status_code=201)
async def upload_scan(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Upload and process document scan (background OCR)."""
    # 1. Check and deduct credits (will sync with Supabase profiles and deduct SCAN_COST)
    await check_and_deduct_credits(user=current_user, db=db, action="scan")

    # 2. Proceed with upload
    file_path, _ = await FileHandler.save_file(file, current_user.id)
    file_size = os.path.getsize(file_path)

    new_scan = Scan(
        user_id=current_user.id,
        original_filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        file_type=file.content_type,
        status="processing",
    )
    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)

    # Note: check_and_deduct_credits already creates CreditHistory, but it doesn't set reference_id
    # Let's find the last credit history and update it
    last_log = (
        db.query(CreditHistory)
        .filter(CreditHistory.user_id == current_user.id)
        .order_by(CreditHistory.id.desc())
        .first()
    )
    if last_log and last_log.reference_id is None:
        last_log.reference_id = new_scan.id
        db.commit()

    background_tasks.add_task(process_scan_background, new_scan.id, file_path, db)
    return new_scan


# ── GET / ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[ScanResponse])
async def get_user_scans(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get all scans for current user."""
    scans = (
        db.query(Scan)
        .filter(Scan.user_id == current_user.id)
        .order_by(Scan.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []
    for scan in scans:
        d = {
            k: str(v) if k == "user_id" else v
            for k, v in scan.__dict__.items()
            if not k.startswith("_")
        }
        d["is_fraud_scan"] = bool(scan.is_fraud_scan) if scan.is_fraud_scan is not None else False
        if d["is_fraud_scan"]:
            d["fraud_fields"] = {
                "nominal_total": scan.fraud_nominal_total,
                "nama_klien": scan.fraud_nama_klien,
                "nomor_surat_jalan": scan.fraud_nomor_surat_jalan,
                "tanggal_jatuh_tempo": scan.fraud_tanggal_jatuh_tempo,
                "confidence": scan.fraud_confidence or "low",
            }
        else:
            d["fraud_fields"] = None
        results.append(d)

    return results


# ── GET /history ──────────────────────────────────────────────────────────────

@router.get("/history")
async def get_scan_history(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get scan history with metadata."""
    scans = (
        db.query(Scan)
        .filter(Scan.user_id == current_user.id)
        .order_by(Scan.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {
        "total": db.query(Scan).filter(Scan.user_id == current_user.id).count(),
        "scans": [
            {
                "id": s.id,
                "original_filename": s.original_filename,
                "imagekit_url": s.imagekit_url,
                "extracted_text": s.extracted_text,
                "confidence_score": s.confidence_score,
                "status": s.status,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "recipient_name": s.recipient_name,
                "signature_url": s.signature_url,
            }
            for s in scans
        ],
    }


# ── Batch routes ──────────────────────────────────────────────────────────────




# ── CRUD by ID ────────────────────────────────────────────────────────────────

@router.get("/{scan_id:int}", response_model=ScanResponse)
async def get_scan(
    scan_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get specific scan by ID."""
    scan = db.query(Scan).filter(Scan.id == scan_id, Scan.user_id == current_user.id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return {
        **{k: str(v) if k == "user_id" else v for k, v in scan.__dict__.items() if not k.startswith("_")}
    }


@router.delete("/{scan_id:int}")
async def delete_scan(
    scan_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete scan."""
    scan = db.query(Scan).filter(Scan.id == scan_id, Scan.user_id == current_user.id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    FileHandler.delete_file(scan.file_path)
    db.delete(scan)
    db.commit()
    return {"message": "Scan deleted successfully"}


@router.patch("/{scan_id:int}", response_model=ScanResponse)
async def update_scan(
    scan_id: int,
    scan_update: ScanUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update scan details (recipient, content). Fraud scans are immutable."""
    scan = db.query(Scan).filter(Scan.id == scan_id, Scan.user_id == current_user.id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    # Tight fraud rule: a fraud scan cannot be edited by users after it is saved.
    if scan.is_fraud_scan:
        raise HTTPException(
            status_code=403,
            detail="Fraud scan markers (verified/tampered/processing) are locked and cannot be edited.",
        )

    if scan_update.recipient_name is not None:
        setattr(scan, "recipient_name", scan_update.recipient_name)
    if scan_update.extracted_text is not None:
        setattr(scan, "extracted_text", scan_update.extracted_text)

    db.commit()
    db.refresh(scan)
    return {
        **{k: str(v) if k == "user_id" else v for k, v in scan.__dict__.items() if not k.startswith("_")}
    }


# ── POST /upload-test ─────────────────────────────────────────────────────────

@router.post("/upload-test")
async def upload_scan_test(file: UploadFile = File(...)):
    """Test upload — ImageKit + OCR, no auth / DB save."""
    import tempfile
    from services.imagekit_service import ImageKitService

    try:
        content = await file.read()

        # ImageKit
        image_url = None
        try:
            ik = ImageKitService.upload_file(
                file=content, file_name=file.filename or "scan.jpg", folder="/scans"
            )
            image_url = ik.get("url")
        except Exception as e:
            print(f"❌ ImageKit upload FAILED: {e}")

        # OCR
        suffix = os.path.splitext(file.filename or "")[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            ocr_result = await OCRService.process_image(tmp_path, use_ai_enhancement=True)
            extracted = ocr_result.get("enhanced_text") or ocr_result.get("raw_text") or "No text detected"
            return {
                "id": None,
                "file_path": image_url or "data:image/png;base64,temp",
                "extracted_text": extracted,
                "raw_text": ocr_result.get("raw_text", ""),
                "confidence_score": ocr_result.get("confidence_score", 0),
                "processing_time": ocr_result.get("processing_time", 0),
                "status": "completed",
            }
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    except Exception as e:
        import traceback
        print(f"❌ upload-test error: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# ── POST /upload-signature ────────────────────────────────────────────────────


