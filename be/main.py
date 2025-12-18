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
import calendar 
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# --- IMPORTS ---
from db import prisma, connect_db, disconnect_db
from utils import get_user_email_from_token
from smart_ocr_processor import SmartOCRProcessor
from pricing_service import CreditService

# 🔥 IMPORT DUA SERVICE BERBEDA 🔥
from drive_service import export_excel_to_drive  # Khusus Export Excel
from imagekit_service import upload_to_imagekit  # Khusus Simpan Gambar

load_dotenv()

# --- CONFIG ---
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
    except: pass
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

# --- HELPER ---
def get_google_user_info(token: str):
    try:
        res = requests.get('https://www.googleapis.com/oauth2/v3/userinfo', headers={'Authorization': f'Bearer {token}'}, timeout=5)
        if res.status_code == 200: return res.json()
    except: pass
    return None

def get_user_email_hybrid(authorization: str):
    if not authorization: return None
    token = authorization.replace("Bearer ", "").strip()
    user_info = get_google_user_info(token)
    if user_info and 'email' in user_info: return user_info['email']
    try: return get_user_email_from_token(authorization)
    except: return None

async def extract_text_from_image(image_np):
    try:
        if smart_ocr:
            text = await smart_ocr.enhanced_ocr_extract(image_np)
            if text and not text.startswith("[ERROR"):
                doc_type = smart_ocr.detect_document_type(text)
                structured = smart_ocr.extract_structured_data(text, doc_type)
                summary = smart_ocr.generate_smart_summary(text, structured, doc_type)
                return { "raw_text": text, "summary": summary, "document_type": doc_type, "structured_data": structured }
    except: pass
    raise Exception("Gagal membaca teks dari gambar.")

# --- MODELS ---
class RatingRequest(BaseModel):
    stars: int; emoji: str; message: str; userName: str; userAvatar: str
class LogUpdate(BaseModel):
    summary: str

# --- ENDPOINTS ---

@app.get("/health")
def health(): return {"status": "ok", "env": os.getenv("ENVIRONMENT", "dev")}

