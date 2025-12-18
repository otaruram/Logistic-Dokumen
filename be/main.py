from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import numpy as np
from PIL import Image
import io
import pandas as pd # Wajib install pandas openpyxl
from datetime import datetime
import os
import requests
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# --- IMPORTS ---
from db import prisma, connect_db, disconnect_db
from utils import get_user_email_from_token
from smart_ocr_processor import SmartOCRProcessor
from pricing_service import CreditService

# 🔥 IMPORT DUA FUNGSI DARI DRIVE SERVICE 🔥
from drive_service import upload_image_to_drive, export_excel_to_drive

load_dotenv()

# --- SETUP ---
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
def get_user_email_hybrid(authorization: str):
    if not authorization: return None
    token = authorization.replace("Bearer ", "").strip()
    try:
        res = requests.get('https://www.googleapis.com/oauth2/v3/userinfo', headers={'Authorization': f'Bearer {token}'}, timeout=3)
        if res.status_code == 200: return res.json().get('email')
    except: pass
    try: return get_user_email_from_token(authorization)
    except: return None

# --- ENDPOINTS ---

@app.get("/health")
def health(): return {"status": "ok"}

@app.get("/me")
async def get_my_profile(authorization: str = Header(None)):
    # ... (Kode /me SAMA PERSIS seperti sebelumnya) ...
    # Biar tidak kepanjangan, pakai kode /me dari jawaban sebelumnya ya
    # Intinya logika reset kredit & notifikasi ada di sini
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: raise HTTPException(401, "Sesi habis")
        
        await CreditService.ensure_daily_credits(user_email, prisma)
        user = await prisma.user.find_unique(where={"email": user_email})
        
        # ... (Logika sync user & notifikasi reset tgl sama) ...
        
        # KEMBALIKAN DATA USER
        return {
            "status": "success", 
            "data": {
                "email": user.email,
                "name": user.name,
                "creditBalance": user.creditBalance,
                # ... field lain
            }
        }
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/scan")
async def scan_document(file: UploadFile = File(...), receiver: str = Form(...), authorization: str = Header(None)):
    try:
        user_email = get_user_email_hybrid(authorization)
        if not user_email: raise HTTPException(401, "Sesi invalid")
        raw_token = authorization.replace("Bearer ", "").strip()

        # 1. Cek Kredit (Scan = Bayar)
        user = await prisma.user.find_unique(where={"email": user_email})
        if not user or user.creditBalance < 1:
             return {"status": "error", "message": "Kredit habis.", "remaining_credits": 0}

        # 2. Proses File
        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        
        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
        filename = f"{timestamp_str}_{clean_name}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f: f.write(content)

        # 3. Upload Drive (Jika Token Valid)
        drive_res = upload_image_to_drive(raw_token, filepath)
        
        base_url = os.getenv("API_BASE_URL") or os.getenv("RENDER_EXTERNAL_URL") or "http://localhost:8000"
        final_image_url = f"{base_url}/uploads/{filename}"
        
        if drive_res:
            final_image_url = drive_res.get('direct_link') or drive_res.get('web_view_link')

        # 4. OCR
        # ... (Panggil fungsi OCR extract_text_from_image) ...
        # Anggap ocr_res sudah dapat (pakai kode sebelumnya)
        # ocr_res = await extract_text_from_image(image_np) 
        
        # MOCKUP OCR BIAR KODE PENDEK (Ganti pakai fungsi aslimu)
        ocr_res = {"summary": "Dokumen Terbaca", "raw_text": "Contoh", "document_type": "INVOICE"}
        
        # 5. Simpan Log
        log = await prisma.logs.create(data={
            "userId": user_email, "timestamp": datetime.now(), 
            "filename": file.filename, "kategori": ocr_res["document_type"], 
            "nomorDokumen": "AUTO-123", "receiver": receiver.upper(), 
            "imagePath": final_image_url, "summary": ocr_res["summary"], "fullText": ocr_res["raw_text"]
        })

        # 6. POTONG KREDIT (Hanya di Scan)
        updated_user = await prisma.user.update(where={"email": user_email}, data={"creditBalance": {"decrement": 1}})

        return {"status": "success", "data": log, "remaining_credits": updated_user.creditBalance}

    except Exception as e: return {"status": "error", "message": str(e)}

# 🔥 FITUR BARU: EXPORT EXCEL (GRATIS) 🔥
@app.post("/export-excel")
async def export_excel(authorization: str = Header(None)):
    try:
        # 1. Auth (Tetap butuh login)
        user_email = get_user_email_hybrid(authorization)
        if not user_email: raise HTTPException(401, "Sesi invalid")
        raw_token = authorization.replace("Bearer ", "").strip()

        # 2. Ambil Semua Data User
        logs = await prisma.logs.find_many(where={"userId": user_email}, order={"timestamp": "desc"})
        
        if not logs:
            return {"status": "error", "message": "Tidak ada data untuk diexport."}

        # 3. Buat Excel di Memory (Pandas)
        data_list = []
        for l in logs:
            data_list.append({
                "Tanggal": l.timestamp.strftime("%Y-%m-%d"),
                "Jam": l.timestamp.strftime("%H:%M"),
                "Kategori": l.kategori,
                "Nomor Dokumen": l.nomorDokumen,
                "Penerima": l.receiver,
                "Ringkasan": l.summary,
                "Link Foto": l.imagePath
            })
        
        df = pd.DataFrame(data_list)
        
        # Buffer Excel
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Logistik Data')
        
        # 4. Upload ke Drive (GRATIS - Tanpa Potong Kredit)
        filename = f"Report_Logistic_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
        drive_res = export_excel_to_drive(raw_token, output, filename)

        if drive_res:
            return {
                "status": "success", 
                "message": "Export Excel Berhasil!",
                "link": drive_res.get('web_view_link')
            }
        else:
            return {"status": "error", "message": "Gagal upload ke Drive. Cek izin akses."}

    except Exception as e:
        print(f"Export Error: {e}")
        return {"status": "error", "message": str(e)}

# ... (Endpoint History, Ratings, Delete Account tetap sama) ...
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
