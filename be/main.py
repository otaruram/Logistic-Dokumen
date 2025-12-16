# backend/main.py

# --- IMPORT LIBRARY ---
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import requests
import base64
import numpy as np
from PIL import Image
import io
import pandas as pd
from datetime import datetime
import os
import shutil
import traceback
import asyncio
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv

# --- MODULE LOKAL ---
from db import prisma, connect_db, disconnect_db
from utils import get_user_email_from_token
from drive_service import export_to_google_drive_with_token, upload_image_to_drive
from smart_ocr_processor import SmartOCRProcessor
from pricing_service import CreditService
from pricing_endpoints import router as pricing_router

load_dotenv()

# --- GLOBAL VARIABLES ---
smart_ocr = None
credit_service = None
scheduler = None

# --- MODELS ---
class LogUpdate(BaseModel):
    summary: str

# --- LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global smart_ocr, credit_service, scheduler
    print("🚀 Starting Supply Chain OCR System...")

    try:
        await connect_db()
        print("✅ Connected to Database")
    except Exception as e:
        print(f"⚠️ Database connection failed: {e}")

    ocr_api_key = os.getenv('OCR_SPACE_API_KEY', 'helloworld')
    smart_ocr = SmartOCRProcessor(ocr_api_key)
    credit_service = CreditService()
    
    # Simple Scheduler (Optional)
    scheduler = AsyncIOScheduler()
    scheduler.start()
    
    yield
    
    if scheduler: scheduler.shutdown()
    await disconnect_db()
    print("🛑 System shutdown complete")

# --- APP INITIALIZATION ---
app = FastAPI(title="Supply Chain OCR API", lifespan=lifespan)
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for debugging, restrict in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pricing_router, prefix="/api/pricing", tags=["pricing"])

# --- OCR HELPERS ---
async def extract_text_from_image(image_np):
    """Wrapper untuk Smart OCR"""
    if smart_ocr:
        try:
            extracted_text = await smart_ocr.enhanced_ocr_extract(image_np)
            doc_type = smart_ocr.detect_document_type(extracted_text)
            structured_data = smart_ocr.extract_structured_data(extracted_text, doc_type)
            summary = smart_ocr.generate_smart_summary(extracted_text, structured_data, doc_type)
            return {
                "raw_text": extracted_text,
                "summary": summary,
                "document_type": doc_type,
                "structured_data": structured_data
            }
        except Exception as e:
            print(f"Smart OCR Error: {e}")
    return {"raw_text": "", "summary": "Error", "document_type": "unknown", "structured_data": {}}

# --- ENDPOINTS ---

@app.get("/")
def home():
    return {"status": "Online", "version": "Fixed V3 (Render)"}

