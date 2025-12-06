# backend/main.py

# --- IMPORT LIBRARY ---
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import requests
import base64
import numpy as np
from PIL import Image
import io
import pandas as pd
from datetime import datetime
import os
import shutil
import jwt
from prisma import Prisma
from dotenv import load_dotenv
import re
import traceback

# Load environment variables
load_dotenv()

# --- INISIALISASI APP ---
app = FastAPI(title="Supply Chain OCR API", description="Backend untuk scan dokumen gudang")

# Initialize Prisma Client
prisma = Prisma()

@app.on_event("startup")
async def startup():
    """Connect to Supabase PostgreSQL on startup"""
    try:
        await prisma.connect()
        print("✅ Connected to Supabase PostgreSQL!")
    except Exception as e:
        print(f"❌ Failed to connect to DB: {e}")

@app.on_event("shutdown")
async def shutdown():
    """Disconnect from database on shutdown"""
    if prisma.is_connected():
        await prisma.disconnect()
        print("👋 Disconnected from database")

# --- SETUP FOLDER UPLOADS ---
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount static files untuk serve gambar
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- KONFIGURASI CORS ---
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8080")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:8080",
        "https://ocrai.vercel.app",
        FRONTEND_URL,
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- HELPER: DECODE JWT TOKEN ---
def get_user_email_from_token(authorization: str = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization token provided")
    try:
        token = authorization.replace("Bearer ", "")
        # Decode tanpa verify signature (karena validasi dilakukan di frontend via Google)
        decoded = jwt.decode(token, options={"verify_signature": False})
        email = decoded.get("email")
        if not email:
            raise HTTPException(status_code=401, detail="Email not found in token")
        return email
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# --- HELPER: OCR ENGINE (OCR.SPACE) ---
OCR_API_KEY = os.getenv("OCR_API_KEY", "helloworld") # Ganti di .env biar limitnya gede
OCR_API_URL = "https://api.ocr.space/parse/image"

def extract_text_from_image(image_np):
    """Kirim gambar ke OCR.space API"""
    try:
        # 1. Convert Numpy ke Base64 Image
        image = Image.fromarray(image_np)
        
        # Resize jika kegedean biar cepet
        max_width = 1024
        if image.width > max_width:
            ratio = max_width / image.width
            new_height = int(image.height * ratio)
            image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)

        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG', quality=85)
        img_byte_arr = img_byte_arr.getvalue()
        base64_image = base64.b64encode(img_byte_arr).decode('utf-8')

        # 2. Request ke API Luar
        payload = {
            'apikey': OCR_API_KEY,
            'base64Image': f'data:image/jpeg;base64,{base64_image}',
            'language': 'eng',
            'isOverlayRequired': False,
            'scale': True,
            'OCREngine': 1
        }
        
        print("🔍 Sending to OCR.space...")
        response = requests.post(OCR_API_URL, data=payload, timeout=30)
        result = response.json()

        # 3. Parsing Hasil
        if result.get('IsErroredOnProcessing'):
            raise Exception(result.get('ErrorMessage'))
            
        parsed_results = result.get('ParsedResults', [])
        if parsed_results:
            return parsed_results[0].get('ParsedText', '').strip()
        
        return ""
        
    except Exception as e:
        print(f"❌ OCR Failed: {e}")
        # Fallback: Kembalikan string kosong atau error biar user tau
        return f"[ERROR BACA TEKS: {str(e)}]"

# --- ENDPOINTS ---

@app.get("/")
def home():
    return {"status": "Online", "backend": "FastAPI + OCR.space + Supabase"}

@app.post("/scan")
async def scan_document(
    file: UploadFile = File(...), 
    receiver: str = Form(...),
    authorization: str = Header(None)
):
    try:
        user_email = get_user_email_from_token(authorization)
        
        # 1. Baca File
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_np = np.array(image)

        # 2. Proses OCR (Via API)
        full_text = extract_text_from_image(image_np).upper()

        # 3. Analisa Regex Nomor Dokumen
        nomor_dokumen = "TIDAK TERDETEKSI"
        patterns = [
            r'[A-Z]{2,6}\d+[-/][A-Z]{2,6}[-/]\d{2,4}[-/]\d{2,6}',
            r'NOMOR\s*:\s*([A-Z0-9/-]+)',
            r'NO\.\s*([A-Z0-9/-]+)'
        ]
        for p in patterns:
            match = re.search(p, full_text)
            if match:
                # Ambil group 1 jika ada, atau group 0
                nomor_dokumen = match.group(1) if match.lastindex else match.group(0)
                nomor_dokumen = nomor_dokumen.replace(":", "").strip()
                break

        # 4. Kategori Logistik
        kategori = "DOKUMEN LAIN"
        keywords = {
            "INVOICE": "INVOICE",
            "TAGIHAN": "INVOICE",
            "SURAT JALAN": "SURAT JALAN",
            "DELIVERY": "SURAT JALAN",
            "PO": "PURCHASE ORDER",
            "BERITA ACARA": "BERITA ACARA",
            "PEMBAYARAN": "PERMINTAAN PEMBAYARAN"
        }
        for key, val in keywords.items():
            if key in full_text:
                kategori = val
                break

        summary = full_text[:200].replace("\n", " ")
        timestamp = datetime.now()

        # 5. Simpan File Lokal (PERINGATAN: Di Render Free, ini hilang kalau restart)
        saved_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, saved_filename)
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        
        # Construct URL gambar
        BASE_URL = os.getenv("BASE_URL", "http://localhost:8000") # Setup di Render Env Vars!
        image_url = f"{BASE_URL}/uploads/{saved_filename}"

        # 6. Simpan ke Database
        log = await prisma.logs.create(
            data={
                "userId": user_email,
                "timestamp": timestamp,
                "filename": file.filename,
                "kategori": kategori,
                "nomorDokumen": nomor_dokumen,
                "receiver": receiver.upper(),
                "imagePath": image_url,
                "summary": summary,
                "fullText": full_text
            }
        )

        return {
            "status": "success",
            "data": {
                "id": log.id,
                "kategori": log.kategori,
                "nomor": log.nomorDokumen,
                "summary": log.summary,
                "image": log.imagePath
            }
        }

    except Exception as e:
        print(f"Global Error: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}

@app.get("/history")
async def get_history(authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        logs = await prisma.logs.find_many(
            where={"userId": user_email},
            order={"id": "desc"}
        )
        return logs
    except Exception as e:
        return []

@app.delete("/logs/{log_id}")
async def delete_log(log_id: int, authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        
        # Cek kepemilikan
        log = await prisma.logs.find_first(
            where={"id": log_id, "userId": user_email}
        )
        if not log:
            raise HTTPException(status_code=404, detail="Log not found")

        # Hapus File Lokal
        if log.imagePath:
            fname = log.imagePath.split("/")[-1]
            local_path = os.path.join(UPLOAD_DIR, fname)
            if os.path.exists(local_path):
                os.remove(local_path)
        
        # Hapus DB
        await prisma.logs.delete(where={"id": log_id})
        return {"status": "success"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/export")
async def export_excel(authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        logs = await prisma.logs.find_many(
            where={"userId": user_email},
            order={"id": "desc"}
        )
        
        data = []
        for l in logs:
            data.append({
                "Tanggal": l.timestamp,
                "Kategori": l.kategori,
                "Nomor Dokumen": l.nomorDokumen,
                "Penerima": l.receiver,
                "Ringkasan": l.summary
            })
            
        df = pd.DataFrame(data)
        filename = f"Laporan_{user_email}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        df.to_excel(filename, index=False)
        
        return FileResponse(filename, filename=filename)

    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)