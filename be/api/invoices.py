"""
Invoices API routes - invoice.wtf functionality
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import json
import tempfile
import os
from datetime import datetime

from config.database import get_db
from models.models import User, Invoice, CreditHistory
from schemas.schemas import InvoiceCreate, InvoiceResponse
from utils.auth import get_current_active_user
from utils.invoice_utils import InvoiceFeatures

router = APIRouter()

INVOICE_COST = 2  # Credit cost per invoice

def generate_invoice_number() -> str:
    """Generate unique invoice number"""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    return f"INV-{timestamp}"

@router.post("/", response_model=InvoiceResponse, status_code=201)
async def create_invoice(
    invoice_data: InvoiceCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create new invoice"""
    
    # Check credits
    if current_user.credits < INVOICE_COST:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Required: {INVOICE_COST}, Available: {current_user.credits}"
        )
    
    # Calculate totals
    subtotal = sum(item.amount for item in invoice_data.items)
    total = subtotal + invoice_data.tax
    
    # Generate invoice number
    invoice_number = generate_invoice_number()
    
    # Create invoice
    new_invoice = Invoice(
        user_id=current_user.id,
        invoice_number=invoice_number,
        client_name=invoice_data.client_name,
        client_email=invoice_data.client_email,
        client_address=invoice_data.client_address,
        items=json.dumps([item.dict() for item in invoice_data.items]),
        subtotal=subtotal,
        tax=invoice_data.tax,
        total=total,
        issue_date=invoice_data.issue_date,
        due_date=invoice_data.due_date,
        status='draft'
    )
    
    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)
    
    # Deduct credits (1 credit for invoice creation)
    current_user.credits -= INVOICE_COST
    
    # Log credit usage
    credit_log = CreditHistory(
        user_id=current_user.id,
        amount=-INVOICE_COST,
        action='invoice',
        reference_id=new_invoice.id
    )
    db.add(credit_log)
    db.commit()
    
    # Log activity for analytics
    from api.tools import log_activity
    await log_activity(current_user.id, "invoice", "create", {
        "invoice_id": new_invoice.id,
        "invoice_number": invoice_number,
        "total": float(total)
    })
    
    return new_invoice

@router.get("/", response_model=List[InvoiceResponse])
async def get_user_invoices(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all invoices for current user"""
    invoices = db.query(Invoice).filter(
        Invoice.user_id == current_user.id
    ).order_by(
        Invoice.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return invoices

@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get specific invoice by ID"""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return invoice

@router.patch("/{invoice_id}/status")
async def update_invoice_status(
    invoice_id: int,
    status: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update invoice status"""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    valid_statuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled']
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    invoice.status = status
    db.commit()
    
    return {"message": f"Invoice status updated to {status}"}

@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete invoice"""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    db.delete(invoice)
    db.commit()
    
    return {"message": "Invoice deleted successfully"}

# ====== NEW FEATURES: TERBILANG, NPWP, RENAME, MERGE, PASSWORD ======

class TerbilangRequest(BaseModel):
    nominal: float

class TerbilangResponse(BaseModel):
    nominal: float
    terbilang: str

class NPWPRequest(BaseModel):
    npwp: str

class NPWPResponse(BaseModel):
    valid: bool
    clean_npwp: Optional[str] = None
    formatted: Optional[str] = None
    type: Optional[str] = None
    message: str

class FilenameRequest(BaseModel):
    vendor_name: str
    invoice_no: str
    extension: str = "pdf"

class FilenameResponse(BaseModel):
    filename: str

@router.post("/terbilang", response_model=TerbilangResponse)
async def convert_to_terbilang(
    request: TerbilangRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Convert nominal amount to Indonesian words (terbilang)"""
    terbilang_text = InvoiceFeatures.generate_terbilang(int(request.nominal))
    return {
        "nominal": request.nominal,
        "terbilang": terbilang_text
    }

@router.post("/validate-npwp", response_model=NPWPResponse)
async def validate_npwp(
    request: NPWPRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Validate NPWP format (15 or 16 digits with regulatory standard)"""
    is_valid, result = InvoiceFeatures.validate_npwp(request.npwp)
    
    if is_valid:
        return {
            "valid": True,
            "clean_npwp": result.get("clean", ""),
            "formatted": result.get("formatted", ""),
            "type": result.get("type", ""),
            "message": f"Valid {result.get('type', 'NPWP')}"
        }
    else:
        return {
            "valid": False,
            "clean_npwp": "",
            "message": result.get("message", "NPWP tidak valid")
        }

@router.post("/generate-filename", response_model=FilenameResponse)
async def generate_smart_filename(
    request: FilenameRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Generate standardized filename: YYYY-MM-vendor-name-INV001.pdf"""
    filename = InvoiceFeatures.generate_filename(
        request.vendor_name,
        request.invoice_no,
        request.extension
    )
    return {"filename": filename}

@router.post("/rename-pdf")
async def rename_pdf_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    vendor_name: str = None,
    invoice_no: str = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    Upload a PDF and rename it with smart filename format.
    Returns the renamed PDF file for download.
    """
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    
    try:
        # Validate file type
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Read file content
        content = await file.read()
        
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File exceeds 10MB limit")
        
        # Generate smart filename
        new_filename = InvoiceFeatures.generate_filename(
            vendor_name or "document",
            invoice_no or "001",
            "pdf"
        )
        
        # Save to temp file with new name
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        temp_file.write(content)
        temp_file.close()
        
        # Schedule cleanup after response
        background_tasks.add_task(InvoiceFeatures.cleanup_temp_file, temp_file.name)
        
        return FileResponse(
            path=temp_file.name,
            media_type="application/pdf",
            filename=new_filename
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/merge-pdfs")
async def merge_pdf_files(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    password: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    Merge multiple PDFs into one, optionally add password protection.
    Max 5MB per file to prevent server overload.
    """
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    temp_files = []
    
    try:
        # Validate and save uploaded files to temp
        for file in files:
            if file.content_type != "application/pdf":
                raise HTTPException(status_code=400, detail=f"{file.filename} is not a PDF")
            
            # Read file content
            content = await file.read()
            
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400, 
                    detail=f"{file.filename} exceeds 5MB limit"
                )
            
            # Save to temp file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            temp_file.write(content)
            temp_file.close()
            temp_files.append(temp_file.name)
        
        # Process merge & encryption
        output_path = InvoiceFeatures.process_pdf_bundle(temp_files, password)
        
        if not output_path:
            raise HTTPException(status_code=500, detail="Failed to process PDFs")
        
        # Generate output filename
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        output_filename = f"merged-invoice-{timestamp}.pdf"
        
        # Schedule cleanup after response is sent
        for temp_file in temp_files:
            background_tasks.add_task(InvoiceFeatures.cleanup_temp_file, temp_file)
        background_tasks.add_task(InvoiceFeatures.cleanup_temp_file, output_path)
        
        return FileResponse(
            path=output_path,
            media_type="application/pdf",
            filename=output_filename
        )
        
    except Exception as e:
        # Cleanup on error
        for temp_file in temp_files:
            InvoiceFeatures.cleanup_temp_file(temp_file)
        raise HTTPException(status_code=500, detail=str(e))
