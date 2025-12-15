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

# --- MODULE LOKAL (HASIL REFACTOR) ---
from db import prisma, connect_db, disconnect_db  # Koneksi Database Terpusat
from utils import get_user_email_from_token       # Auth Utilities
from drive_service import export_to_google_drive_with_token, upload_image_to_drive

# Import Core Services
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
    """Maintenance harian: Hapus data user yg udah lewat masa simpan"""
    try:
        print("🔄 Running automatic daily maintenance...")
        if prisma.is_connected():
            cleanup_count = await CreditService.check_all_users_cleanup(prisma)
            if cleanup_count > 0:
                print(f"🗑️ Automatic cleanup performed for {cleanup_count} users")
            else:
                print("✅ No users needed cleanup today")
    except Exception as e:
        print(f"❌ Error in daily maintenance: {e}")

async def daily_credit_reset_task():
    """Reset kredit harian user setiap jam 00:00 WIB"""
    try:
        print("💳 Running daily credit reset...")
        if prisma.is_connected():
            users = await prisma.user.find_many()
            reset_count = 0
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
                        # Log reset transaction
                        await prisma.credittransaction.create(
                            data={
                                "userId": user.id,
                                "amount": CreditService.DAILY_CREDIT_LIMIT,
                                "description": f"Daily credit reset - {today}"
                            }
                        )
                        reset_count += 1
                except Exception as e:
                    print(f"❌ Reset failed for user {user.id}: {e}")
                    continue
            print(f"✅ Daily credit reset completed! {reset_count} users updated")
    except Exception as e:
        print(f"❌ Error in daily credit reset: {e}")

# --- LIFESPAN (STARTUP & SHUTDOWN) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inisialisasi Database, OCR, dan Scheduler saat server nyala"""
    global smart_ocr, credit_service, scheduler

    print("🚀 Starting Supply Chain OCR System...")

    # 1. Connect Database
    try:
        await connect_db()
        print("✅ Connected to Database via db.py")
    except Exception as e:
        print(f"⚠️ Database connection failed: {e}")
        print("📝 System running in offline mode (No History Save)")

    # 2. Initialize Smart OCR
    ocr_api_key = os.getenv('OCR_SPACE_API_KEY', 'helloworld')
    try:
        smart_ocr = SmartOCRProcessor(ocr_api_key)
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
        # Jadwal Reset Kredit & Maintenance jam 00:00 WIB
        scheduler.add_job(daily_maintenance_task, "cron", hour=0, minute=0, timezone='Asia/Jakarta', id="daily_maintenance")
        scheduler.add_job(daily_credit_reset_task, "cron", hour=0, minute=1, timezone='Asia/Jakarta', id="daily_credit_reset")
        scheduler.start()
        print("🚀 Automatic scheduler started!")
    except Exception as e:
        print(f"⚠️ Scheduler initialization failed: {e}")

    yield  # --- APLIKASI BERJALAN DI SINI ---

    # Shutdown Process
    try:
        if scheduler: scheduler.shutdown()
        await disconnect_db()
        print("🔌 Database disconnected & Scheduler stopped")
    except Exception as e:
        print(f"Cleanup error: {e}")
    
    print("🛑 System shutdown complete")

# --- APP INITIALIZATION ---
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
    "http://localhost:8080", "http://localhost:8081", "http://localhost:5173",
    "http://localhost:3000", "https://ocr.wtf", "https://www.ocr.wtf",
    "https://api-ocr.xyz", "https://logistic-dokumen.onrender.com", "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# --- ROUTERS ---
# Include endpoint pricing (Topup, Paket, dll)
app.include_router(pricing_router, prefix="/api/pricing", tags=["pricing"])

# Import Cloudflare Service (Optional)
try:
    from cloudflare_service import cloudflare_service
    print("✅ Cloudflare service loaded")
except ImportError:
    print("⚠️ Cloudflare service not found")
    cloudflare_service = None

# --- CONSTANTS ---
OCR_API_URL = "https://api.ocr.space/parse/image"
OCR_API_KEY = os.getenv("OCR_API_KEY", "helloworld")

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
                        "raw_text": extracted_text,
                        "summary": summary,
                        "document_type": doc_type,
                        "structured_data": structured_data,
                        "method": "smart_ocr"
                    }
            except Exception as e:
                print(f"Smart OCR skip: {e}")

        # 2. Fallback ke Basic OCR
        return await basic_ocr_extract(image_np)

    except Exception as e:
        print(f"OCR Critical Error: {e}")
        return {"raw_text": "", "summary": "Error Processing", "document_type": "error", "method": "fail"}

