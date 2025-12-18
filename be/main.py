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
import calendar # Wajib import ini untuk hitungan bulan
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# --- IMPORTS MODULE SENDIRI ---
from db import prisma, connect_db, disconnect_db
from utils import get_user_email_from_token
from smart_ocr_processor import SmartOCRProcessor
from pricing_service import CreditService

# 🔥 IMPORT DRIVE SERVICE (Pastikan file drive_service.py sudah ada) 🔥
from drive_service import upload_image_to_drive, export_excel_to_drive

load_dotenv()

# --- SETUP GLOBAL ---
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

# --- HELPER FUNCTIONS ---
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

        # 1. Cari User di DB
        user = await prisma.user.find_unique(where={"email": user_email})

        # 2. Cek Kredit Harian (Hanya jika user sudah ada)
        if user:
            await CreditService.ensure_daily_credits(user_email, prisma)
            user = await prisma.user.find_unique(where={"email": user_email})

        # 3. Sync Data Google
        google_info = get_google_user_info(token)
        updates = {}
        if google_info:
            if not user or not user.name or user.name == "User": updates["name"] = google_info.get("name", "User")
            if not user or not user.picture: updates["picture"] = google_info.get("picture", "")

        # 4. Handle User Baru (Reset Kredit Awal = 3)
        if not user:
            user = await prisma.user.create(data={
                "email": user_email, 
                "name": google_info.get("name", "User") if google_info else "User",
                "picture": google_info.get("picture", "") if google_info else "",
                "creditBalance": 3, # 🔥 Default saldo awal
                "tier": "free",
                "createdAt": datetime.now(),
                "lastCreditReset": datetime.now()
            })
        elif updates:
            user = await prisma.user.update(where={"email": user_email}, data=updates)

        # 5. 🔥 LOGIKA HITUNGAN 1 BULAN (RESET DATA TABLE) 🔥
        try:
            today = datetime.now()
            join_date = user.createdAt if user.createdAt else today
            
            # Tanggal target adalah tanggal yang sama dengan tanggal join (misal tgl 20)
            reset_day = join_date.day
            
            # Coba set tanggal reset di BULAN INI
            try:
                candidate_this_month = today.replace(day=reset_day)
            except ValueError:
                # Handle error: misal hari ini Februari (28 hari), tapi join tgl 30.
                # Maka targetnya adalah akhir bulan ini.
                last_day_this_month = calendar.monthrange(today.year, today.month)[1]
                candidate_this_month = today.replace(day=last_day_this_month)
            
            # Bandingkan: Apakah tanggal reset bulan ini SUDAH LEWAT?
            if today.date() < candidate_this_month.date():
                # Belum lewat, berarti reset berikutnya adalah tgl tersebut di bulan ini
                next_reset_date = candidate_this_month
            else:
                # Sudah lewat, berarti reset berikutnya adalah BULAN DEPAN
                next_month = 1 if today.month == 12 else today.month + 1
                next_year = today.year + (1 if today.month == 12 else 0)
                
                try:
                    next_reset_date = today.replace(year=next_year, month=next_month, day=reset_day)
                except ValueError:
                    # Handle error: misal bulan depan Februari, join tgl 30.
                    last_day_next_month = calendar.monthrange(next_year, next_month)[1]
                    next_reset_date = today.replace(year=next_year, month=next_month, day=last_day_next_month)

            days_left = (next_reset_date - today).days
            if days_left < 0: days_left = 0
            
            show_warning = days_left <= 7
            next_reset_str = next_reset_date.strftime("%d %B %Y")
            
        except Exception as e:
            print(f"Date Calc Error: {e}")
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
        raw_token = authorization.replace("Bearer ", "").strip()

        # 1. Cek Saldo (JANGAN POTONG DULU)
        user = await prisma.user.find_unique(where={"email": user_email})
        if not user or user.creditBalance < 1:
             return {"status": "error", "error_type": "insufficient_credits", "message": "Kredit habis. Reset besok.", "remaining_credits": 0}

        # 2. Simpan Lokal
        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f: f.write(content)

        # 3. Setup Link
        base_url = os.getenv("API_BASE_URL") or os.getenv("RENDER_EXTERNAL_URL") or "http://localhost:8000"
        final_url = f"{base_url}/uploads/{filename}" # Default lokal

        # 4. Upload GDrive
        drive_res = upload_image_to_drive(raw_token, filepath)
        if drive_res:
            # Pakai link drive jika sukses
            final_url = drive_res.get('direct_link') or drive_res.get('web_view_link')

        # 5. Proses OCR AI
        ocr_res = await extract_text_from_image(image_np)
        
        # 6. Simpan Log Database
        doc_data = ocr_res.get("structured_data", {})
        log = await prisma.logs.create(data={
            "userId": user_email, "timestamp": datetime.now(), 
            "filename": file.filename, "kategori": ocr_res.get("document_type", "unknown").upper(), 
            "nomorDokumen": doc_data.get('invoice_number') or "MANUAL", "receiver": receiver.upper(), 
            "imagePath": final_url, "summary": ocr_res.get("summary", ""), "fullText": ocr_res.get("raw_text", "")
        })

        # 7. 🔥 POTONG KREDIT (Hanya jika sampai sini sukses) 🔥
        updated = await prisma.user.update(where={"email": user_email}, data={"creditBalance": {"decrement": 1}})

        return {
            "status": "success", 
            "data": { "id": log.id, "kategori": log.kategori, "nomorDokumen": log.nomorDokumen, "summary": log.summary, "imagePath": final_url }, 
            "remaining_credits": updated.creditBalance
        }

    except Exception as e:
        print(f"Scan Error: {e}")
        return {"status": "error", "message": f"Gagal Scan: {str(e)}"}

@app.post("/export-excel")
async def export_excel(authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: raise HTTPException(401, "Invalid")
        raw_token = authorization.replace("Bearer ", "").strip()

        logs = await prisma.logs.find_many(where={"userId": user_email}, order={"timestamp": "desc"})
        if not logs: return {"status": "error", "message": "Data kosong."}

        data_list = []
        for l in logs:
            data_list.append({
                "Tanggal": l.timestamp.strftime("%Y-%m-%d"), "Jam": l.timestamp.strftime("%H:%M"),
                "Kategori": l.kategori, "Nomor": l.nomorDokumen, "Penerima": l.receiver,
                "Ringkasan": l.summary, "Link Foto": l.imagePath
            })
        
        df = pd.DataFrame(data_list)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0) # Reset pointer
        
        drive_res = export_excel_to_drive(raw_token, output, f"Report_{datetime.now().strftime('%Y%m%d')}.xlsx")
        
        if drive_res: return {"status": "success", "message": "Export Berhasil!", "link": drive_res.get('web_view_link')}
        else: return {"status": "error", "message": "Gagal Upload ke Drive (Cek Permission)."}

    except Exception as e: return {"status": "error", "message": str(e)}

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
        
        # Hapus data terkait dulu agar tidak foreign key error
        await prisma.logs.delete_many(where={"userId": user_email})
        await prisma.rating.delete_many(where={"userId": user_email})
        # Terakhir hapus usernya
        await prisma.user.delete(where={"email": user_email})
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
