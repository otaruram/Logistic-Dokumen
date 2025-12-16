from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import numpy as np
from PIL import Image
import io
import pandas as pd
from datetime import datetime
import os
import traceback
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler # Scheduler

# MODULE LOKAL
from db import prisma, connect_db, disconnect_db
from utils import get_user_email_from_token
from drive_service import export_to_google_drive_with_token, upload_image_to_drive
from smart_ocr_processor import SmartOCRProcessor
from pricing_service import CreditService
from pricing_endpoints import router as pricing_router

load_dotenv()
smart_ocr = None
credit_service = None
scheduler = None

# --- BACKGROUND TASK: RESET RATING BULANAN ---
async def monthly_rating_reset_task():
    """Hapus semua rating setiap tanggal 1 awal bulan"""
    try:
        print("🔄 Running Monthly Rating Reset...")
        if prisma.is_connected():
            await prisma.rating.delete_many()
            print("✅ All ratings reset for new month.")
    except Exception as e:
        print(f"❌ Error resetting ratings: {e}")

# --- LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting Server...")
    try:
        await connect_db() 
        print("✅ Database Connected")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")

    global smart_ocr, credit_service, scheduler
    smart_ocr = SmartOCRProcessor(os.getenv('OCR_SPACE_API_KEY', 'helloworld'))
    credit_service = CreditService()
    
    # Setup Scheduler
    scheduler = AsyncIOScheduler()
    # Reset rating setiap tanggal 1 jam 00:00
    scheduler.add_job(monthly_rating_reset_task, "cron", day=1, hour=0, minute=0, timezone='Asia/Jakarta')
    scheduler.start()
    
    yield
    
    if scheduler: scheduler.shutdown()
    await disconnect_db()
    print("🛑 Server Shutdown")

app = FastAPI(lifespan=lifespan)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pricing_router, prefix="/api/pricing")

# --- OCR HELPER ---
async def extract_text_from_image(image_np):
    try:
        if smart_ocr:
            text = await smart_ocr.enhanced_ocr_extract(image_np)
            if text and not text.startswith("[ERROR"):
                doc_type = smart_ocr.detect_document_type(text)
                structured = smart_ocr.extract_structured_data(text, doc_type)
                summary = smart_ocr.generate_smart_summary(text, structured, doc_type)
                return {"raw_text": text, "summary": summary, "document_type": doc_type, "structured_data": structured}
        return {"raw_text": "", "summary": "Gagal Baca Teks", "document_type": "error"}
    except Exception as e:
        return {"raw_text": str(e), "summary": "Error Sistem", "document_type": "error"}

# --- MODEL RATING ---
class RatingRequest(BaseModel):
    stars: int
    emoji: str
    message: str
    userName: str
    userAvatar: str

# --- ENDPOINTS ---

@app.get("/health")
def health(): return {"status": "ok", "db": prisma.is_connected()}

# --- RATING ENDPOINTS (BARU) ---
@app.post("/rating")
async def create_rating(data: RatingRequest, authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        if not prisma.is_connected(): await connect_db()
        
        # Simpan Rating
        await prisma.rating.create(data={
            "userId": user_email,
            "userName": data.userName,
            "userAvatar": data.userAvatar,
            "stars": data.stars,
            "emoji": data.emoji,
            "message": data.message
        })
        return {"status": "success", "message": "Rating terkirim!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/ratings")
async def get_ratings():
    try:
        if not prisma.is_connected(): await connect_db()
        # Ambil 50 rating terbaru
        ratings = await prisma.rating.find_many(
            take=50,
            order={"createdAt": "desc"}
        )
        return {"status": "success", "data": ratings}
    except Exception as e:
        return {"status": "error", "data": []}

# ... (Endpoint /scan, /logs, /delete-account, /export TETAP SAMA seperti sebelumnya)
# ... Copy paste endpoint lama di sini ... 
# (Untuk menghemat tempat, saya asumsikan endpoint lama sudah ada di file kamu)

# --- Endpoint Delete Account (Wajib Ada) ---
@app.delete("/delete-account")
async def delete_account(authorization: str = Header(None)):
    # ... (Kode endpoint delete account yg sebelumnya) ...
    # Pastikan copy paste logic delete account disini
    try:
        user_email = get_user_email_from_token(authorization)
        if not prisma.is_connected(): await connect_db()
        user = await prisma.user.find_unique(where={"email": user_email})
        if not user: raise HTTPException(404, "User tidak ditemukan")
        
        # Hapus Rating juga
        await prisma.rating.delete_many(where={"userId": user_email})
        await prisma.credittransaction.delete_many(where={"userId": user.id})
        await prisma.logs.delete_many(where={"userId": user_email})
        await prisma.user.delete(where={"id": user.id})
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

# --- Endpoint Scan (Wajib Ada) ---
@app.post("/scan")
async def scan_document(file: UploadFile = File(...), receiver: str = Form(...), authorization: str = Header(None)):
    # ... (Kode endpoint scan yg sebelumnya) ...
    return {"status": "error", "message": "Endpoint scan harus di-copy dari kode sebelumnya"}

# ... (Endpoint lain: update log, delete log, export) ...

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
