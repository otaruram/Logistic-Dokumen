from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from config.database import get_db
from models.models import User
from utils.auth import get_current_active_user
from services.audit_service import AuditService
from api.tools import log_activity
import base64
import json

router = APIRouter()

@router.post("/analyze")
async def analyze_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Step 1: Upload & Initial Analysis
    """
    try:
        # Validate file
        if not file.content_type.startswith('image/') and file.content_type != 'application/pdf':
            raise HTTPException(status_code=400, detail="Invalid file type. Only images and PDFs allowed.")

        # Read file
        contents = await file.read()
        image_base64 = base64.b64encode(contents).decode('utf-8')
        
        # Run God Mode Audit
        print(f"🕵️ Starting Audit for User {current_user.id}...")
        result = await AuditService.audit_document(image_base64, str(current_user.id))
        
        # Log activity
        await log_activity(current_user.id, "audit", "analyze", {
            "filename": file.filename,
            "status": result["status"],
            "confidence": result["confidenceScore"]
        })
        
        return result

    except Exception as e:
        print(f"❌ Audit Endpoint Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
