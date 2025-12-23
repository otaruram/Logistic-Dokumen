"""
PPT API Routes - AI Presentation Builder (PPT.wtf)
Premium feature for generating presentations from scan data
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from config.database import get_db
from models.models import User, Scan, CreditHistory
from utils.auth import get_current_active_user
from services.ppt_service import PPTService
from api.tools import log_activity

router = APIRouter()

PPT_COST = 1  # Credit cost per PPT generation

from pydantic import BaseModel, Field
from typing import List, Optional

class PPTPromptRequest(BaseModel):
    prompt: str
    images: Optional[List[str]] = Field(default=[], max_items=2, description="Base64 encoded images")

@router.post("/generate-prompt")
async def generate_ppt_from_prompt(
    request: PPTPromptRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Generate PPT from Text Prompt + Optional Images
    Premium Feature - Costs 1 credit
    """
    try:
        if current_user.credits < PPT_COST:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient credits. Required: {PPT_COST}"
            )

        print(f"🎯 Generating PPT from prompt: {request.prompt[:50]}...")
        
        result = await PPTService.generate_from_prompt(
            prompt=request.prompt,
            user_id=str(current_user.id),
            image_data=request.images
        )
        
        # Deduct credits
        current_user.credits -= PPT_COST
        
        # Log credit usage
        credit_log = CreditHistory(
            user_id=current_user.id,
            amount=-PPT_COST,
            action='ppt_generation',
            reference_id=None # No scan ID for prompt generation
        )
        db.add(credit_log)
        db.commit()
        
        await log_activity(current_user.id, "ppt", "generate_prompt", {
            "prompt": request.prompt[:100],
            "images_count": len(request.images or [])
        })
        
        return {
            "success": True,
            "viewer_url": result["viewer_url"],
            "download_url": result["download_url"],
            "credits_remaining": current_user.credits
        }
        
    except Exception as e:
        print(f"❌ Generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate/{scan_id}")
async def generate_ppt(
    scan_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Generate PowerPoint presentation from scan data
    Premium Feature - Costs 1 credit
    """
    try:
        # Check credits
        if current_user.credits < PPT_COST:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient credits. Required: {PPT_COST}, Available: {current_user.credits}"
            )
        
        # Get scan data
        scan = db.query(Scan).filter(
            Scan.id == scan_id,
            Scan.user_id == current_user.id
        ).first()
        
        if not scan:
            raise HTTPException(status_code=404, detail="Scan not found")
        
        # Prepare scan data for PPT generation
        scan_data = {
            "id": scan.id,
            "original_filename": scan.original_filename,
            "extracted_text": scan.extracted_text or "No text extracted",
            "confidence_score": scan.confidence_score or 0,
            "recipient_name": scan.recipient_name,
            "created_at": scan.created_at.isoformat() if scan.created_at else None,
            "status": scan.status
        }
        
        print(f"🎯 Generating PPT for scan {scan_id}...")
        
        # Generate presentation
        result = await PPTService.generate_presentation(scan_data, str(current_user.id))
        
        # Deduct credits
        current_user.credits -= PPT_COST
        
        # Log credit usage
        credit_log = CreditHistory(
            user_id=current_user.id,
            amount=-PPT_COST,
            action='ppt_generation',
            reference_id=scan.id
        )
        db.add(credit_log)
        db.commit()
        
        print(f"💳 Credit deducted: User {current_user.id} | {current_user.credits + PPT_COST} -> {current_user.credits} (-{PPT_COST})")
        
        # Log activity
        await log_activity(current_user.id, "ppt", "generate", {
            "scan_id": scan_id,
            "filename": result["filename"]
        })
        
        return {
            "success": True,
            "message": "Presentation generated successfully!",
            "viewer_url": result["viewer_url"],
            "download_url": result["download_url"],
            "filename": result["filename"],
            "credits_remaining": current_user.credits
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ PPT generation error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate presentation: {str(e)}")

@router.get("/history")
async def get_ppt_history(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user's PPT generation history"""
    try:
        # Get PPT generation records from credit history
        ppt_records = db.query(CreditHistory).filter(
            CreditHistory.user_id == current_user.id,
            CreditHistory.action == 'ppt_generation'
        ).order_by(
            CreditHistory.created_at.desc()
        ).limit(20).all()
        
        return {
            "total": len(ppt_records),
            "records": [
                {
                    "id": record.id,
                    "scan_id": record.reference_id,
                    "created_at": record.created_at.isoformat() if record.created_at else None
                }
                for record in ppt_records
            ]
        }
        
    except Exception as e:
        print(f"❌ Get PPT history error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get PPT history")
