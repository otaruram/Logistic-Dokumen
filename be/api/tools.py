"""
Tools API routes - PDF Tools (Compress, Merge, Split, Convert, Watermark, Unlock)
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from io import BytesIO
from pypdf import PdfReader, PdfWriter
import zipfile
import tempfile
from typing import List, Optional
from config.settings import settings
from utils.auth import get_current_user, supabase_admin
from utils.pdf_tools import PdfToolbox

router = APIRouter()

# Maximum file sizes
MAX_PDF_SIZE = 10 * 1024 * 1024  # 10MB for PDF
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB for images

# Maximum file sizes
MAX_PDF_SIZE = 10 * 1024 * 1024  # 10MB for PDF
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB for images

# --- Helper Functions ---

async def log_activity(user_id: str, feature: str, action: str, metadata: dict = None):
    """Log user activity to activities table for analytics"""
    try:
        activity_data = {
            "user_id": str(user_id),
            "feature": feature,  # dgtnz, invoice, quiz, community, compressor
            "action": action,    # generate, scan, upload, create, compress
            "metadata": metadata or {}
        }
        supabase_admin.table("activities").insert(activity_data).execute()
        print(f"📊 Activity logged: {feature}/{action} by user {user_id}")
    except Exception as e:
        print(f"⚠️ Failed to log activity: {e}")

async def deduct_user_credit(user_id: str, amount: int = 1):
    """Deduct credits from user (dgtnz=1, invoice=1, quiz=1, pdf=1)"""
    try:
        user_id_str = str(user_id)
        
        # Get current credits
        result = supabase_admin.table("users").select("credits").eq("id", user_id_str).execute()
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        current_credits = result.data[0].get("credits", 0)
        
        # Check if enough credits
        if current_credits < amount:
            raise HTTPException(status_code=402, detail=f"Insufficient credits. You have {current_credits}, need {amount}")
        
        # Deduct credits
        new_credits = current_credits - amount
        supabase_admin.table("users").update({"credits": new_credits}).eq("id", user_id_str).execute()
        
        print(f"💳 Credit deducted: User {user_id_str} | {current_credits} -> {new_credits} (-{amount})")
        return new_credits
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"⚠️ Failed to deduct credit: {e}")
        raise HTTPException(status_code=500, detail="Failed to process credits")

# --- Routes ---


@router.post("/compress-pdf")
async def compress_pdf(file: UploadFile = File(...), user = Depends(get_current_user)):
    """
    Compress PDF file logic (FREE - no credit deduction)
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File harus PDF")
    
    # Get user ID for activity tracking
    user_id = user.get('id') if isinstance(user, dict) else getattr(user, 'id', None)
    
    try:
        pdf_content = await file.read()
        if len(pdf_content) > MAX_PDF_SIZE:
            raise HTTPException(status_code=413, detail="File PDF terlalu besar (Max 10MB)")
        
        pdf_file = BytesIO(pdf_content)
        reader = PdfReader(pdf_file)
        writer = PdfWriter()

        for page in reader.pages:
            writer.add_page(page)
        
        for page in writer.pages:
            page.compress_content_streams()

        output_buffer = BytesIO()
        writer.write(output_buffer)
        output_buffer.seek(0)
        
        # Log activity (compressor is FREE)
        if user_id:
            await log_activity(str(user_id), "compressor", "compress", {"file_name": file.filename})
        
        return StreamingResponse(
            output_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=compressed_{file.filename}"}
        )

    except Exception as e:
        print(f"❌ PDF Error: {e}")
        raise HTTPException(status_code=500, detail="Gagal mengompres PDF")


