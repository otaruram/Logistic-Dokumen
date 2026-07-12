import traceback
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session

from config.database import get_db
from models.models import User, Scan
from utils.auth import get_current_active_user
from services.imagekit_qr_service import ImageKitQRService
from services.scan_helpers import handle_save_scan_with_signature, get_supabase_admin

router = APIRouter(prefix="/api/scans", tags=["Signature"])

@router.post("/upload-signature")
async def upload_signature(file: UploadFile = File(...)):
    """Upload signature to ImageKit QR with brightness enhancement."""
    try:
        content = await file.read()
        result = ImageKitQRService.upload_signature(
            file=content, file_name=file.filename or "signature.png"
        )
        return {"url": result.get("url"), "file_id": result.get("file_id")}
    except Exception as e:
        print(f"❌ Signature upload error: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Signature upload failed: {str(e)}")


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
    return await handle_save_scan_with_signature(request, file, recipient_name, signature_url, is_fraud_scan, current_user, db)


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
