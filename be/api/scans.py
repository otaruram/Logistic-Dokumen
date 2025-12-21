"""
Scans API routes - dgtnz.wtf functionality
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import os

from config.database import get_db
from models.models import User, Scan, CreditHistory
from schemas.schemas import ScanResponse
from utils.auth import get_current_active_user
from utils.file_handler import FileHandler
from services.ocr_service import OCRService

router = APIRouter()

SCAN_COST = 1  # Credit cost per scan

async def process_scan_background(scan_id: int, file_path: str, db: Session):
    """Background task to process OCR"""
    try:
        # Process OCR
        result = await OCRService.process_image(file_path, use_ai_enhancement=True)
        
        # Update scan record
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if scan:
            scan.extracted_text = result['enhanced_text']
            scan.confidence_score = result['confidence_score']
            scan.processing_time = result['processing_time']
            scan.status = 'completed'
            db.commit()
    
    except Exception as e:
        # Update scan with error
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if scan:
            scan.status = 'failed'
            scan.error_message = str(e)
            db.commit()

@router.post("/upload", response_model=ScanResponse, status_code=201)
async def upload_scan(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload and process document scan"""
    
    # Check credits
    if current_user.credits < SCAN_COST:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Required: {SCAN_COST}, Available: {current_user.credits}"
        )
    
    # Save file
    file_path, unique_filename = await FileHandler.save_file(file, current_user.id)
    
    # Get file info
    file_size = os.path.getsize(file_path)
    
    # Create scan record
    new_scan = Scan(
        user_id=current_user.id,
        original_filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        file_type=file.content_type,
        status='processing'
    )
    
    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)
    
    # Deduct credits (1 credit for DGTNZ scan)
    current_user.credits -= SCAN_COST
    
    # Log credit usage
    credit_log = CreditHistory(
        user_id=current_user.id,
        amount=-SCAN_COST,
        action='scan',
        reference_id=new_scan.id
    )
    db.add(credit_log)
    db.commit()
    
    # Log activity for analytics
    from api.tools import log_activity
    await log_activity(current_user.id, "dgtnz", "scan", {
        "scan_id": new_scan.id,
        "filename": file.filename,
        "file_size": file_size
    })
    
    # Process OCR in background
    background_tasks.add_task(process_scan_background, new_scan.id, file_path, db)
    
    return new_scan