async def basic_ocr_extract(image_np):
    """Fallback OCR biasa via OCR.space"""
    try:
        image = Image.fromarray(image_np)
        # Convert RGBA -> RGB
        if image.mode in ('RGBA', 'LA', 'P'):
            bg = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P': image = image.convert('RGBA')
            bg.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = bg

        # Resize for speed
        if image.width > 1024:
            ratio = 1024 / image.width
            image = image.resize((1024, int(image.height * ratio)), Image.Resampling.LANCZOS)

        img_byte = io.BytesIO()
        image.save(img_byte, format='JPEG', quality=85)
        b64_img = base64.b64encode(img_byte.getvalue()).decode('utf-8')

        payload = {
            'apikey': OCR_API_KEY,
            'base64Image': f'data:image/jpeg;base64,{b64_img}',
            'language': 'eng',
            'scale': True,
            'OCREngine': 1
        }
        res = requests.post(OCR_API_URL, data=payload, timeout=30)
        result = res.json()
        
        text = ""
        if result.get('ParsedResults'):
            text = result['ParsedResults'][0].get('ParsedText', '').strip()
        
        # Simple Summary Generator
        summary = text[:100].replace('\n', ' ') + "..." if len(text) > 10 else "Teks tidak terbaca"
        
        return {
            "raw_text": text,
            "summary": summary,
            "document_type": "unknown",
            "structured_data": {},
            "method": "basic_ocr"
        }
    except Exception as e:
        return {"raw_text": str(e), "summary": "OCR Failed", "document_type": "error", "method": "error"}

# --- MAIN ENDPOINTS ---

@app.get("/health")
async def health_check():
    """Cek kesehatan server & DB"""
    db_status = "connected" if prisma.is_connected() else "disconnected"
    return {"status": "healthy", "database": db_status, "timestamp": datetime.now().isoformat()}

@app.get("/")
def home():
    return {
        "status": "Online", 
        "service": "Supply Chain OCR API", 
        "version": "Refactored V2",
        "features": ["OCR", "Pricing", "Cloudflare", "Excel Export"]
    }

