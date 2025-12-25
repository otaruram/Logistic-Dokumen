"""
Upload API routes for invoice images
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.imagekit_service import ImageKitService

router = APIRouter(prefix="/api", tags=["upload"])

@router.post("/upload-invoice")
async def upload_invoice(file: UploadFile = File(...)):
    """
    Upload invoice image to ImageKit
    """
    try:
        # Read file content
        content = await file.read()
        
        # Upload to ImageKit
        imagekit = ImageKitService()
        result = imagekit.upload_file(
            file=content,
            file_name=file.filename or "invoice.png",
            folder="/invoices"
        )
        
        return {
            "url": result.get("url"),
            "file_id": result.get("fileId"),
            "name": result.get("name")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-gdrive")
async def upload_to_gdrive(file: UploadFile = File(...)):
    """
    Upload Excel file to ImageKit (serves as shareable cloud storage alternative to GDrive)
    """
    try:
        # Read file content
        content = await file.read()
        
        # Upload to ImageKit
        imagekit = ImageKitService()
        result = imagekit.upload_file(
            file=content,
            file_name=file.filename or "scan-export.xlsx",
            folder="/exports"
        )
        
        return {
            "url": result.get("url"),
            "file_id": result.get("fileId"),
            "name": result.get("name"),
            "message": "File uploaded successfully to cloud storage"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
