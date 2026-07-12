from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
import os
import tempfile

from config.database import get_db
from models.models import User
from utils.auth import get_current_active_user
from services.queue_service import get_queue_length, get_job_status, enqueue_scan
from services.imagekit_qr_service import ImageKitQRService
from services.scan_helpers import SCAN_COST, get_supabase_admin

router = APIRouter(prefix="/api/batch-scans", tags=["Batch Scans"])

@router.get("/queue-length")
async def get_batch_queue_info(current_user: User = Depends(get_current_active_user)):
    """Get current Redis queue depth."""
    try:
        return {"queue_length": get_queue_length()}
    except Exception as e:
        return {"queue_length": 0, "error": str(e)}


@router.get("/status/{job_id}")
async def get_batch_job_status(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Poll status of a batch scan job."""
    job = get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    if job.get("user_id") != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return job


@router.post("/")
async def batch_upload_scans(
    files: List[UploadFile] = File(...),
    recipient_name: str = Form(""),
    signature_url: str = Form(""),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Enqueue multiple scan files for background processing (max 20)."""
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
