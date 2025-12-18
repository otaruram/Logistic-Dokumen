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

# 🔥 IMPORT SERVICE 🔥
from drive_service import export_excel_to_drive
from imagekit_service import upload_to_imagekit, delete_from_imagekit_by_url

# --- SCHEDULER ---
from apscheduler.schedulers.asyncio import AsyncIOScheduler

load_dotenv()

# --- CONFIG ---
smart_ocr = None
UPLOAD_DIR = "uploads"
scheduler = AsyncIOScheduler()

# Fungsi Pembersih Otomatis
async def cleanup_old_images():
    try:
        cutoff_date = datetime.now() - pd.Timedelta(days=30)
        old_logs = await prisma.logs.find_many(where={
            "timestamp": {"lt": cutoff_date},
            "imagePath": {"contains": "imagekit.io"}
        })
        for log in old_logs:
            if delete_from_imagekit_by_url(log.imagePath):
                await prisma.logs.update(where={"id": log.id}, data={"imagePath": "EXPIRED"})
    except: pass

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
    
    scheduler.add_job(cleanup_old_images, 'interval', hours=24)
    scheduler.start()
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

# ... (Helper Functions: get_google_user_info, get_user_email_hybrid Tetap SAMA) ...
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

# ... (Models & Endpoint Health/Me SAMA) ...
class RatingRequest(BaseModel):
    stars: int; emoji: str; message: str; userName: str; userAvatar: str
class LogUpdate(BaseModel):
    summary: str

@app.get("/health")
def health(): return {"status": "ok"}

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
        if not user:
            user = await prisma.user.create(data={"email": user_email, "name": google_info.get("name", "User") if google_info else "User", "picture": google_info.get("picture", "") if google_info else "", "creditBalance": 3, "tier": "free", "createdAt": datetime.now(), "lastCreditReset": datetime.now()})
        
        return {"status": "success", "data": {"email": user.email, "name": user.name, "picture": user.picture, "creditBalance": user.creditBalance}}
    except Exception as e: return {"status": "error", "message": str(e)}


# 🔥 ENDPOINT SCAN YANG DIPERBAIKI (LOGIC ANTI RUGI) 🔥
@app.post("/scan")
async def scan_document(file: UploadFile = File(...), receiver: str = Form(...), authorization: str = Header(None)):
    filepath = None
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: raise HTTPException(401, "Sesi invalid")

        # 1. Cek Saldo Awal (Jangan potong dulu)
        user = await prisma.user.find_unique(where={"email": user_email})
        if not user or user.creditBalance < 1:
             return {"status": "error", "error_type": "insufficient_credits", "message": "Kredit habis.", "remaining_credits": 0}

        # 2. Simpan File Sementara
        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{clean_name}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f: f.write(content)

        # 3. UPLOAD KE IMAGEKIT
        # Jika ini gagal, kode akan berhenti dan lari ke 'except'
        image_url = upload_to_imagekit(filepath, filename)
        
        if not image_url:
            raise Exception("Gagal upload gambar ke server.")

        # 4. OCR Process
        ocr_res = await extract_text_from_image(image_np)
        
        # 5. Simpan Log (Baru dilakukan jika Upload & OCR sukses)
        doc_data = ocr_res.get("structured_data", {})
        log = await prisma.logs.create(data={
            "userId": user_email, "timestamp": datetime.now(), 
            "filename": file.filename, "kategori": ocr_res.get("document_type", "unknown").upper(), 
            "nomorDokumen": doc_data.get('invoice_number') or "MANUAL", "receiver": receiver.upper(), 
            "imagePath": image_url, 
            "summary": ocr_res.get("summary", ""), "fullText": ocr_res.get("raw_text", "")
        })

        # 6. POTONG KREDIT (STEP TERAKHIR)
        # Jika terjadi error di langkah 2, 3, 4, atau 5, baris ini TIDAK AKAN DIEKSEKUSI
        updated = await prisma.user.update(where={"email": user_email}, data={"creditBalance": {"decrement": 1}})

        # Bersihkan file lokal
        if filepath and os.path.exists(filepath): os.remove(filepath)

        return {
            "status": "success", 
            "data": { "id": log.id, "kategori": log.kategori, "nomorDokumen": log.nomorDokumen, "summary": log.summary, "imagePath": image_url }, 
            "remaining_credits": updated.creditBalance
        }

    except Exception as e:
        print(f"❌ SCAN ERROR: {e}")
        if filepath and os.path.exists(filepath): os.remove(filepath)
        # Return Error agar FE tahu, tapi KREDIT AMAN karena belum dipotong
        return {"status": "error", "message": f"Scan Gagal: {str(e)}"}

# ... (Sisa Endpoint Export, History dll SAMA PERSIS) ...
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
            data_list.append({"Tanggal": l.timestamp.strftime("%Y-%m-%d"), "Jam": l.timestamp.strftime("%H:%M"), "Kategori": l.kategori, "Nomor": l.nomorDokumen, "Penerima": l.receiver, "Ringkasan": l.summary, "Link Foto": l.imagePath})
        df = pd.DataFrame(data_list)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer: df.to_excel(writer, index=False)
        output.seek(0)
        drive_res = export_excel_to_drive(raw_token, output, f"Report_{datetime.now().strftime('%Y%m%d')}.xlsx")
        if drive_res: return {"status": "success", "message": "Export Berhasil!", "link": drive_res.get('web_view_link')}
        else: return {"status": "error", "message": "Gagal Upload ke Drive."}
    except Exception as e: return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