@router.get("/", response_model=List[ScanResponse])
async def get_user_scans(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all scans for current user"""
    scans = db.query(Scan).filter(
        Scan.user_id == current_user.id
    ).order_by(
        Scan.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return scans

@router.get("/{scan_id}", response_model=ScanResponse)
async def get_scan(
    scan_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get specific scan by ID"""
    scan = db.query(Scan).filter(
        Scan.id == scan_id,
        Scan.user_id == current_user.id
    ).first()
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    return scan

@router.delete("/{scan_id}")
async def delete_scan(
    scan_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete scan"""
    scan = db.query(Scan).filter(
        Scan.id == scan_id,
        Scan.user_id == current_user.id
    ).first()
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Delete file
    FileHandler.delete_file(scan.file_path)
    
    # Delete record
    db.delete(scan)
    db.commit()
    
    return {"message": "Scan deleted successfully"}

@router.post("/upload-test")
async def upload_scan_test(
    file: UploadFile = File(...),
):
    """Test upload endpoint - Upload to ImageKit, process with Tesseract + OpenAI"""
    import tempfile
    import traceback
    from services.imagekit_service import ImageKitService
    
    try:
        # Read file content
        content = await file.read()
        
        # 1. Upload to ImageKit FIRST
        print("📤 Uploading to ImageKit...")
        image_url = None
        try:
            imagekit_result = ImageKitService.upload_file(
                file=content,
                file_name=file.filename or "scan.jpg",
                folder="/scans"
            )
            image_url = imagekit_result.get("url")
            print(f"✅ ImageKit upload SUCCESS!")
            print(f"   URL: {image_url}")
            print(f"   File ID: {imagekit_result.get('file_id')}")
        except Exception as ik_error:
            print(f"❌ ImageKit upload FAILED: {ik_error}")
            import traceback as tb
            print(tb.format_exc())
        
        # 2. Save to temporary file for OCR processing
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename or "")[1]) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # 3. Process OCR with Tesseract + OpenAI enhancement
            print("🔍 Processing OCR with Tesseract + OpenAI...")
            ocr_result = await OCRService.process_image(tmp_path, use_ai_enhancement=True)
            print(f"✅ OCR completed: {ocr_result.get('confidence_score', 0)}% confidence")
            
            # IMPORTANT: Use ImageKit URL if available, otherwise fallback
            final_url = image_url if image_url else f"data:image/png;base64,temp"
            print(f"🖼️ Final image URL: {final_url[:100]}...")
            
            # Get extracted text with fallback
            extracted = ocr_result.get("enhanced_text") or ocr_result.get("raw_text") or "No text detected"
            
            return {
                "id": None,
                "file_path": final_url,
                "extracted_text": extracted,
                "raw_text": ocr_result.get("raw_text", ""),
                "confidence_score": ocr_result.get("confidence_score", 0),
                "processing_time": ocr_result.get("processing_time", 0),
                "status": "completed"
            }
        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except:
                pass
        
    except Exception as e:
        print(f"❌ Error in upload-test: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/upload-signature")
async def upload_signature(
    file: UploadFile = File(...),
):
    """Upload signature to ImageKit"""
    import traceback
    from services.imagekit_service import ImageKitService
    
    try:
        content = await file.read()
        
        print("📤 Uploading signature to ImageKit...")
        imagekit_result = ImageKitService.upload_file(
            file=content,
            file_name=file.filename or "signature.png",
            folder="/signatures"
        )
        
        image_url = imagekit_result.get("url")
        print(f"✅ Signature uploaded: {image_url}")
        
        return {
            "url": image_url,
            "file_id": imagekit_result.get("file_id")
        }
        
    except Exception as e:
        print(f"❌ Signature upload error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Signature upload failed: {str(e)}")

@router.post("/save-with-signature")
async def save_scan_with_signature(
    file: UploadFile = File(...),
    recipient_name: str = "",
    signature_url: str = "",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Save scan to database with recipient name and signature"""
    import tempfile
    import traceback
    from services.imagekit_service import ImageKitService
    
    try:
        content = await file.read()
        
        # Upload to ImageKit
        imagekit_result = ImageKitService.upload_file(
            file=content,
            file_name=file.filename or "scan.jpg",
            folder="/scans"
        )
        image_url = imagekit_result.get("url")
        
        # Save temp file for OCR
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename or "")[1]) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # Process OCR
            ocr_result = await OCRService.process_image(tmp_path, use_ai_enhancement=True)
            extracted = ocr_result.get("enhanced_text") or ocr_result.get("raw_text") or "No text detected"
            
            # Create scan record in database
            new_scan = Scan(
                user_id=current_user.id,
                original_filename=file.filename,
                file_path=tmp_path,
                file_size=len(content),
                file_type=file.content_type,
                imagekit_url=image_url,
                recipient_name=recipient_name,
                signature_url=signature_url,
                extracted_text=extracted,
                confidence_score=ocr_result.get("confidence_score", 0),
                processing_time=ocr_result.get("processing_time", 0),
                status='completed'
            )
            
            db.add(new_scan)
            db.commit()
            db.refresh(new_scan)
            
            return {
                "id": new_scan.id,
                "file_path": image_url,
                "imagekit_url": image_url,
                "extracted_text": extracted,
                "recipient_name": recipient_name,
                "signature_url": signature_url,
                "status": "completed"
            }
        finally:
            try:
                os.unlink(tmp_path)
            except:
                pass
                
    except Exception as e:
        print(f"❌ Save scan error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Save failed: {str(e)}")

# --- GET SCANS TO BE DELETED (Weekly Cleanup Preview) ---
@router.get("/cleanup-preview")
async def get_cleanup_preview(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get list of scans that will be deleted in next weekly cleanup"""
    from datetime import datetime, timedelta
    
    try:
        # Get scans older than 7 days
        cutoff_date = datetime.now() - timedelta(days=7)
        
        old_scans = db.query(Scan).filter(
            Scan.user_id == current_user.id,
            Scan.created_at < cutoff_date
        ).all()
        
        # Also get ImageKit files to be deleted
        from utils.auth import supabase_admin
        old_files = supabase_admin.table("imagekit_files")\
            .select("*")\
            .eq("user_id", current_user.id)\
            .lt("created_at", cutoff_date.isoformat())\
            .execute()
        
        return {
            "scans_count": len(old_scans),
            "imagekit_count": len(old_files.data) if old_files.data else 0,
            "scans": [
                {
                    "id": scan.id,
                    "filename": scan.original_filename,
                    "created_at": scan.created_at.isoformat()
                }
                for scan in old_scans[:10]  # Preview first 10
            ],
            "next_cleanup": "Every Sunday 00:00 UTC"
        }
        
    except Exception as e:
        print(f"❌ Cleanup preview error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get cleanup preview")
