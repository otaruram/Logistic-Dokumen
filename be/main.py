from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import numpy as np
from PIL import Image
import io
import pandas as pd
from datetime import datetime, timedelta
import os
import requests
import pytz 
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# --- IMPORTS LOKAL ---
from db import prisma, connect_db, disconnect_db
from utils import get_user_email_from_token
from smart_ocr_processor import SmartOCRProcessor
from pricing_service import CreditService # Pastikan isinya Logic Daily
from drive_service import export_excel_to_drive # Pastikan isinya Logic Service Account
from imagekit_service import upload_to_imagekit, delete_from_imagekit_by_url

load_dotenv()

# --- CONFIG ---
smart_ocr = None
UPLOAD_DIR = "uploads"
WIB = pytz.timezone('Asia/Jakarta')

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

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
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

# --- MODELS ---
class RatingRequest(BaseModel):
    stars: int; emoji: str; message: str; userName: str = "Anonymous"; userAvatar: str = ""

class LogUpdate(BaseModel):
    summary: str

# --- ENDPOINTS ---

@app.get("/health")
def health(): return {"status": "ok", "env": "production"}

@app.get("/me")
async def get_my_profile(authorization: str = Header(None)):
    try:
        token = authorization.replace("Bearer ", "").strip() if authorization else ""
        user_email = get_user_email_hybrid(authorization)
        if not user_email: raise HTTPException(401, "Sesi habis/invalid")

        # 1. RESET KREDIT HARIAN (Sesuai Request: Kredit reset tiap hari)
        await CreditService.ensure_daily_credits(user_email, prisma)

        user = await prisma.user.find_unique(where={"email": user_email})

        # Auto-create user
        if not user:
            google_info = get_google_user_info(token)
            user = await prisma.user.create(data={
                "email": user_email, 
                "name": google_info.get("name", "User") if google_info else "User",
                "picture": google_info.get("picture", "") if google_info else "",
                "creditBalance": 3, # Default Daily
                "tier": "free",
                "createdAt": datetime.now(),
                "lastCreditReset": datetime.now()
            })

        # 2. LOGIKA HITUNG MUNDUR DATA LOG (BULANAN)
        # Kredit boleh harian, tapi User harus tau kapan Data Log dibersihkan (Tiap tanggal 1)
        now = datetime.now(WIB)
        
        # Target: Tanggal 1 Bulan Depan
        if now.month == 12:
            next_data_reset = datetime(now.year + 1, 1, 1, tzinfo=WIB)
        else:
            next_data_reset = datetime(now.year, now.month + 1, 1, tzinfo=WIB)
            
        # Hitung sisa hari
        days_left = (next_data_reset - now).days
        
        # Format Tanggal Cantik
        months_id = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
        reset_str = f"1 {months_id[next_data_reset.month]} {next_data_reset.year}"

        return {
            "status": "success", 
            "data": {
                "email": user.email, "name": user.name, "picture": user.picture,
                "creditBalance": user.creditBalance,
                
                # INI PENTING: Info Reset Data untuk Notifikasi Header
                "resetInfo": { 
                    "nextResetDate": reset_str, 
                    "daysLeft": days_left,
                    "type": "DataLog" 
                }
            }
        }
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/scan")
async def scan_document(file: UploadFile = File(...), receiver: str = Form(...), authorization: str = Header(None)):
    filepath = None
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: raise HTTPException(401, "Unauthorized")

        user = await prisma.user.find_unique(where={"email": user_email})
        if not user or user.creditBalance < 1:
             return {"status": "error", "error_type": "insufficient_credits", "message": "Kredit harian habis. Kembali lagi besok!"}

        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f: f.write(content)

        image_url = upload_to_imagekit(filepath, filename)
        if not image_url: raise Exception("Gagal upload gambar.")

        async def extract_text_from_image(img):
            if smart_ocr:
                text = await smart_ocr.enhanced_ocr_extract(img)
                doc_type = smart_ocr.detect_document_type(text)
                structured = smart_ocr.extract_structured_data(text, doc_type)
                summary = smart_ocr.generate_smart_summary(text, structured, doc_type)
                return { "raw_text": text, "summary": summary, "document_type": doc_type, "structured_data": structured }
            return {}

        ocr_res = await extract_text_from_image(image_np)
        doc_data = ocr_res.get("structured_data", {})
        
        log = await prisma.logs.create(data={
            "userId": user_email, "timestamp": datetime.now(), 
            "filename": file.filename, "kategori": ocr_res.get("document_type", "unknown").upper(), 
            "nomorDokumen": doc_data.get('invoice_number') or "MANUAL", "receiver": receiver.upper(), 
            "imagePath": image_url, "summary": ocr_res.get("summary", ""), "fullText": ocr_res.get("raw_text", "")
        })

        updated = await prisma.user.update(where={"email": user_email}, data={"creditBalance": {"decrement": 1}})
        if filepath and os.path.exists(filepath): os.remove(filepath)

        return {
            "status": "success", 
            "data": { "id": log.id, "kategori": log.kategori, "summary": log.summary, "imagePath": image_url }, 
            "remaining_credits": updated.creditBalance
        }
    except Exception as e:
        if filepath and os.path.exists(filepath): os.remove(filepath)
        return {"status": "error", "message": f"Scan Gagal: {str(e)}"}

