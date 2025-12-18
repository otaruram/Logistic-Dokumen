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

from db import prisma, connect_db, disconnect_db
from utils import get_user_email_from_token
from smart_ocr_processor import SmartOCRProcessor
from pricing_service import CreditService

load_dotenv()

smart_ocr = None
UPLOAD_DIR = "uploads"

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

os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- HELPER: AMBIL DATA GOOGLE LENGKAP ---
def get_google_user_info(token: str):
    """Ambil data lengkap user dari Google (Nama, Foto, Email)"""
    try:
        res = requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo', 
            headers={'Authorization': f'Bearer {token}'}, timeout=3
        )
        if res.status_code == 200: 
            return res.json() # Return full JSON: {sub, name, given_name, picture, email}
    except: pass
    return None

def get_user_email_hybrid(authorization: str):
    if not authorization: return None
    token = authorization.replace("Bearer ", "").strip()
    
    # Cek Google
    user_info = get_google_user_info(token)
    if user_info and 'email' in user_info:
        return user_info['email']
        
    # Cek JWT
    try: return get_user_email_from_token(authorization)
    except: pass
    return None

# --- MODELS ---
class RatingRequest(BaseModel):
    stars: int; emoji: str; message: str; userName: str; userAvatar: str
class LogUpdate(BaseModel):
    summary: str

# --- ENDPOINTS ---

@app.get("/health")
def health(): return {"status": "ok"}

# 🔥 FIX PROFILE PICTURE & NAME DISINI 🔥
@app.get("/me")
async def get_my_profile(authorization: str = Header(None)):
    try:
        token = authorization.replace("Bearer ", "").strip()
        user_email = get_user_email_hybrid(authorization)
        
        if not user_email: 
            raise HTTPException(status_code=401, detail="Sesi habis. Login ulang.")

        await CreditService.ensure_daily_credits(user_email, prisma)

        # 1. Cek User di DB
        user = await prisma.user.find_unique(where={"email": user_email})
        
        # 2. UPDATE OTOMATIS: Ambil Data Terbaru dari Google (Foto & Nama)
        # Ini triknya! Setiap kali user buka profile, kita curi fotonya dari Google
        google_info = get_google_user_info(token)
        
        updates = {}
        if google_info:
            # Jika di DB namanya masih default/kosong, atau fotonya kosong -> Update!
            if not user or not user.name or user.name == "User":
                updates["name"] = google_info.get("name", "User")
            if not user or not user.picture:
                updates["picture"] = google_info.get("picture", "")

        # 3. Handle User Baru atau Update User Lama
        if not user:
            # Create Baru dengan foto lengkap
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
            # Update data yang kurang
            user = await prisma.user.update(where={"email": user_email}, data=updates)

        return {
            "status": "success", 
            "data": {
                "email": user.email,
                "name": user.name,     # Sekarang pasti ada isinya
                "picture": user.picture, # Sekarang pasti ada isinya
                "tier": getattr(user, 'tier', 'free'),
                "creditBalance": user.creditBalance,
                "createdAt": user.createdAt.isoformat() if user.createdAt else datetime.now().isoformat(),
                "resetInfo": { "nextReset": "Tomorrow 00:00" } 
            }
        }
    except Exception as e: return {"status": "error", "message": str(e)}

# ... (Endpoint /scan, /history BIARKAN SAMA SEPERTI SEBELUMNYA) ...
# Copy paste endpoint /scan dan /history dari kode sebelumnya ke sini
# Supaya tidak kepanjangan saya skip tulis ulang, tapi pastikan ada.

@app.post("/scan")
async def scan_document(file: UploadFile = File(...), receiver: str = Form(...), authorization: str = Header(None)):
    # ... Gunakan kode /scan dari jawaban sebelumnya ...
    # Pastikan pakai get_user_email_hybrid yg baru
    # Logika sama persis
    pass 

@app.get("/history")
async def get_history(authorization: str = Header(None)):
    # ... Gunakan kode /history dari jawaban sebelumnya ...
    pass


# 🔥 FIX RATING: Endpoint Baru untuk Baca Data Review 🔥
@app.get("/ratings")
async def get_ratings():
    try:
        # Ambil 20 rating terbaru
        ratings = await prisma.rating.find_many(
            take=20, 
            order={"createdAt": "desc"}
        )
        return {"status": "success", "data": ratings}
    except Exception as e:
        print(f"Rating Error: {e}")
        return {"status": "error", "data": []}

@app.post("/rating")
async def create_rating(data: RatingRequest, authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization) or "anonymous"
        
        # Simpan ke DB
        await prisma.rating.create(data={
            "userId": user_email, 
            "userName": data.userName, 
            "userAvatar": data.userAvatar, 
            "stars": data.stars, 
            "emoji": data.emoji, 
            "message": data.message,
            "createdAt": datetime.now() # Pastikan field ini ada di schema
        })
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

# ... (Sisanya sama: /logs update delete, /delete-account) ...

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
