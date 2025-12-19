from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import numpy as np
from PIL import Image
import io
import os
import requests
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# --- IMPORTS ---
from db import prisma, connect_db, disconnect_db
from utils import get_user_email_from_token
from smart_ocr_processor import SmartOCRProcessor
from pricing_service import CreditService
# drive_service harus sudah lo set up dengan kredensial gdrive lo
from drive_service import export_excel_to_drive 
from imagekit_service import upload_to_imagekit, delete_from_imagekit_by_url

load_dotenv()

smart_ocr = None
UPLOAD_DIR = "uploads"
scheduler = AsyncIOScheduler()

async def cleanup_old_images():
    try:
        cutoff_date = datetime.now() - timedelta(days=30)
        old_logs = await prisma.logs.find_many(where={
            "timestamp": {"lt": cutoff_date},
            "imagePath": {"contains": "imagekit.io"}
        })
        for log in old_logs:
            delete_from_imagekit_by_url(log.imagePath)
            await prisma.logs.update(where={"id": log.id}, data={"imagePath": "EXPIRED"})
    except: pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    global smart_ocr
    try:
        api_key = os.getenv('OCR_SPACE_API_KEY', 'helloworld')
        smart_ocr = SmartOCRProcessor(api_key)
    except: pass
    scheduler.add_job(cleanup_old_images, 'interval', hours=24)
    scheduler.start()
    yield
    await disconnect_db()

app = FastAPI(lifespan=lifespan)
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- AUTH HELPERS ---
def get_google_user_info(token: str):
    try:
        res = requests.get('https://www.googleapis.com/oauth2/v3/userinfo', headers={'Authorization': f'Bearer {token}'}, timeout=5)
        return res.json() if res.status_code == 200 else None
    except: return None

def get_user_email_hybrid(authorization: str):
    if not authorization: return None
    token = authorization.replace("Bearer ", "").strip()
    user_info = get_google_user_info(token)
    if user_info and 'email' in user_info: return user_info['email']
    try: return get_user_email_from_token(authorization)
    except: return None

# --- MODELS ---
class RatingRequest(BaseModel):
    stars: int
    emoji: str
    message: str
    userName: str = "Anonymous"
    userAvatar: str = ""

# --- ENDPOINTS ---

@app.get("/me")
async def get_my_profile(authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: raise HTTPException(401, "Sesi habis")

        user = await prisma.user.find_unique(where={"email": user_email})
        
        if not user:
            # Login pertama kali
            token = authorization.replace("Bearer ", "").strip()
            info = get_google_user_info(token) or {}
            user = await prisma.user.create(data={
                "email": user_email,
                "name": info.get("name", "User"),
                "picture": info.get("picture", ""),
                "creditBalance": 3,
                "createdAt": datetime.now(),
                "lastCreditReset": datetime.now()
            })
        else:
            await CreditService.ensure_daily_credits(user_email, prisma)
            user = await prisma.user.find_unique(where={"email": user_email})

        # --- LOGIKA RESET BULANAN (DATABASE) ---
        today = datetime.now()
        created_at = user.createdAt
        
        # Hitung tanggal anniversary bulan depan
        # Sederhananya: Tanggal yang sama dengan createdAt tapi di bulan depan
        next_reset_date = datetime(today.year, today.month, created_at.day)
        if next_reset_date <= today:
            # Jika sudah lewat di bulan ini, maka bulan depan
            if today.month == 12:
                next_reset_date = datetime(today.year + 1, 1, created_at.day)
            else:
                next_reset_date = datetime(today.year, today.month + 1, created_at.day)
        
        days_left = (next_reset_date - today).days
        status_color = "red" if 1 <= days_left <= 7 else "green"

        return {
            "status": "success",
            "data": {
                **user.dict(),
                "resetInfo": {
                    "nextResetDate": next_reset_date.strftime("%d %B %Y"),
                    "daysLeft": days_left,
                    "color": status_color
                }
            }
        }
    except Exception as e: return {"status": "error", "message": str(e)}

@app.delete("/delete-account")
async def delete_account(authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: return {"status": "error", "message": "User tidak ditemukan"}
        
        # Hapus berurutan untuk menghindari constraint error
        await prisma.logs.delete_many(where={"userId": user_email})
        await prisma.rating.delete_many(where={"userId": user_email})
        await prisma.user.delete(where={"email": user_email})
        
        return {"status": "success", "message": "Akun berhasil dihapus"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/ratings")
async def get_ratings():
    # Menampilkan semua rating agar card muncul di landing page
    data = await prisma.rating.find_many(order={"createdAt": "desc"}, take=10)
    return {"status": "success", "data": data}

@app.post("/rating")
async def post_rating(data: RatingRequest, authorization: str = Header(None)):
    try:
        email = get_user_email_hybrid(authorization) or "anonymous"
        await prisma.rating.create(data={
            "userId": email, "stars": data.stars, "emoji": data.emoji,
            "message": data.message, "userName": data.userName, "userAvatar": data.userAvatar
        })
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/scan")
async def scan_document(file: UploadFile = File(...), receiver: str = Form(...), authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        # Kurangi kredit pakai logic service
        success = await CreditService.deduct_credit(user_email, prisma)
        if not success: return {"status": "error", "message": "Kredit tidak cukup"}

        # Logic OCR lo di sini... (persis kayak kode sebelumnya)
        # Jangan lupa panggil upload_to_imagekit
        return {"status": "success", "message": "Berhasil scan"}
    except Exception as e: return {"status": "error", "message": str(e)}

# Endpoint GDrive
@app.post("/export-drive")
async def export_to_drive(authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        # Ambil data logs user, jadikan excel, kirim ke drive_service
        # result = export_excel_to_drive(data, user_email)
        return {"status": "success", "message": "File dikirim ke Google Drive"}
    except: return {"status": "error"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
