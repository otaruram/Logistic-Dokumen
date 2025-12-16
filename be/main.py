from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import numpy as np
from PIL import Image
import io
import pandas as pd
from datetime import datetime
import os
import traceback
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# MODULE LOKAL
from db import prisma, connect_db, disconnect_db
from utils import get_user_email_from_token
from drive_service import export_to_google_drive_with_token, upload_image_to_drive
from smart_ocr_processor import SmartOCRProcessor
from pricing_service import CreditService
from pricing_endpoints import router as pricing_router

load_dotenv()
smart_ocr = None
credit_service = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting Server...")
    await connect_db()
    
    global smart_ocr, credit_service
    # Masukkan API Key OCR Space kamu di .env: OCR_SPACE_API_KEY=...
    smart_ocr = SmartOCRProcessor(os.getenv('OCR_SPACE_API_KEY', 'helloworld'))
    credit_service = CreditService()
    
    yield
    await disconnect_db()

app = FastAPI(lifespan=lifespan)

# Setup Folder
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Ganti "*" dengan domain frontendmu untuk keamanan nanti
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pricing_router, prefix="/api/pricing")

# --- OCR HELPER ---
async def extract_text_from_image(image_np):
    try:
        if smart_ocr:
            text = await smart_ocr.enhanced_ocr_extract(image_np)
            if text and not text.startswith("[ERROR"):
                doc_type = smart_ocr.detect_document_type(text)
                structured = smart_ocr.extract_structured_data(text, doc_type)
                summary = smart_ocr.generate_smart_summary(text, structured, doc_type)
                return {
                    "raw_text": text, "summary": summary,
                    "document_type": doc_type, "structured_data": structured
                }
        return {"raw_text": "", "summary": "Gagal Baca Teks", "document_type": "error"}
    except Exception as e:
        return {"raw_text": str(e), "summary": "Error Sistem", "document_type": "error"}

# --- ENDPOINTS ---

@app.get("/health")
def health(): return {"status": "ok", "db": prisma.is_connected()}

@app.post("/scan")
async def scan_document(
    file: UploadFile = File(...), 
    receiver: str = Form(...),
    authorization: str = Header(None)
):
    try:
        user_email = get_user_email_from_token(authorization)
        remaining_credits = 0

        # 1. Cek & Reset Kredit Harian
        if prisma.is_connected():
            # Ini otomatis reset kredit ke 3 jika hari berganti
            credits = await credit_service.get_user_credits(user_email, prisma)
            remaining_credits = credits
            
            if credits < 1:
                return {
                    "status": "error", "error_type": "insufficient_credits",
                    "message": "Kredit habis. Tunggu besok untuk reset otomatis ke 3.",
                    "remaining_credits": 0
                }

        # 2. Proses OCR
        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        ocr_res = await extract_text_from_image(image_np)

        # 3. Klasifikasi & Data Extraction
        doc_data = ocr_res.get("structured_data", {})
        # Fallback biar LOG TIDAK NULL
        nomor_dokumen = (
            doc_data.get('invoice_number') or 
            doc_data.get('do_number') or 
            doc_data.get('po_number') or 
            "MANUAL CHECK"
        )
        
        # Mapping Kategori
        tipe_doc = ocr_res.get("document_type", "unknown")
        kategori = "DOKUMEN"
        if tipe_doc == "invoice": kategori = "INVOICE"
        elif tipe_doc == "delivery_note": kategori = "SURAT JALAN"
        elif tipe_doc == "purchase_order": kategori = "PO"

        # 4. Simpan File
        filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f: f.write(content)
        
        # URL Gambar
        BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
        if os.getenv("ENVIRONMENT") == "production": BASE_URL = "https://api-ocr.xyz"
        image_url = f"{BASE_URL}/uploads/{filename}"

        # 5. Simpan ke Database
        log_id = 0
        if prisma.is_connected():
            # Pastikan user ada sebelum insert log
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user:
                await credit_service.ensure_default_credits(user_email, prisma)

            # Insert Log
            log = await prisma.logs.create(data={
                "userId": user_email,
                "timestamp": datetime.now(),
                "filename": file.filename,
                "kategori": kategori,
                "nomorDokumen": nomor_dokumen,
                "receiver": receiver.upper(),
                "imagePath": image_url,
                "summary": ocr_res.get("summary", "Ringkasan tidak tersedia"),
                "fullText": ocr_res.get("raw_text", "")
            })
            log_id = log.id

            # Potong Kredit
            new_bal = await credit_service.deduct_credits(user_email, 1, f"Scan #{log_id}", prisma)
            if new_bal is not None: remaining_credits = new_bal

        return {
            "status": "success",
            "data": {
                "id": log_id, "kategori": kategori, "nomorDokumen": nomor_dokumen,
                "summary": ocr_res.get("summary", ""), "imagePath": image_url
            },
            "remaining_credits": remaining_credits
        }

    except Exception as e:
        print(f"Scan Error: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}

@app.get("/history")
async def get_history(authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        if prisma.is_connected():
            logs = await prisma.logs.find_many(where={"userId": user_email}, order={"id": "desc"})
            return [{
                "id": l.id, "timestamp": l.timestamp.isoformat(),
                "kategori": l.kategori, "nomorDokumen": l.nomorDokumen,
                "receiver": l.receiver, "imagePath": l.imagePath,
                "summary": l.summary
            } for l in logs]
        return []
    except: return []

# 🔥 FIX ENDPOINT EXPORT DRIVE 🔥
@app.get("/export")
async def export_excel(authorization: str = Header(None), upload_to_drive: bool = True):
    try:
        user_email = get_user_email_from_token(authorization)
        token = authorization.replace("Bearer ", "")

        if not prisma.is_connected(): raise HTTPException(503, "DB Offline")
        
        # Ambil semua log user
        logs = await prisma.logs.find_many(where={"userId": user_email}, order={"id": "desc"})
        if not logs:
            return {"status": "error", "message": "Tidak ada data log untuk diexport"}

        # Buat Data Excel
        data = [{
            "Tanggal": l.timestamp.strftime("%Y-%m-%d %H:%M"),
            "Kategori": l.kategori,
            "Nomor Dokumen": l.nomorDokumen,
            "Penerima": l.receiver,
            "Ringkasan": l.summary,
            "URL Foto": l.imagePath
        } for l in logs]

        df = pd.DataFrame(data)
        filename = f"Report_{user_email}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        
        # Simpan Excel sementara
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False)
        buffer.seek(0)
        file_content = buffer.getvalue()

        # Upload ke Google Drive
        if upload_to_drive and token:
            try:
                # Fungsi ini ada di drive_service.py kamu
                drive_res = export_to_google_drive_with_token(token, file_content, filename)
                return {
                    "status": "success", 
                    "drive_url": drive_res.get('web_view_link', '#'),
                    "folder_name": drive_res.get('folder_name', 'Drive')
                }
            except Exception as drive_error:
                print(f"Drive Upload Error: {drive_error}")
                # Jika gagal upload drive, return file biasa
                return FileResponse(path=filepath, filename=filename) # Fallback logic needed here if file saved

        # Jika tidak upload drive, return file download
        # (Simplified for now to force Drive focus)
        return {"status": "error", "message": "Gagal koneksi ke Google Drive"}

    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
