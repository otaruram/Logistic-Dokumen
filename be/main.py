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

# --- IMPORT MODULE SENDIRI ---
from db import prisma, connect_db, disconnect_db
from utils import get_user_email_from_token
from smart_ocr_processor import SmartOCRProcessor
from pricing_service import CreditService

load_dotenv()

# --- GLOBAL VARIABLES ---
smart_ocr = None
UPLOAD_DIR = "uploads"

# --- LIFESPAN (Startup & Shutdown) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Server Starting...")
    await connect_db()
    
    global smart_ocr
    try:
        api_key = os.getenv('OCR_SPACE_API_KEY', 'helloworld')
        smart_ocr = SmartOCRProcessor(api_key)
        print("✅ OCR Engine Ready")
    except Exception as e:
        print(f"⚠️ OCR Init Warning: {e}")
        
    yield
    
    print("🛑 Server Shutting Down...")
    await disconnect_db()

app = FastAPI(lifespan=lifespan)

# --- STATIC FILES ---
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- CORS SETUP ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Ganti domain spesifik saat production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- HELPER FUNCTIONS ---

def get_google_user_info(token: str):
    """
    Mengambil data lengkap user dari Google (Nama, Foto, Email).
    Digunakan untuk mengisi profil user di database.
    """
    try:
        res = requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo', 
            headers={'Authorization': f'Bearer {token}'}, 
            timeout=5
        )
        if res.status_code == 200: 
            return res.json() # Return JSON: {sub, name, picture, email}
    except Exception as e: 
        print(f"Google Info Error: {e}")
    return None

def get_user_email_hybrid(authorization: str):
    """
    STRICT MODE: Validasi token.
    Return Email jika valid, None jika tidak.
    """
    if not authorization: return None
    token = authorization.replace("Bearer ", "").strip()
    
    # 1. Cek langsung ke Google (Paling Akurat)
    user_info = get_google_user_info(token)
    if user_info and 'email' in user_info:
        return user_info['email']
        
    # 2. Cek JWT Utils (Backup)
    try: 
        return get_user_email_from_token(authorization)
    except: pass
    
    return None

async def extract_text_from_image(image_np):
    """Wrapper OCR Processor"""
    try:
        if smart_ocr:
            text = await smart_ocr.enhanced_ocr_extract(image_np)
            if text and not text.startswith("[ERROR"):
                doc_type = smart_ocr.detect_document_type(text)
                structured = smart_ocr.extract_structured_data(text, doc_type)
                summary = smart_ocr.generate_smart_summary(text, structured, doc_type)
                return {
                    "raw_text": text, 
                    "summary": summary, 
                    "document_type": doc_type, 
                    "structured_data": structured
                }
    except Exception as e:
        print(f"OCR Logic Error: {e}")
    return {"raw_text": "", "summary": "Gagal Baca / Error", "document_type": "error"}

# --- MODELS ---
class RatingRequest(BaseModel):
    stars: int; emoji: str; message: str; userName: str; userAvatar: str
class LogUpdate(BaseModel):
    summary: str

# --- ENDPOINTS ---

@app.get("/health")
def health():
    return {"status": "ok", "environment": os.getenv("ENVIRONMENT", "dev")}