@app.get("/me")
async def get_my_profile(authorization: str = Header(None)):
    try:
        token = authorization.replace("Bearer ", "").strip() if authorization else ""
        user_email = get_user_email_hybrid(authorization)
        if not user_email: raise HTTPException(401, "Sesi habis/invalid")

        user = await prisma.user.find_unique(where={"email": user_email})

        if user:
            await CreditService.ensure_daily_credits(user_email, prisma)
            user = await prisma.user.find_unique(where={"email": user_email})

        google_info = get_google_user_info(token)
        updates = {}
        if google_info:
            if not user or not user.name or user.name == "User": updates["name"] = google_info.get("name", "User")
            if not user or not user.picture: updates["picture"] = google_info.get("picture", "")

        if not user:
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
            user = await prisma.user.update(where={"email": user_email}, data=updates)

        try:
            today = datetime.now()
            join_date = user.createdAt if user.createdAt else today
            reset_day = join_date.day
            
            try: candidate = today.replace(day=reset_day)
            except: 
                import calendar
                last_day = calendar.monthrange(today.year, today.month)[1]
                candidate = today.replace(day=last_day)
            
            if today.date() < candidate.date(): next_reset = candidate
            else:
                next_m = 1 if today.month == 12 else today.month + 1
                next_y = today.year + (1 if today.month == 12 else 0)
                try: next_reset = today.replace(year=next_y, month=next_m, day=reset_day)
                except: next_reset = today.replace(year=next_y, month=next_m, day=28)

            days_left = (next_reset - today).days
            if days_left < 0: days_left = 0
            show_warning = days_left <= 7
            next_reset_str = next_reset.strftime("%d %B %Y")
        except:
            days_left = 30; show_warning = False; next_reset_str = "Setiap Bulan"

        return {
            "status": "success", 
            "data": {
                "email": user.email, "name": user.name, "picture": user.picture,
                "tier": getattr(user, 'tier', 'free'), "creditBalance": user.creditBalance,
                "createdAt": user.createdAt.isoformat(),
                "resetInfo": { "daysLeft": days_left, "showWarning": show_warning, "nextResetDate": next_reset_str }
            }
        }
    except HTTPException as he: raise he
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/scan")
async def scan_document(file: UploadFile = File(...), receiver: str = Form(...), authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: raise HTTPException(401, "Sesi invalid")

        # 1. Cek Saldo
        user = await prisma.user.find_unique(where={"email": user_email})
        if not user or user.creditBalance < 1:
             return {"status": "error", "error_type": "insufficient_credits", "message": "Kredit habis.", "remaining_credits": 0}

        # 2. Simpan File Lokal (Sementara)
        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        
        clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{clean_name}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        with open(filepath, "wb") as f: f.write(content)

        # 3. 🔥 UPLOAD KE IMAGEKIT (Gantikan Render Link) 🔥
        # Ini solusi agar gambar tidak hilang/pecah saat server restart
        image_url = upload_to_imagekit(filepath, filename)
        
        # Fallback jika ImageKit gagal (jarang terjadi)
        if not image_url:
            base_url = os.getenv("API_BASE_URL") or os.getenv("RENDER_EXTERNAL_URL") or "http://localhost:8000"
            image_url = f"{base_url}/uploads/{filename}"
            print("⚠️ Upload ImageKit gagal, pakai link lokal.")

        # 4. OCR Process
        ocr_res = await extract_text_from_image(image_np)
        
        # 5. Simpan Log dengan Link ImageKit
        doc_data = ocr_res.get("structured_data", {})
        log = await prisma.logs.create(data={
            "userId": user_email, "timestamp": datetime.now(), 
            "filename": file.filename, "kategori": ocr_res.get("document_type", "unknown").upper(), 
            "nomorDokumen": doc_data.get('invoice_number') or "MANUAL", "receiver": receiver.upper(), 
            "imagePath": image_url, # <-- Link Permanen
            "summary": ocr_res.get("summary", ""), "fullText": ocr_res.get("raw_text", "")
        })

        # 6. Potong Kredit
        updated = await prisma.user.update(where={"email": user_email}, data={"creditBalance": {"decrement": 1}})

        # (Opsional) Hapus file lokal untuk hemat space Render
        if os.path.exists(filepath): os.remove(filepath)

        return {
            "status": "success", 
            "data": { "id": log.id, "kategori": log.kategori, "nomorDokumen": log.nomorDokumen, "summary": log.summary, "imagePath": image_url }, 
            "remaining_credits": updated.creditBalance
        }

    except Exception as e:
        print(f"Scan Error: {e}")
        return {"status": "error", "message": f"Gagal Scan: {str(e)}"}

@app.post("/export-excel")
async def export_excel(authorization: str = Header(None)):
    try:
        # 🔥 FITUR EXPORT TETAP PAKAI GOOGLE DRIVE 🔥
        user_email = get_user_email_hybrid(authorization)
        if not user_email: raise HTTPException(401, "Invalid")
        raw_token = authorization.replace("Bearer ", "").strip()

        logs = await prisma.logs.find_many(where={"userId": user_email}, order={"timestamp": "desc"})
        if not logs: return {"status": "error", "message": "Data kosong."}

        data_list = []
        for l in logs:
            data_list.append({
                "Tanggal": l.timestamp.strftime("%Y-%m-%d"), 
                "Jam": l.timestamp.strftime("%H:%M"),
                "Kategori": l.kategori, 
                "Nomor": l.nomorDokumen, 
                "Penerima": l.receiver,
                "Ringkasan": l.summary, 
                "Link Foto": l.imagePath # Ini Link ImageKit
            })
        
        df = pd.DataFrame(data_list)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        
        # Upload Excel ke Google Drive User
        drive_res = export_excel_to_drive(raw_token, output, f"Report_{datetime.now().strftime('%Y%m%d')}.xlsx")
        
        if drive_res: return {"status": "success", "message": "Export Berhasil!", "link": drive_res.get('web_view_link')}
        else: return {"status": "error", "message": "Gagal Upload ke Drive."}

    except Exception as e: return {"status": "error", "message": str(e)}

# ... (Endpoint history, rating, delete-account SAMA SEPERTI SEBELUMNYA) ...
# Paste sisa kode endpoint lainnya di sini (tidak ada perubahan untuk endpoint bawah)

@app.get("/ratings")
async def get_ratings():
    try:
        ratings = await prisma.rating.find_many(take=20, order={"createdAt": "desc"})
        return {"status": "success", "data": ratings}
    except Exception as e: return {"status": "error", "data": [], "message": str(e)}

@app.post("/rating")
async def create_rating(data: RatingRequest, authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization) or "anonymous"
        await prisma.rating.create(data={
            "userId": user_email, "userName": data.userName, "userAvatar": data.userAvatar, 
            "stars": data.stars, "emoji": data.emoji, "message": data.message, "createdAt": datetime.now()
        })
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/history")
async def get_history(authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: return []
        logs = await prisma.logs.find_many(where={"userId": user_email}, order={"id": "desc"})
        return [{"id": l.id, "timestamp": l.timestamp.isoformat(), "kategori": l.kategori, "nomorDokumen": l.nomorDokumen, "receiver": l.receiver, "imagePath": l.imagePath, "summary": l.summary} for l in logs]
    except: return []

@app.delete("/logs/{log_id}")
async def delete_log(log_id: int):
    try: await prisma.logs.delete(where={"id": log_id}); return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.put("/logs/{log_id}")
async def update_log(log_id: int, log_data: LogUpdate):
    try: await prisma.logs.update(where={"id": log_id}, data={"summary": log_data.summary}); return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.delete("/delete-account")
async def delete_account(authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: return {"status": "error"}
        
        await prisma.logs.delete_many(where={"userId": user_email})
        await prisma.rating.delete_many(where={"userId": user_email})
        await prisma.user.delete(where={"email": user_email})
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