# 🔥 EXPORT DENGAN FORMAT EXCEL RAPI (XLSXWRITER) 🔥
@app.post("/export-excel")
async def export_excel(authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: raise HTTPException(401, "Unauthorized")
        
        logs = await prisma.logs.find_many(where={"userId": user_email}, order={"timestamp": "desc"})
        if not logs: return {"status": "error", "message": "Data kosong."}
        
        data_list = []
        for l in logs:
            data_list.append({
                "Tanggal": l.timestamp.strftime("%Y-%m-%d"), 
                "Jam": l.timestamp.strftime("%H:%M"),
                "Kategori": l.kategori, "Nomor Dokumen": l.nomorDokumen, 
                "Penerima": l.receiver, "Ringkasan": l.summary, "Link Gambar": l.imagePath
            })
        
        df = pd.DataFrame(data_list)
        output = io.BytesIO()
        
        # Styling Excel Professional
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            sheet_name = 'Laporan OCR'
            df.to_excel(writer, sheet_name=sheet_name, index=False)
            workbook = writer.book; worksheet = writer.sheets[sheet_name]
            
            header_fmt = workbook.add_format({'bold': True, 'text_wrap': True, 'valign': 'vcenter', 'align': 'center', 'fg_color': '#2F75B5', 'font_color': '#FFFFFF', 'border': 1})
            body_fmt = workbook.add_format({'border': 1, 'valign': 'top', 'text_wrap': True})
            link_fmt = workbook.add_format({'font_color': 'blue', 'underline': 1, 'border': 1, 'valign': 'top'})

            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_fmt)
                col_len = max(df[value].astype(str).map(len).max(), len(str(value))) + 2
                worksheet.set_column(col_num, col_num, min(col_len, 50), body_fmt)
            worksheet.set_column(6, 6, 25, link_fmt)

        output.seek(0)
        filename = f"Laporan_OCR_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
        
        # Upload ke Drive Bot
        drive_res = export_excel_to_drive(output, filename)
        
        if drive_res: 
            return {"status": "success", "message": "Export Berhasil!", "link": drive_res.get('web_view_link')}
        else:
            return {"status": "error", "message": "Gagal Upload ke Drive."}
            
    except Exception as e: return {"status": "error", "message": str(e)}

# --- LOGS & DELETE ---
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
    except: return {"status": "error"}

@app.put("/logs/{log_id}")
async def update_log(log_id: int, log_data: LogUpdate):
    try: await prisma.logs.update(where={"id": log_id}, data={"summary": log_data.summary}); return {"status": "success"}
    except: return {"status": "error"}

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

@app.get("/ratings")
async def get_ratings():
    try:
        ratings = await prisma.rating.find_many(take=20, order={"createdAt": "desc"})
        return {"status": "success", "data": ratings}
    except: return {"status": "error", "data": []}

@app.delete("/delete-account")
async def delete_account(authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: return {"status": "error", "message": "User not found"}
        await prisma.logs.delete_many(where={"userId": user_email})
        await prisma.rating.delete_many(where={"userId": user_email})
        await prisma.user.delete(where={"email": user_email})
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