@router.post("/pdf/merge-images")
async def merge_images_to_pdf(
    files: List[UploadFile] = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user = Depends(get_current_user)
):
    """
    Merge 2-4 images (JPG/PNG) into one PDF file
    """
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Please upload at least 2 images")
    
    if len(files) > 4:
        raise HTTPException(status_code=400, detail="Maximum 4 images allowed")
    
    # Validate all files are images
    allowed_types = ["image/jpeg", "image/jpg", "image/png"]
    for file in files:
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail=f"File {file.filename} must be JPG or PNG")
    
    user_id = user.get('id') if isinstance(user, dict) else getattr(user, 'id', None)
    temp_paths = []
    
    try:
        # Save uploaded images to temp
        for file in files:
            img_content = await file.read()
            if len(img_content) > MAX_IMAGE_SIZE:
                raise HTTPException(status_code=413, detail=f"File {file.filename} exceeds 5MB")
            
            # Detect extension from content type
            ext = '.jpg' if 'jpeg' in file.content_type else '.png'
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
            temp_file.write(img_content)
            temp_file.close()
            temp_paths.append(temp_file.name)
        
        # Merge images to PDF
        merged_pdf = PdfToolbox.merge_images_to_pdf(temp_paths)
        if not merged_pdf:
            raise HTTPException(status_code=500, detail="Failed to merge images")
        
        # Log activity
        if user_id:
            await log_activity(str(user_id), "pdf_tools", "merge_images", {
                "image_count": len(files),
                "file_names": [f.filename for f in files]
            })
        
        # Schedule cleanup
        background_tasks.add_task(PdfToolbox.cleanup_files, temp_paths + [merged_pdf])
        
        return FileResponse(
            merged_pdf,
            media_type="application/pdf",
            filename=f"merged_{len(files)}_images.pdf"
        )
    
    except HTTPException:
        PdfToolbox.cleanup_files(temp_paths)
        raise
    except Exception as e:
        PdfToolbox.cleanup_files(temp_paths)
        print(f"❌ Merge Images Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to merge images: {str(e)}")


