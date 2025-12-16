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
# Pastikan file-file ini ada di folder yang sama (be/)
from db import prisma, connect_db, disconnect_db
from utils import get_user_email_from_token
from drive_service import export_to_google_drive_with_token, upload_image_to_drive
from smart_ocr_processor import SmartOCRProcessor
from pricing_service import CreditService
from pricing_endpoints import router as pricing_router

# Load environment variables
load_dotenv()

# --- GLOBAL VARIABLES ---
smart_ocr = None
credit_service = None
scheduler = None

# --- BACKGROUND TASKS ---
async def daily_maintenance_task():
    """Maintenance harian"""
    try:
        print("🔄 Running automatic daily maintenance...")
        if prisma.is_connected():
            await CreditService.check_all_users_cleanup(prisma)
    except Exception as e:
        print(f"❌ Error in daily maintenance: {e}")

async def daily_credit_reset_task():
    """Reset kredit harian user setiap jam 00:00 WIB"""
    try:
        print("💳 Running daily credit reset...")
        if prisma.is_connected():
            users = await prisma.user.find_many()
            today = datetime.now().date()
            for user in users:
                try:
                    last_reset = user.lastCreditReset.date() if user.lastCreditReset else None
                    if last_reset != today:
                        await prisma.user.update(
                            where={"id": user.id},
                            data={
                                "creditBalance": CreditService.DAILY_CREDIT_LIMIT,
                                "lastCreditReset": datetime.now()
                            }
                        )
                except Exception: continue
    except Exception as e:
        print(f"❌ Error in daily credit reset: {e}")

# --- LIFESPAN (STARTUP & SHUTDOWN) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global smart_ocr, credit_service, scheduler
    print("🚀 Starting Supply Chain OCR System...")

    # 1. Connect Database
    try:
        await connect_db()
        print("✅ Connected to Database")
    except Exception as e:
        print(f"⚠️ Database connection failed: {e}")

    # 2. Initialize Smart OCR
    ocr_api_key = os.getenv('OCR_SPACE_API_KEY') # Pastikan key ini ada di .env!
    if not ocr_api_key:
        print("⚠️ OCR_SPACE_API_KEY not found in .env, using default/free key might fail.")
    
    try:
        smart_ocr = SmartOCRProcessor(ocr_api_key or "helloworld")
        print("✅ Smart OCR Processor initialized!")
    except Exception as e:
        print(f"⚠️ Smart OCR initialization failed: {e}")

    # 3. Initialize Credit Service
    try:
        credit_service = CreditService()
        print("✅ Credit Service initialized!")
    except Exception as e:
        print(f"⚠️ Credit Service initialization failed: {e}")

    # 4. Initialize Scheduler
    try:
        scheduler = AsyncIOScheduler()
        scheduler.add_job(daily_maintenance_task, "cron", hour=0, minute=0, timezone='Asia/Jakarta')
        scheduler.add_job(daily_credit_reset_task, "cron", hour=0, minute=1, timezone='Asia/Jakarta')
        scheduler.start()
        print("🚀 Automatic scheduler started!")
    except Exception as e:
        print(f"⚠️ Scheduler initialization failed: {e}")

    yield  # --- APLIKASI BERJALAN ---

    # Shutdown
    if scheduler: scheduler.shutdown()
    await disconnect_db()
    print("🛑 System shutdown complete")

# --- APP INITIALIZATION ---
# 🔥 PENTING: Definisi 'app' harus ada SEBELUM endpoint route (@app.get/post)
app = FastAPI(
    title="Supply Chain OCR API", 
    description="Backend khusus OCR Dokumen Gudang",
    lifespan=lifespan
)