@app.get("/me")
async def get_my_profile(authorization: str = Header(None)):
    try:
        token = authorization.replace("Bearer ", "").strip() if authorization else ""
        user_email = get_user_email_hybrid(authorization)
        
        if not user_email: 
            raise HTTPException(status_code=401, detail="Sesi habis. Login ulang.")

        # 1. Auto Reset Kredit Hari Ini
        await CreditService.ensure_daily_credits(user_email, prisma)

        # 2. Ambil User dari Database
        user = await prisma.user.find_unique(where={"email": user_email})

        # 3. SYNC PROFIL DARI GOOGLE (Fix Foto & Nama)
        # Ambil data terbaru dari Google
        google_info = get_google_user_info(token)
        
        updates = {}
        if google_info:
            # Jika user belum punya nama/foto di DB, update sekarang
            if not user or not user.name or user.name == "User":
                updates["name"] = google_info.get("name", "User")
            if not user or not user.picture:
                updates["picture"] = google_info.get("picture", "")

        # 4. Handle Create New / Update Existing
        if not user:
            # User Baru
            user = await prisma.user.create(data={
                "email": user_email, 
                "name": google_info.get("name", "User") if google_info else "User",
                "picture": google_info.get("picture", "") if google_info else "",
                "creditBalance": 3,
                "tier": "free",
                "createdAt": datetime.now(),
                "lastCreditReset": datetime.now()
            })
        elif updates:
            # User Lama (Update Data)
            user = await prisma.user.update(where={"email": user_email}, data=updates)

        return {
            "status": "success", 
            "data": {
                "email": user.email,
                "name": user.name,
                "picture": user.picture,
                "tier": getattr(user, 'tier', 'free'),
                "creditBalance": user.creditBalance,
                "createdAt": user.createdAt.isoformat() if user.createdAt else datetime.now().isoformat(),
                "resetInfo": { "nextReset": "Tomorrow 00:00" } 
            }
        }
    except HTTPException as he: raise he
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/scan")
async def scan_document(file: UploadFile = File(...), receiver: str = Form(...), authorization: str = Header(None)):
    try:
        # 1. Auth Check
        user_email = get_user_email_hybrid(authorization)
        if not user_email: 
            raise HTTPException(status_code=401, detail="Sesi tidak valid.")

        # 2. Credit Deduct
        success_deduct = await CreditService.deduct_credit(user_email, prisma)
        if not success_deduct:
            # Return JSON Error Khusus Kredit
            return {
                "status": "error", 
                "error_type": "insufficient_credits", 
                "message": "Kredit habis. Tunggu besok ya!", 
                "remaining_credits": 0
            }

        # 3. Save File
        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        
        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
        filename = f"{timestamp_str}_{clean_name}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f: f.write(content)

        # 4. Smart URL
        base_url = os.getenv("API_BASE_URL")
        if not base_url: base_url = os.getenv("RENDER_EXTERNAL_URL")
        if not base_url: base_url = "http://localhost:8000"
        
        image_url = f"{base_url}/uploads/{filename}"

        # 5. OCR Process
        ocr_res = await extract_text_from_image(image_np)
        
        # 6. Save Log
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

        updated_user = await prisma.user.find_unique(where={"email": user_email})

        # Response Sukses
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

    except HTTPException as he: raise he
    except Exception as e: 
        print(f"Scan Error: {e}")
        # Return JSON Error Generik biar frontend gk crash "null status"
        return {"status": "error", "message": f"Server Error: {str(e)}"}

@app.get("/history")
async def get_history(authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: return []
        
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
    except: return []

# --- RATINGS ENDPOINTS ---

@app.get("/ratings")
async def get_ratings():
    """Ambil daftar review untuk Landing Page"""
    try:
        ratings = await prisma.rating.find_many(take=20, order={"createdAt": "desc"})
        return {"status": "success", "data": ratings}
    except Exception as e:
        return {"status": "error", "data": [], "message": str(e)}

@app.post("/rating")
async def create_rating(data: RatingRequest, authorization: str = Header(None)):
    """Kirim review baru"""
    try:
        user_email = get_user_email_hybrid(authorization) or "anonymous"
        
        await prisma.rating.create(data={
            "userId": user_email, 
            "userName": data.userName, 
            "userAvatar": data.userAvatar, 
            "stars": data.stars, 
            "emoji": data.emoji, 
            "message": data.message,
            "createdAt": datetime.now()
        })
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

# --- LOG MANAGEMENT ---

@app.put("/logs/{log_id}")
async def update_log(log_id: int, log_data: LogUpdate):
    try:
        await prisma.logs.update(where={"id": log_id}, data={"summary": log_data.summary})
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.delete("/logs/{log_id}")
async def delete_log(log_id: int):
    try:
        await prisma.logs.delete(where={"id": log_id})
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.delete("/delete-account")
async def delete_account(authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: return {"status": "error"}
        
        user = await prisma.user.find_unique(where={"email": user_email})
        if not user: raise HTTPException(404, "User not found")
        
        await prisma.logs.delete_many(where={"userId": user_email})
        await prisma.user.delete(where={"id": user.id})
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
