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
    if current_user.credits < SCAN_COST:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Required: {SCAN_COST}, Available: {current_user.credits}",
        )

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

    setattr(current_user, "credits", int(getattr(current_user, "credits", 0)) - SCAN_COST)
    credit_log = CreditHistory(
        user_id=current_user.id,
        amount=-SCAN_COST,
        action="scan",
        reference_id=new_scan.id,
    )
    db.add(credit_log)
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

@router.get("/batch/queue-length")
async def get_batch_queue_info(current_user: User = Depends(get_current_active_user)):
    """Get current Redis queue depth."""
    try:
        from services.queue_service import get_queue_length
        return {"queue_length": get_queue_length()}
    except Exception as e:
        return {"queue_length": 0, "error": str(e)}


@router.get("/batch/status/{job_id}")
async def get_batch_job_status(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Poll status of a batch scan job."""
    from services.queue_service import get_job_status

    job = get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    if job.get("user_id") != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return job


@router.post("/batch")
async def batch_upload_scans(
    files: List[UploadFile] = File(...),
    recipient_name: str = Form(""),
    signature_url: str = Form(""),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Enqueue multiple scan files for background processing (max 20)."""
    import tempfile
    from services.queue_service import enqueue_scan
    from services.imagekit_qr_service import ImageKitQRService

    MAX_BATCH = 20
    supabase_admin = get_supabase_admin()

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(files) > MAX_BATCH:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_BATCH} files per batch")
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase admin not available")

    profile = (
        supabase_admin.table("profiles")
        .select("credits")
        .eq("id", str(current_user.id))
        .limit(1)
        .execute()
    )
    profile_rows = profile.data or []
    if not profile_rows:
        supabase_admin.table("profiles").insert(
            {"id": str(current_user.id), "email": current_user.email, "credits": 10}
        ).execute()
        current_credits = 10
    else:
        profile_data = profile_rows[0] if isinstance(profile_rows[0], dict) else {}
        current_credits = profile_data.get("credits", 0)

    total_cost = len(files) * SCAN_COST
    if current_credits < total_cost:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need {total_cost} for {len(files)} files, have {current_credits}",
        )

    jobs: list[dict] = []
    for file in files:
        content = await file.read()
        image_url = ""
        try:
            ik = ImageKitQRService.upload_file(
                file=content, file_name=file.filename or "scan.jpg", folder="/qr-scans"
            )
            image_url = ik.get("url", "")
        except Exception as e:
            print(f"ImageKit upload failed for {file.filename}: {e}")

        suffix = os.path.splitext(file.filename or ".jpg")[1] or ".jpg"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(content)
        tmp.close()

        job_id = enqueue_scan(
            user_id=str(current_user.id),
            file_path=tmp.name,
            file_name=file.filename or "scan.jpg",
            recipient_name=recipient_name,
            signature_url=signature_url,
            image_url=image_url,
        )
        jobs.append({"job_id": job_id, "file_name": file.filename})

    return {
        "message": f"{len(files)} file(s) queued for processing",
        "jobs": jobs,
        "estimated_wait_seconds": len(files) * 15,
    }


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

@router.post("/upload-signature")
async def upload_signature(file: UploadFile = File(...)):
    """Upload signature to ImageKit QR with brightness enhancement."""
    from services.imagekit_qr_service import ImageKitQRService

    try:
        content = await file.read()
        result = ImageKitQRService.upload_signature(
            file=content, file_name=file.filename or "signature.png"
        )
        return {"url": result.get("url"), "file_id": result.get("file_id")}
    except Exception as e:
        import traceback
        print(f"❌ Signature upload error: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Signature upload failed: {str(e)}")


# ── POST /save-with-signature ─────────────────────────────────────────────────

@router.post("/save-with-signature")
async def save_scan_with_signature(
    request: Request,
    file: UploadFile = File(...),
    recipient_name: str = Form(""),
    signature_url: str = Form(""),
    is_fraud_scan: str = Form("false"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Save scan to DB with recipient name and signature.
    
        For fraud scans, applies confidence-based status:
            low  → tampered  → accepted and saved to history
            medium → processing → saved, needs review
            high → verified → saved, authentic
    """
    from services.scan_helpers import confidence_to_status

    fraud_query = request.query_params.get("fraud", "false")
    is_fraud = is_fraud_scan.lower() == "true" or fraud_query.lower() == "true"

    print(f"📝 SAVE Request - Recipient: {recipient_name}, is_fraud: {is_fraud}")

    # 1. Check & deduct credits
    new_balance = await check_and_deduct_credits(
        user=current_user, db=db, action="scan"
    )

    try:
        content = await file.read()

        # 2. Upload + OCR
        image_url, extracted, ocr_result = await upload_and_ocr(
            content, file.filename or "scan.jpg"
        )
        structured = ocr_result.get("structured_fields", {})

        # 3. For fraud scans, apply confidence-based status
        if is_fraud:
            confidence = structured.get("confidence", "low")
            fraud_status = confidence_to_status(confidence)

            # Strict fraud gate: all core fields must be present to avoid false verified/processing.
            critical_fields = {
                "nominal_total": bool(structured.get("nominal_total")),
                "nama_klien": bool(structured.get("nama_klien")),
                "nomor_surat_jalan": bool(structured.get("nomor_surat_jalan")),
                "tanggal_jatuh_tempo": bool(structured.get("tanggal_jatuh_tempo")),
            }
            missing_fields = [k for k, ok in critical_fields.items() if not ok]
            rejection_reason = "Document has insufficient verifiable fields. Authenticity cannot be confirmed — flagged as tampered."
            if missing_fields:
                confidence = "low"
                fraud_status = "tampered"
                rejection_reason = (
                    "Strict fraud validation failed. Missing fields: "
                    + ", ".join(missing_fields)
                    + ". Document flagged as tampered."
                )

            # LOW confidence → save to local DB + Supabase as tampered
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

                # Sync tampered to Supabase so dashboard counter works
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

            # MEDIUM or HIGH → save with correct status
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
        else:
            # Default (non-fraud) scan — always "completed"
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

        # Update credit log reference
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

        # 4. Supabase sync
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

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"❌ Save scan error: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Save failed: {str(e)}")


# ── GET /cleanup-preview ──────────────────────────────────────────────────────

@router.get("/cleanup-preview")
async def get_cleanup_preview(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Preview scans that will be deleted in next weekly cleanup."""
    try:
        cutoff = datetime.now() - timedelta(days=7)
        old_scans = (
            db.query(Scan)
            .filter(Scan.user_id == current_user.id, Scan.created_at < cutoff)
            .all()
        )

        supabase_admin = get_supabase_admin()
        ik_count = 0
        if supabase_admin:
            try:
                old_files = (
                    supabase_admin.table("imagekit_files")
                    .select("*")
                    .eq("user_id", current_user.id)
                    .lt("created_at", cutoff.isoformat())
                    .execute()
                )
                ik_count = len(old_files.data) if old_files.data else 0
            except Exception:
                pass

        return {
            "scans_count": len(old_scans),
            "imagekit_count": ik_count,
            "scans": [
                {
                    "id": s.id,
                    "filename": s.original_filename,
                    "created_at": s.created_at.isoformat(),
                }
                for s in old_scans[:10]
            ],
            "next_cleanup": "Every Sunday 00:00 UTC",
        }
    except Exception as e:
        print(f"❌ Cleanup preview error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get cleanup preview")