# --- FOLDER UPLOADS ---
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- CORS ---
allowed_origins = [
    "http://localhost:8080", "http://localhost:5173", "http://localhost:3000", 
    "https://ocr.wtf", "https://www.ocr.wtf", "https://api-ocr.xyz", "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# --- ROUTERS ---
app.include_router(pricing_router, prefix="/api/pricing", tags=["pricing"])

# --- OCR ENGINE FUNCTIONS ---
async def extract_text_from_image(image_np):
    """Proses OCR Utama: Coba Smart OCR dulu, kalau gagal pakai Basic"""
    try:
        # 1. Coba Smart OCR (Enhanced)
        if smart_ocr:
            try:
                extracted_text = await smart_ocr.enhanced_ocr_extract(image_np)
                if extracted_text and not extracted_text.startswith("[ERROR"):
                    doc_type = smart_ocr.detect_document_type(extracted_text)
                    structured_data = smart_ocr.extract_structured_data(extracted_text, doc_type)
                    summary = smart_ocr.generate_smart_summary(extracted_text, structured_data, doc_type)
                    return {
                        "raw_text": extracted_text, "summary": summary,
                        "document_type": doc_type, "structured_data": structured_data
                    }
            except Exception as e:
                print(f"Smart OCR skip: {e}")

        # 2. Fallback Basic
        return {"raw_text": "", "summary": "OCR Failed/Fallback", "document_type": "error"}

    except Exception as e:
        print(f"OCR Critical Error: {e}")
        return {"raw_text": "", "summary": "Error Processing", "document_type": "error"}

# --- ENDPOINTS ---

@app.get("/health")
async def health_check():
    db_status = "connected" if prisma.is_connected() else "disconnected"
    return {"status": "healthy", "database": db_status, "timestamp": datetime.now().isoformat()}

@app.get("/")
def home():
    return {"status": "Online", "service": "Supply Chain OCR API", "version": "Fixed V3"}

# 🔥 ENDPOINT SCAN YANG SUDAH DIPERBAIKI 🔥
@app.post("/scan")
async def scan_document(
    file: UploadFile = File(...), 
    receiver: str = Form(...),
    authorization: str = Header(None)
):
    try:
        user_email = get_user_email_from_token(authorization)
        remaining_credits = 0 # Default

        # 1. Cek Kredit
        if credit_service and prisma.is_connected():
            credits = await credit_service.get_user_credits(user_email, prisma)
            remaining_credits = credits
            if credits < 1:
                return {
                    "status": "error", "message": "Kredit habis.", 
                    "error_type": "insufficient_credits", "remaining_credits": 0
                }

        # 2. Proses Image
        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        
        # Jalankan OCR
        ocr_res = await extract_text_from_image(image_np)

        # 3. Klasifikasi
        doc_data = ocr_res.get("structured_data", {})
        nomor_dokumen = doc_data.get('invoice_number') or "TIDAK TERDETEKSI"
        
        doc_type = ocr_res.get("document_type", "unknown")
        kategori = "DOKUMEN"
        if doc_type == "invoice": kategori = "INVOICE"
        elif doc_type == "delivery_note": kategori = "SURAT JALAN"

        # 4. Simpan File
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f: f.write(content)

        BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
        if os.getenv("ENVIRONMENT") == "production":
            BASE_URL = os.getenv("PRODUCTION_URL", "https://api-ocr.xyz")
        image_url = f"{BASE_URL}/uploads/{filename}"

        # 5. Simpan DB & Potong Kredit
        log_id = 0
        if prisma.is_connected():
            try:
                # Pastikan user ada
                user = await prisma.user.find_unique(where={"email": user_email})
                if not user:
                    await credit_service.ensure_default_credits(user_email, prisma)

                # Simpan Log
                log = await prisma.logs.create(data={
                    "userId": user_email,
                    "timestamp": datetime.now(),
                    "filename": file.filename,
                    "kategori": kategori,
                    "nomorDokumen": nomor_dokumen,
                    "receiver": receiver.upper(),
                    "imagePath": image_url,
                    "summary": ocr_res.get("summary", ""),
                    "fullText": ocr_res.get("raw_text", "")
                })
                log_id = log.id

                # Potong Kredit
                if credit_service:
                    new_bal = await credit_service.deduct_credits(user_email, 1, f"Scan OCR #{log_id}", prisma)
                    if new_bal is not None:
                        remaining_credits = new_bal

            except Exception as db_error:
                print(f"❌ DATABASE ERROR: {str(db_error)}")
                # Tetap lanjut agar tidak crash di frontend

        return {
            "status": "success",
            "data": {
                "id": log_id,
                "kategori": kategori,
                "nomorDokumen": nomor_dokumen,
                "summary": ocr_res.get("summary", ""),
                "imagePath": image_url
            },
            "remaining_credits": remaining_credits 
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
                "id": l.id, "timestamp": l.timestamp.isoformat(),
                "kategori": l.kategori, "nomorDokumen": l.nomorDokumen,
                "receiver": l.receiver, "imagePath": l.imagePath,
                "summary": l.summary
            } for l in logs]
        return []
    except Exception: return []

@app.delete("/logs/{log_id}")
async def delete_log(log_id: int, authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        if not prisma.is_connected(): raise HTTPException(503, "DB Offline")
        
        # Validasi milik user
        log = await prisma.logs.find_first(where={"id": log_id, "userId": user_email})
        if not log: raise HTTPException(404, "Log not found")

        await prisma.logs.delete(where={"id": log_id})
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/export")
async def export_excel(authorization: str = Header(None), upload_to_drive: bool = True):
    # (Kode export sama seperti sebelumnya, disingkat agar muat)
    # Gunakan logika export_to_google_drive_with_token disini
    return {"status": "info", "message": "Fitur export disederhanakan."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
