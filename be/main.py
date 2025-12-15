# backend/main.py

# --- IMPORT LIBRARY ---
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List
import requests
import base64
import numpy as np
from PIL import Image
import io
import pandas as pd
from datetime import datetime
import os
import shutil
import jwt
import json
from dotenv import load_dotenv
import re
import traceback
import PyPDF2
import asyncio
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# --- MODULE LOKAL (REFACTORED) ---
from db import prisma, connect_db, disconnect_db  # <--- IMPORT DARI DB.PY
from utils import get_user_email_from_token       # <--- IMPORT DARI UTILS.PY
from oki_chatbot import OKiChatbot
from drive_service import export_to_google_drive_with_token, upload_image_to_drive

# Import smart OCR dan AI modules
from smart_ocr_processor import SmartOCRProcessor
from ai_text_summarizer import AITextSummarizer

# Import pricing system
from pricing_service import CreditService
from pricing_endpoints import router as pricing_router

# Load environment variables
load_dotenv()

# --- SUMOPOD CHATBOT CONFIGURATION ---
oki_bot = OKiChatbot(mode='sumopod_only')

# Initialize Global Variables
smart_ocr = None
ai_summarizer = None
credit_service = None
scheduler = None

async def daily_maintenance_task():
    """Automatic daily maintenance - runs every day at midnight"""
    try:
        print("🔄 Running automatic daily maintenance...")
        if prisma.is_connected():
            cleanup_count = await CreditService.check_all_users_cleanup(prisma)
            if cleanup_count > 0:
                print(f"🗑️ Automatic cleanup performed for {cleanup_count} users")
            else:
                print("✅ No users needed cleanup today")
        else:
            print("⚠️ Database not available for maintenance")
    except Exception as e:
        print(f"❌ Error in daily maintenance: {e}")