@app.post("/scan")
async def scan_document(
    file: UploadFile = File(...), 
    receiver: str = Form(...),
    authorization: str = Header(None)
):
    """Endpoint Utama: Upload -> Cek Kredit -> OCR -> Simpan DB"""
    try:
        user_email = get_user_email_from_token(authorization)
        
        # 1. Cek Kredit (Wajib ada saldo minimal 1)
        if credit_service and prisma.is_connected():
            await credit_service.ensure_default_credits(user_email, prisma)
            credits = await credit_service.get_user_credits(user_email, prisma)
            if credits < 1:
                return {"status": "error", "message": "Kredit habis. Silakan topup.", "error_type": "insufficient_credits"}

        # 2. Proses Image
        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        
        # 3. Jalankan OCR
        ocr_res = await extract_text_from_image(image_np)
        
        # 4. Klasifikasi Data
        doc_data = ocr_res.get("structured_data", {})
        nomor_dokumen = doc_data.get('invoice_number') or doc_data.get('do_number') or doc_data.get('po_number') or "TIDAK TERDETEKSI"
        
        doc_type = ocr_res.get("document_type", "unknown")
        kategori = "DOKUMEN LAIN"
        if doc_type == "invoice": kategori = "INVOICE"
        elif doc_type == "delivery_note": kategori = "SURAT JALAN"
        elif doc_type == "purchase_order": kategori = "PURCHASE ORDER"

        # 5. Simpan File Lokal
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f: f.write(content)
        
        # Generate URL
        BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
        if os.getenv("ENVIRONMENT") == "production":
            BASE_URL = os.getenv("PRODUCTION_URL", "https://api-ocr.xyz")
        image_url = f"{BASE_URL}/uploads/{filename}"

        # 6. Simpan ke Database
        log_id = 0
        if prisma.is_connected():
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

            # 7. Potong Kredit (Hanya jika sukses simpan DB)
            if credit_service:
                new_balance = await credit_service.deduct_credits(user_email, 1, f"Scan OCR #{log_id}", prisma)
                remaining = new_balance if new_balance is not None else credits
        else:
            remaining = 99 # Mode offline/tanpa DB

        return {
            "status": "success",
            "data": {
                "id": log_id,
                "kategori": kategori,
                "nomorDokumen": nomor_dokumen,
                "summary": ocr_res.get("summary", ""),
                "imagePath": image_url
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
            logs = await prisma.logs.find_many(
                where={"userId": user_email}, 
                order={"id": "desc"}
            )
            # Format output
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
    except Exception as e: return []

@app.delete("/logs/{log_id}")
async def delete_log(log_id: int, authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        if not prisma.is_connected(): raise HTTPException(503, "DB Offline")

        log = await prisma.logs.find_first(where={"id": log_id, "userId": user_email})
        if not log: raise HTTPException(404, "Log not found")

        # Hapus file fisik
        if log.imagePath:
            fname = log.imagePath.split("/")[-1]
            lpath = os.path.join(UPLOAD_DIR, fname)
            if os.path.exists(lpath): os.remove(lpath)
        
        await prisma.logs.delete(where={"id": log_id})
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/export")
async def export_excel(authorization: str = Header(None), upload_to_drive: bool = True):
    try:
        user_email = get_user_email_from_token(authorization)
        token = authorization.replace("Bearer ", "")
        
        if not prisma.is_connected(): raise HTTPException(503, "DB Offline")
        logs = await prisma.logs.find_many(where={"userId": user_email}, order={"id": "desc"})

        # Upload images to drive if requested
        drive_links = {}
        if upload_to_drive and token:
            for l in logs:
                if l.imagePath:
                    fname = l.imagePath.split("/")[-1]
                    lpath = os.path.join(UPLOAD_DIR, fname)
                    if os.path.exists(lpath):
                        res = upload_image_to_drive(token, lpath, "LOGISTIC Images")
                        if res: drive_links[l.id] = res['direct_link']

        data = [{
            "Tanggal": l.timestamp.replace(tzinfo=None),
            "Kategori": l.kategori,
            "Nomor Dokumen": l.nomorDokumen,
            "Penerima": l.receiver,
            "Ringkasan": l.summary,
            "Link Foto": drive_links.get(l.id, l.imagePath)
        } for l in logs]

        df = pd.DataFrame(data)
        filename = f"Laporan_{user_email.split('@')[0]}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        df.to_excel(filename, index=False)

        # Upload Excel ke Drive
        if upload_to_drive and token:
            with open(filename, 'rb') as f: content = f.read()
            drive_res = export_to_google_drive_with_token(token, content, filename)
            return {
                "status": "success", 
                "drive_url": drive_res['web_view_link'], 
                "download_url": f"/download/{filename}"
            }
        
        return FileResponse(filename, filename=filename)
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/download/{filename}")
async def download_file(filename: str):
    path = os.path.join(os.getcwd(), filename)
    if os.path.exists(path): return FileResponse(path, filename=filename)
    raise HTTPException(404, "File not found")

# --- ADMIN ENDPOINTS (Maintenance Only) ---
class ResetRequest(BaseModel):
    admin_password: str

@app.post("/admin/reset-database")
async def admin_reset_database(request: ResetRequest):
    if request.admin_password != os.getenv("ADMIN_PASSWORD", "supply2024reset"):
        raise HTTPException(403, "Invalid Password")
    
    if prisma.is_connected():
        await prisma.logs.delete_many()
        # Clean uploads folder
        for f in os.listdir(UPLOAD_DIR):
            os.remove(os.path.join(UPLOAD_DIR, f))
        return {"status": "success", "message": "System Reset Complete"}
    return {"status": "error", "message": "DB not connected"}

# --- CLOUDFLARE ENDPOINTS ---
@app.post("/api/cloudflare/upload")
async def upload_to_cloudflare(file: UploadFile = File(...), authorization: str = Header(None)):
    if not cloudflare_service: raise HTTPException(503, "Cloudflare Service Disabled")
    try:
        user_email = get_user_email_from_token(authorization) # Verify auth
        content = await file.read()
        return await cloudflare_service.upload_to_r2(content, file.filename)
    except Exception as e: raise HTTPException(500, str(e))

# ... Endpoint Cloudflare lainnya (setup-dns, purge-cache) bisa ditambahkan jika perlu,
# tapi yang utama adalah upload untuk CDN.

if __name__ == "__main__":
    import uvicorn
    # Jalankan server
    uvicorn.run(app, host="0.0.0.0", port=8000)
