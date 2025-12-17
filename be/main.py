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
import requests
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Import module sendiri
from db import prisma, connect_db, disconnect_db
from utils import get_user_email_from_token
from drive_service import export_to_google_drive_with_token
from smart_ocr_processor import SmartOCRProcessor
from pricing_service import CreditService

load_dotenv()

# Global Variables
smart_ocr = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Server Starting...")
    await connect_db()
    
    global smart_ocr
    try:
        # Inisialisasi OCR Engine
        smart_ocr = SmartOCRProcessor(os.getenv('OCR_SPACE_API_KEY', 'helloworld'))
        print("✅ OCR Engine Ready")
    except Exception as e:
        print(f"⚠️ OCR Init Warning: {e}")
        
    yield
    print("🛑 Server Shutting Down...")
    await disconnect_db()

app = FastAPI(lifespan=lifespan)

# Setup Upload Folder
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# CORS Setup (PENTING: Ganti allow_origins dengan domain frontendmu saat production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Ganti ["https://vibely-frontend.onrender.com"] biar aman
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- HELPER FUNCTIONS ---
def get_user_email_hybrid(authorization: str):
    """Helper biar gak nulis try-except token berulang-ulang"""
    if not authorization: return None
    try:
        return get_user_email_from_token(authorization)
    except:
        # Fallback manual request ke Google jika utils gagal
        token = authorization.replace("Bearer ", "").strip()
        try:
            res = requests.get('https://www.googleapis.com/oauth2/v3/userinfo', 
                             headers={'Authorization': f'Bearer {token}'}, timeout=3)
            if res.status_code == 200: return res.json().get('email')
        except: pass
    return None

async def extract_text_from_image(image_np):
    """Wrapper untuk OCR"""
    try:
        if smart_ocr:
            text = await smart_ocr.enhanced_ocr_extract(image_np)
            if text and not text.startswith("[ERROR"):
                doc_type = smart_ocr.detect_document_type(text)
                structured = smart_ocr.extract_structured_data(text, doc_type)
                summary = smart_ocr.generate_smart_summary(text, structured, doc_type)
                return {"raw_text": text, "summary": summary, "document_type": doc_type, "structured_data": structured}
    except Exception as e:
        print(f"OCR Error: {e}")
    return {"raw_text": "", "summary": "Gagal Baca / Error", "document_type": "error"}

# --- ENDPOINTS ---

@app.get("/health")
def health(): return {"status": "ok", "env": os.getenv("ENVIRONMENT", "dev")}

@app.get("/me")
async def get_my_profile(authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: return {"status": "error", "message": "Invalid Token"}

        # 🔥 PANGGIL SERVICE: Auto-check reset credit pas user buka profile
        await CreditService.ensure_daily_credits(user_email, prisma)

        user = await prisma.user.find_unique(where={"email": user_email})
        
        # Handle User Baru (First Login)
        if not user:
            user = await prisma.user.create(data={
                "email": user_email, 
                "creditBalance": 3,
                "tier": "free",
                "createdAt": datetime.now(),
                "lastCreditReset": datetime.now()
            })

        # Hitung Info Reset (untuk Frontend)
        return {
            "status": "success", 
            "data": {
                "email": user.email,
                "tier": getattr(user, 'tier', 'free'),
                "creditBalance": user.creditBalance,
                "resetInfo": { "nextReset": "Tomorrow 00:00" } 
            }
        }
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/scan")
async def scan_document(file: UploadFile = File(...), receiver: str = Form(...), authorization: str = Header(None)):
    try:
        # 1. Auth Check
        user_email = get_user_email_hybrid(authorization)
        if not user_email: return {"status": "error", "message": "Login diperlukan"}

        # 2. Credit Check & Deduct (Atomic)
        # Service ini mengembalikan False jika saldo < 1
        success_deduct = await CreditService.deduct_credit(user_email, prisma)
        
        if not success_deduct:
            return {
                "status": "error", 
                "error_type": "insufficient_credits", 
                "message": "Kredit habis. Tunggu besok ya!", 
                "remaining_credits": 0
            }

        # 3. Process Image
        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        
        # Save File
        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
        filename = f"{timestamp_str}_{clean_name}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f: f.write(content)

        # Generate URL
        # Ganti BASE_URL sesuai domain VPS nanti
        BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
        image_url = f"{BASE_URL}/uploads/{filename}"

        # 4. OCR Process
        ocr_res = await extract_text_from_image(image_np)
        
        # 5. Save Log to DB
        doc_data = ocr_res.get("structured_data", {})
        nomor_dokumen = doc_data.get('invoice_number') or doc_data.get('do_number') or "MANUAL CHECK"
        
        log = await prisma.logs.create(data={
            "userId": user_email, 
            "timestamp": datetime.now(), 
            "filename": file.filename, 
            "kategori": ocr_res.get("document_type", "unknown").upper(), 
            "nomorDokumen": nomor_dokumen, 
            "receiver": receiver.upper(), 
            "imagePath": image_url, 
            "summary": ocr_res.get("summary", ""), 
            "fullText": ocr_res.get("raw_text", "")
        })

        # Ambil sisa kredit terbaru buat update UI
        updated_user = await prisma.user.find_unique(where={"email": user_email})

        return {
            "status": "success", 
            "data": {
                "id": log.id, 
                "kategori": log.kategori, 
                "nomorDokumen": log.nomorDokumen, 
                "summary": log.summary, 
                "imagePath": image_url
            }, 
            "remaining_credits": updated_user.creditBalance
        }

    except Exception as e: 
        print(f"Scan Error: {e}")
        return {"status": "error", "message": "Terjadi kesalahan server."}

@app.get("/history")
async def get_history(authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: return []
        
        logs = await prisma.logs.find_many(where={"userId": user_email}, order={"id": "desc"})
        
        # Mapping response biar rapi
        return [{
            "id": l.id, 
            "timestamp": l.timestamp.isoformat(), 
            "kategori": l.kategori, 
            "nomorDokumen": l.nomorDokumen, 
            "receiver": l.receiver, 
            "imagePath": l.imagePath, 
            "summary": l.summary
        } for l in logs]
    except: return []

# Endpoint Rating, Delete, Update Log, Export bisa dicopy dari kode lamamu (sudah aman)
# ... (Paste endpoint sisanya di sini) ...

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