async def daily_credit_reset_task():
    """Reset credits for all users at midnight Jakarta time"""
    try:
        print("💳 Running daily credit reset...")
        if prisma.is_connected():
            from datetime import datetime, date
            users = await prisma.user.find_many()
            reset_count = 0
            for user in users:
                try:
                    today = date.today()
                    last_reset = user.lastCreditReset.date() if user.lastCreditReset else None
                    if last_reset != today:
                        await prisma.user.update(
                            where={"id": user.id},
                            data={
                                "creditBalance": CreditService.DAILY_CREDIT_LIMIT,
                                "lastCreditReset": datetime.now()
                            }
                        )
                        await prisma.credittransaction.create(
                            data={
                                "userId": user.id,
                                "amount": CreditService.DAILY_CREDIT_LIMIT,
                                "description": f"Daily credit reset - {today}"
                            }
                        )
                        reset_count += 1
                        print(f"💳 Credits reset for user: {user.email}")
                except Exception as e:
                    print(f"❌ Error resetting credits for user {user.id}: {e}")
                    continue
            print(f"✅ Daily credit reset completed! {reset_count} users updated")
        else:
            print("⚠️ Database not available for credit reset")
    except Exception as e:
        print(f"❌ Error in daily credit reset: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Smart OCR, AI components, and connect to database"""
    global smart_ocr, ai_summarizer, scheduler, credit_service

    print("🚀 Starting Enhanced OCR System...")

    # 1. Connect Database
    try:
        await connect_db()
        print("✅ Connected to Database via db.py!")
    except Exception as e:
        print(f"⚠️ Database connection attempt failed: {e}")
        print("📝 System will continue without database logging")

    # 2. Initialize Smart OCR
    ocr_api_key = os.getenv('OCR_SPACE_API_KEY', 'helloworld')
    try:
        smart_ocr = SmartOCRProcessor(ocr_api_key)
        print("✅ Smart OCR Processor initialized!")
    except Exception as e:
        print(f"⚠️ Smart OCR initialization failed: {e}")
        smart_ocr = None

    # 3. Initialize Credit Service
    try:
        credit_service = CreditService()
        print("✅ Credit Service initialized!")
    except Exception as e:
        print(f"⚠️ Credit Service initialization failed: {e}")
        credit_service = None

    # 4. Initialize Scheduler
    try:
        scheduler = AsyncIOScheduler()
        scheduler.add_job(daily_maintenance_task, "cron", hour=0, minute=0, timezone='Asia/Jakarta', id="daily_maintenance")
        scheduler.add_job(daily_credit_reset_task, "cron", hour=0, minute=1, timezone='Asia/Jakarta', id="daily_credit_reset")
        scheduler.start()
        print("🚀 Automatic scheduler started!")
    except Exception as e:
        print(f"⚠️ Scheduler initialization failed: {e}")

    # 5. AI Summarizer (Disabled/Legacy)
    print("ℹ️ SumoPod AI disabled - using rule-based summaries")
    ai_summarizer = None

    print("⚡ Enhanced OCR System ready!")
    
    yield  # --- APP RUNNING HERE ---

    # Shutdown Logic
    try:
        if scheduler:
            scheduler.shutdown()
            print("🛑 Scheduler shutdown completed")
    except Exception as e:
        print(f"⚠️ Scheduler shutdown error: {e}")

    try:
        await disconnect_db()
        print("🔌 Disconnected from database")
    except Exception as e:
        print(f"Cleanup error: {e}")
    
    print("🛑 Enhanced OCR System shutdown complete")

# --- INISIALISASI APP ---
app = FastAPI(
    title="Supply Chain OCR API", 
    description="Backend untuk scan dokumen gudang",
    lifespan=lifespan
)

# --- SETUP FOLDER UPLOADS ---
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- KONFIGURASI CORS ---
allowed_origins = [
    "http://localhost:8080", "http://localhost:8081", "http://localhost:5173",
    "http://localhost:3000", "http://127.0.0.1:3000", "http://127.0.0.1:5173",
    "http://127.0.0.1:8080", "https://ocrai.vercel.app", "https://ocr.wtf",
    "https://www.ocr.wtf", "https://api-ocr.xyz", "http://api-ocr.xyz",
    "https://files.ocr.wtf", "https://logistic-dokumen.onrender.com", "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include pricing endpoints
app.include_router(pricing_router, prefix="/api/pricing", tags=["pricing"])

# Import Cloudflare service
try:
    from cloudflare_service import cloudflare_service
    print("✅ Cloudflare service loaded successfully")
except ImportError as e:
    print(f"⚠️ Cloudflare service not available: {e}")
    cloudflare_service = None

# --- HELPER: OCR ENGINE (OCR.SPACE) ---
OCR_API_KEY = os.getenv("OCR_API_KEY", "helloworld") 
OCR_API_URL = "https://api.ocr.space/parse/image"

async def get_user_ocr_api_key_internal(email: str) -> str | None:
    """Internal helper to get user's OCR API key"""
    try:
        api_key_record = await prisma.apikey.find_first(
            where={"userId": email, "provider": "ocrspace"}
        )
        if api_key_record and api_key_record.isActive:
            return api_key_record.apiKey
        return None
    except Exception:
        return None

async def extract_text_from_image(image_np, user_email: str = None):
    """Enhanced OCR dengan Smart Processing dan AI Summarization"""
    try:
        print("Starting enhanced OCR processing...")
        api_key_to_use = OCR_API_KEY
        using_byok = False

        if user_email:
            user_ocr_key = await get_user_ocr_api_key_internal(user_email)
            if user_ocr_key:
                api_key_to_use = user_ocr_key
                using_byok = True
                print(f"BYOK OCR ENABLED - Using user's OCR API key for {user_email}")

        if smart_ocr and api_key_to_use != "helloworld":
            try:
                if using_byok:
                    user_smart_ocr = SmartOCRProcessor(api_key_to_use)
                    extracted_text = await user_smart_ocr.enhanced_ocr_extract(image_np)
                else:
                    extracted_text = await smart_ocr.enhanced_ocr_extract(image_np)

                if extracted_text and not extracted_text.startswith("[ERROR"):
                    doc_type = smart_ocr.detect_document_type(extracted_text)
                    structured_data = smart_ocr.extract_structured_data(extracted_text, doc_type)
                    smart_summary = await generate_smart_summary(extracted_text, doc_type, structured_data)

                    return {
                        "raw_text": extracted_text,
                        "summary": smart_summary,
                        "document_type": doc_type,
                        "structured_data": structured_data,
                        "processing_method": "smart_ocr",
                        "byok_used": using_byok
                    }
            except Exception as e:
                print(f"Smart OCR error: {e}, falling back to basic OCR")

        # Fallback to basic OCR
        basic_text = await basic_ocr_extract(image_np, api_key_to_use)
        if basic_text:
            return {
                "raw_text": basic_text,
                "summary": generate_basic_summary(basic_text),
                "document_type": "unknown",
                "structured_data": {},
                "processing_method": "basic_ocr",
                "byok_used": using_byok
            }
        else:
            return {
                "raw_text": "",
                "summary": "Tidak dapat mengekstrak teks",
                "document_type": "unknown",
                "structured_data": {},
                "processing_method": "failed",
                "byok_used": using_byok
            }
    except Exception as e:
        print(f"OCR processing error: {e}")
        return {"raw_text": f"[ERROR: {str(e)}]", "summary": "Error saat memproses gambar", "document_type": "error", "structured_data": {}, "processing_method": "error", "byok_used": False}

async def basic_ocr_extract(image_np, api_key: str):
    """Basic OCR fallback"""
    try:
        image = Image.fromarray(image_np)
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P': image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background

        max_width = 1024
        if image.width > max_width:
            ratio = max_width / image.width
            new_height = int(image.height * ratio)
            image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)

        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG', quality=85)
        base64_image = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')

        payload = {'apikey': api_key, 'base64Image': f'data:image/jpeg;base64,{base64_image}', 'language': 'eng', 'isOverlayRequired': False, 'scale': True, 'OCREngine': 1}
        response = requests.post(OCR_API_URL, data=payload, timeout=30)
        result = response.json()
        
        parsed_results = result.get('ParsedResults', [])
        return parsed_results[0].get('ParsedText', '').strip() if parsed_results else ""
    except Exception as e:
        print(f"Basic OCR failed: {e}")
        return f"[ERROR OCR: {str(e)}]"

async def generate_smart_summary(text: str, doc_type: str, structured_data: dict) -> str:
    if smart_ocr: return smart_ocr.generate_smart_summary(text, structured_data, doc_type)
    return generate_basic_summary(text)

def generate_basic_summary(text: str) -> str:
    if not text or text.startswith("[ERROR"): return "Tidak dapat membuat ringkasan"
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    for line in lines[:3]:
        if len(line) > 10 and not line.isdigit():
            return (line[:97] + "...") if len(line) > 100 else line
    return "Dokumen berhasil dipindai" if lines else "Tidak ada teks terdeteksi"

# --- ENDPOINTS ---

@app.get("/health")
async def health_check():
    return {"status": "healthy", "server": "VPS-Primary", "timestamp": datetime.now().isoformat()}

@app.get("/")
def home():
    return {"status": "Online", "backend": "FastAPI + Enhanced Smart OCR", "features": ["Smart Detection", "AI Summarization"], "smart_ocr": "✅ Active" if smart_ocr else "❌ Inactive"}

@app.post("/scan")
async def scan_document(
    file: UploadFile = File(...), receiver: str = Form(...), authorization: str = Header(None)
):
    global credit_service
    try:
        user_email = get_user_email_from_token(authorization)
        
        # Credit Check
        if credit_service:
            try:
                await credit_service.ensure_default_credits(user_email, prisma)
                user_credits = await credit_service.get_user_credits(user_email, prisma)
                if user_credits < 1:
                    return {"status": "error", "message": "Insufficient credits", "error_type": "insufficient_credits"}
            except Exception as e: print(f"Credit check error: {e}")

        # Process Image
        contents = await file.read()
        image_np = np.array(Image.open(io.BytesIO(contents)))
        ocr_result = await extract_text_from_image(image_np, user_email)

        full_text = ocr_result.get("raw_text", "")
        summary = ocr_result.get("summary", "")
        doc_type = ocr_result.get("document_type", "unknown")
        structured_data = ocr_result.get("structured_data", {})
        byok_used = ocr_result.get("byok_used", False)

        # Detect Metadata
        nomor_dokumen = structured_data.get('invoice_number') or structured_data.get('do_number') or structured_data.get('po_number') or "TIDAK TERDETEKSI"
        
        kategori = "DOKUMEN LAIN"
        if doc_type == "invoice": kategori = "INVOICE"
        elif doc_type == "delivery_note": kategori = "SURAT JALAN"
        elif doc_type == "purchase_order": kategori = "PURCHASE ORDER"

        # Save File
        saved_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        with open(os.path.join(UPLOAD_DIR, saved_filename), "wb") as buffer: buffer.write(contents)
        
        # Env Config
        ENVIRONMENT = os.getenv("ENVIRONMENT", "production")
        BASE_URL = os.getenv("BASE_URL", "http://localhost:8000") if ENVIRONMENT == "development" else os.getenv("PRODUCTION_URL", "https://logistic-dokumen.onrender.com")
        image_url = f"{BASE_URL}/uploads/{saved_filename}"

        # Save to DB
        log = None
        if prisma.is_connected():
            log = await prisma.logs.create(data={
                "userId": user_email, "timestamp": datetime.now(), "filename": file.filename,
                "kategori": kategori, "nomorDokumen": nomor_dokumen, "receiver": receiver.upper(),
                "imagePath": image_url, "summary": summary, "fullText": full_text
            })

        # Deduct Credit
        remaining_credits = 3
        if credit_service and not byok_used:
            deducted = await credit_service.deduct_credits(user_email, 1, f"OCR Scan {log.id if log else 'temp'}", prisma)
            if deducted is not None: remaining_credits = deducted
        elif byok_used and credit_service:
            remaining_credits = await credit_service.get_user_credits(user_email, prisma)

        return {
            "status": "success",
            "data": {
                "id": log.id if log else 0, "kategori": kategori, "nomorDokumen": nomor_dokumen,
                "summary": summary, "imagePath": image_url
            },
            "remaining_credits": remaining_credits
        }

    except Exception as e:
        print(f"Global Error: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}

@app.get("/history")
async def get_history(authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        if prisma.is_connected():
            logs = await prisma.logs.find_many(where={"userId": user_email}, order={"id": "desc"})
            return [{"id": l.id, "timestamp": l.timestamp.isoformat(), "kategori": l.kategori, "nomorDokumen": l.nomorDokumen, "receiver": l.receiver, "imagePath": l.imagePath, "summary": l.summary} for l in logs]
        return []
    except Exception as e: return []

@app.delete("/logs/{log_id}")
async def delete_log(log_id: int, authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        log = await prisma.logs.find_first(where={"id": log_id, "userId": user_email})
        if not log: raise HTTPException(status_code=404, detail="Log not found")
        
        if log.imagePath:
            local_path = os.path.join(UPLOAD_DIR, log.imagePath.split("/")[-1])
            if os.path.exists(local_path): os.remove(local_path)
            
        await prisma.logs.delete(where={"id": log_id})
        return {"status": "success"}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/export")
async def export_excel(authorization: str = Header(None), upload_to_drive: bool = True):
    try:
        user_email = get_user_email_from_token(authorization)
        token = authorization.replace("Bearer ", "")
        logs = await prisma.logs.find_many(where={"userId": user_email}, order={"id": "desc"})
        
        image_links = {}
        if upload_to_drive and token:
            for l in logs:
                if l.imagePath:
                    local_path = os.path.join(UPLOAD_DIR, l.imagePath.split("/")[-1])
                    if os.path.exists(local_path):
                        res = upload_image_to_drive(token, local_path, "LOGISTIC.AI Images")
                        if res: image_links[l.id] = res['direct_link']

        data = [{
            "Tanggal": l.timestamp.replace(tzinfo=None),
            "Kategori": l.kategori, "Nomor Dokumen": l.nomorDokumen, "Penerima": l.receiver,
            "Ringkasan": l.summary, "Link Foto": image_links.get(l.id, l.imagePath)
        } for l in logs]

        df = pd.DataFrame(data)
        filename = f"Laporan_{user_email.split('@')[0]}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        
        # Save Excel logic (Simplified for brevity - keep your original detailed logic here if needed)
        df.to_excel(filename, index=False)
        
        if upload_to_drive and token:
            with open(filename, 'rb') as f: content = f.read()
            drive_res = export_to_google_drive_with_token(token, content, filename)
            return {"status": "success", "drive_url": drive_res['web_view_link'], "download_url": f"/download/{filename}"}
            
        return FileResponse(filename, filename=filename)
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/download/{filename}")
async def download_file(filename: str):
    path = os.path.join(os.getcwd(), filename)
    if os.path.exists(path): return FileResponse(path, filename=filename)
    raise HTTPException(status_code=404)

@app.post("/api/chat")
async def chat_with_oki(request: BaseModel, authorization: str = Header(None)):
    # Chat logic placeholder - keep your existing implementation or import from oki_chatbot
    return {"status": "success", "message": "Chat module ready"}

# --- BYOK & API KEY ENDPOINTS ---
# (Pastikan logic API Key di sini menggunakan prisma dari db.py)
# ... Copy endpoint /api/user/apikey dari kode lamamu, tapi pastikan pakai `prisma` yang di-import dari db.py

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