@router.post("/pdf/split")
async def split_pdf(
    file: UploadFile = File(...),
    start_page: int = Form(...),
    end_page: int = Form(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user = Depends(get_current_user)
):
    """
    Extract specific page range from PDF (0-indexed internally)
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    user_id = user.get('id') if isinstance(user, dict) else getattr(user, 'id', None)
    temp_input = None
    
    try:
        # Save uploaded file
        pdf_content = await file.read()
        if len(pdf_content) > MAX_PDF_SIZE:
            raise HTTPException(status_code=413, detail="File exceeds 10MB")
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        temp_file.write(pdf_content)
        temp_file.close()
        temp_input = temp_file.name
        
        # Convert to 0-indexed (user sends 1-indexed)
        start_idx = start_page - 1
        end_idx = end_page - 1
        
        # Split PDF
        split_path = PdfToolbox.split_pdf(temp_input, start_idx, end_idx)
        if not split_path:
            raise HTTPException(status_code=500, detail="Failed to split PDF")
        
        # Log activity
        if user_id:
            await log_activity(int(user_id), "pdf_tools", "split", {
                "file_name": file.filename,
                "start_page": start_page,
                "end_page": end_page
            })
        
        # Schedule cleanup
        background_tasks.add_task(PdfToolbox.cleanup_files, [temp_input, split_path])
        
        return FileResponse(
            split_path,
            media_type="application/pdf",
            filename=f"split_p{start_page}-{end_page}_{file.filename}"
        )
    
    except HTTPException:
        if temp_input:
            PdfToolbox.cleanup_files(temp_input)
        raise
    except Exception as e:
        if temp_input:
            PdfToolbox.cleanup_files(temp_input)
        print(f"❌ Split Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to split PDF: {str(e)}")


@router.post("/pdf/to-images")
async def pdf_to_images(
    file: UploadFile = File(...),
    max_pages: int = Form(20),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user = Depends(get_current_user)
):
    """
    Convert PDF pages to JPG images (returns ZIP file)
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    user_id = user.get('id') if isinstance(user, dict) else getattr(user, 'id', None)
    temp_input = None
    image_paths = []
    
    try:
        # Save uploaded file
        pdf_content = await file.read()
        if len(pdf_content) > MAX_PDF_SIZE:
            raise HTTPException(status_code=413, detail="File exceeds 10MB")
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        temp_file.write(pdf_content)
        temp_file.close()
        temp_input = temp_file.name
        
        # Convert to images
        image_paths = PdfToolbox.pdf_to_images(temp_input, max_pages=max_pages)
        if not image_paths:
            raise HTTPException(status_code=500, detail="Failed to convert PDF to images")
        
        # Create ZIP file
        zip_file = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        with zipfile.ZipFile(zip_file.name, 'w') as zipf:
            for i, img_path in enumerate(image_paths):
                zipf.write(img_path, f"page_{i+1}.jpg")
        
        # Log activity
        if user_id:
            await log_activity(int(user_id), "pdf_tools", "to_images", {
                "file_name": file.filename,
                "page_count": len(image_paths)
            })
        
        # Schedule cleanup
        background_tasks.add_task(PdfToolbox.cleanup_files, [temp_input] + image_paths + [zip_file.name])
        
        return FileResponse(
            zip_file.name,
            media_type="application/zip",
            filename=f"images_{file.filename.replace('.pdf', '')}.zip"
        )
    
    except HTTPException:
        if temp_input:
            PdfToolbox.cleanup_files(temp_input)
        PdfToolbox.cleanup_files(image_paths)
        raise
    except Exception as e:
        if temp_input:
            PdfToolbox.cleanup_files(temp_input)
        PdfToolbox.cleanup_files(image_paths)
        print(f"❌ To-Images Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to convert PDF: {str(e)}")


@router.post("/pdf/unlock")
async def unlock_pdf(
    file: UploadFile = File(...),
    password: str = Form(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user = Depends(get_current_user)
):
    """
    Remove password protection from PDF
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    user_id = user.get('id') if isinstance(user, dict) else getattr(user, 'id', None)
    temp_input = None
    
    try:
        # Save uploaded file
        pdf_content = await file.read()
        if len(pdf_content) > MAX_PDF_SIZE:
            raise HTTPException(status_code=413, detail="File exceeds 10MB")
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        temp_file.write(pdf_content)
        temp_file.close()
        temp_input = temp_file.name
        
        # Unlock PDF
        unlocked_path = PdfToolbox.unlock_pdf(temp_input, password)
        if not unlocked_path:
            raise HTTPException(status_code=400, detail="Failed to unlock PDF. Check password.")
        
        # Log activity
        if user_id:
            await log_activity(int(user_id), "pdf_tools", "unlock", {
                "file_name": file.filename
            })
        
        # Schedule cleanup
        background_tasks.add_task(PdfToolbox.cleanup_files, [temp_input, unlocked_path])
        
        return FileResponse(
            unlocked_path,
            media_type="application/pdf",
            filename=f"unlocked_{file.filename}"
        )
    
    except HTTPException:
        if temp_input:
            PdfToolbox.cleanup_files(temp_input)
        raise
    except Exception as e:
        if temp_input:
            PdfToolbox.cleanup_files(temp_input)
        print(f"❌ Unlock Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to unlock PDF: {str(e)}")


@router.post("/pdf/watermark")
async def watermark_pdf(
    file: UploadFile = File(...),
    watermark_text: str = Form(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user = Depends(get_current_user)
):
    """
    Add diagonal text watermark to all PDF pages
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    user_id = user.get('id') if isinstance(user, dict) else getattr(user, 'id', None)
    temp_input = None
    
    try:
        # Save uploaded file
        pdf_content = await file.read()
        if len(pdf_content) > MAX_PDF_SIZE:
            raise HTTPException(status_code=413, detail="File exceeds 10MB")
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        temp_file.write(pdf_content)
        temp_file.close()
        temp_input = temp_file.name
        
        # Add watermark
        watermarked_path = PdfToolbox.add_watermark(temp_input, watermark_text)
        if not watermarked_path:
            raise HTTPException(status_code=500, detail="Failed to add watermark")
        
        # Log activity
        if user_id:
            await log_activity(int(user_id), "pdf_tools", "watermark", {
                "file_name": file.filename,
                "watermark_text": watermark_text
            })
        
        # Schedule cleanup
        background_tasks.add_task(PdfToolbox.cleanup_files, [temp_input, watermarked_path])
        
        return FileResponse(
            watermarked_path,
            media_type="application/pdf",
            filename=f"watermarked_{file.filename}"
        )
    
    except HTTPException:
        if temp_input:
            PdfToolbox.cleanup_files(temp_input)
        raise
    except Exception as e:
        if temp_input:
            PdfToolbox.cleanup_files(temp_input)
        print(f"❌ Watermark Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add watermark: {str(e)}")