@app.post("/scan")
async def scan_document(
    file: UploadFile = File(...), 
    receiver: str = Form(...),
    authorization: str = Header(None)
):
    """Endpoint Utama: Scan + Auto Upload Drive + Potong Kredit"""
    try:
        user_email = get_user_email_from_token(authorization)
        token = authorization.replace("Bearer ", "") if authorization else None

        # 1. Cek Kredit
        if credit_service and prisma.is_connected():
            credits = await credit_service.get_user_credits(user_email, prisma)
            if credits < 1:
                return {"status": "error", "message": "Kredit habis. Silakan topup.", "error_type": "insufficient_credits"}

        # 2. Proses Image
        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        ocr_res = await extract_text_from_image(image_np)

        # 3. Klasifikasi
        doc_data = ocr_res.get("structured_data", {})
        nomor_dokumen = doc_data.get('invoice_number') or doc_data.get('do_number') or "TIDAK TERDETEKSI"
        
        doc_type = ocr_res.get("document_type", "unknown")
        kategori = "DOKUMEN LAIN"
        if doc_type == "invoice": kategori = "INVOICE"
        elif doc_type == "delivery_note": kategori = "SURAT JALAN"
        elif doc_type == "purchase_order": kategori = "PURCHASE ORDER"

        # 4. Simpan File Lokal (Sementara)
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f: f.write(content)
        
        # Default path lokal
        image_path_db = f"/uploads/{filename}"

        # --- AUTO UPLOAD KE DRIVE (FIX) ---
        if token:
            print(f"🔄 Uploading {filename} to Drive...")
            try:
                drive_res = upload_image_to_drive(token, filepath, "LOGISTIC_SCANS")
                if drive_res and drive_res.get('direct_link'):
                    image_path_db = drive_res['direct_link']
                    print("✅ Uploaded to Drive successfully")
            except Exception as e:
                print(f"⚠️ Drive upload skipped: {e}")
        # ----------------------------------

        # 5. Simpan ke Database
        log_id = 0
        remaining = 99
        if prisma.is_connected():
            log = await prisma.logs.create(data={
                "userId": user_email,
                "timestamp": datetime.now(),
                "filename": file.filename,
                "kategori": kategori,
                "nomorDokumen": nomor_dokumen,
                "receiver": receiver.upper(),
                "imagePath": image_path_db, # Link Drive atau Lokal
                "summary": ocr_res.get("summary", ""),
                "fullText": ocr_res.get("raw_text", "")
            })
            log_id = log.id

            # 6. Potong Kredit
            if credit_service:
                new_balance = await credit_service.deduct_credits(user_email, 1, f"Scan OCR #{log_id}", prisma)
                if new_balance is not None:
                    remaining = new_balance
                else:
                    remaining = credits # Fallback
        
        return {
            "status": "success",
            "data": {
                "id": log_id,
                "kategori": kategori,
                "nomorDokumen": nomor_dokumen,
                "summary": ocr_res.get("summary", ""),
                "imagePath": image_path_db
            },
            "remaining_credits": remaining
        }

    except Exception as e:
        print(f"Scan Error: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}

@app.get("/history")
async def get_history(authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        if prisma.is_connected():
            logs = await prisma.logs.find_many(where={"userId": user_email}, order={"id": "desc"})
            return [{
                "id": l.id,
                "timestamp": l.timestamp.isoformat(),
                "kategori": l.kategori,
                "nomorDokumen": l.nomorDokumen,
                "receiver": l.receiver,
                "imagePath": l.imagePath,
                "summary": l.summary
            } for l in logs]
        return []
    except Exception: return []

# --- INI ENDPOINT 'PUT' YANG HILANG SEBELUMNYA (FIX ERROR 405) ---
@app.put("/logs/{log_id}")
async def update_log(log_id: int, log_data: LogUpdate, authorization: str = Header(None)):
    """Update Summary Log"""
    try:
        user_email = get_user_email_from_token(authorization)
        if not prisma.is_connected():
            raise HTTPException(503, "Database Offline")

        # Cek apakah log milik user
        existing = await prisma.logs.find_first(where={"id": log_id, "userId": user_email})
        if not existing:
            raise HTTPException(404, "Log not found")

        updated = await prisma.logs.update(
            where={"id": log_id},
            data={"summary": log_data.summary}
        )
        return {"status": "success", "data": updated}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.delete("/logs/{log_id}")
async def delete_log(log_id: int, authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        if not prisma.is_connected(): raise HTTPException(503, "DB Offline")

        log = await prisma.logs.find_first(where={"id": log_id, "userId": user_email})
        if not log: raise HTTPException(404, "Log not found")

        await prisma.logs.delete(where={"id": log_id})
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/export")
async def export_excel(authorization: str = Header(None), upload_to_drive: bool = True):
    try:
        user_email = get_user_email_from_token(authorization)
        token = authorization.replace("Bearer ", "") if authorization else None
        
        if not prisma.is_connected(): raise HTTPException(503, "DB Offline")
        logs = await prisma.logs.find_many(where={"userId": user_email}, order={"id": "desc"})

        data = [{
            "Tanggal": l.timestamp.replace(tzinfo=None),
            "Kategori": l.kategori,
            "Nomor Dokumen": l.nomorDokumen,
            "Penerima": l.receiver,
            "Ringkasan": l.summary,
            "Link Foto": l.imagePath
        } for l in logs]

        df = pd.DataFrame(data)
        filename = f"Laporan_{user_email.split('@')[0]}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        df.to_excel(filename, index=False)

        if upload_to_drive and token:
            with open(filename, 'rb') as f: content = f.read()
            drive_res = export_to_google_drive_with_token(token, content, filename)
            return {
                "status": "success", 
                "drive_url": drive_res.get('web_view_link', '#'), 
                "download_url": f"/download/{filename}"
            }

        return FileResponse(filename, filename=filename)
    except Exception as e: return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
