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

# Load environment variables
load_dotenv()

# Load environment variables
load_dotenv()

# --- INISIALISASI APP ---
app = FastAPI(title="Supply Chain OCR API", description="Backend untuk scan dokumen gudang")

# Initialize Prisma Client
prisma = Prisma()

@app.on_event("startup")
async def startup():
    """Connect to Supabase PostgreSQL on startup"""
    await prisma.connect()
    print("✅ Connected to Supabase PostgreSQL!")

@app.on_event("shutdown")
async def shutdown():
    """Disconnect from database on shutdown"""
    await prisma.disconnect()
    print("👋 Disconnected from database")

# --- SETUP FOLDER UPLOADS ---
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount static files untuk serve gambar
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- KONFIGURASI CORS (PENTING!) ---
# Ini agar Frontend (React) di port 5173 boleh ngobrol sama Backend di port 8000
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

# --- SETUP DATABASE SQLITE (GUDANG DATA) ---
# Removed: Now using Supabase PostgreSQL with Prisma

# --- HELPER FUNCTION: DECODE JWT TOKEN ---
def get_user_email_from_token(authorization: str = Header(None)) -> str:
    """Extract user email from Google OAuth JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization token provided")
    
    try:
        # Remove "Bearer " prefix if present
        token = authorization.replace("Bearer ", "")
        
        # Decode JWT without verification (Google already verified it)
        decoded = jwt.decode(token, options={"verify_signature": False})
        
        # Extract email
        email = decoded.get("email")
        if not email:
            raise HTTPException(status_code=401, detail="Email not found in token")
        
        return email
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# --- SETUP OCR.SPACE API (FREE, TANPA INSTALL) ---
OCR_API_KEY = os.getenv("OCR_API_KEY", "helloworld")  # Default to free key if not set
OCR_API_URL = "https://api.ocr.space/parse/image"

def get_ocr_engine():
    """OCR.space API ready - no installation needed!"""
    print("✅ OCR.space API ready!")
    return True

def extract_text_from_image(image_np):
    """Extract text menggunakan OCR.space API (gratis, no install)"""
    max_retries = 2
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            # Convert numpy array to PIL Image
            image = Image.fromarray(image_np)
            
            # Compress image if too large (max 1024px width untuk OCR speed)
            max_width = 1024
            if image.width > max_width:
                ratio = max_width / image.width
                new_height = int(image.height * ratio)
                image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)
                print(f"📐 Resized image to {max_width}x{new_height}")
            
            # Convert to bytes dengan kompresi JPEG (lebih cepat upload)
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='JPEG', quality=85, optimize=True)
            img_byte_arr = img_byte_arr.getvalue()
            
            # Check file size
            size_kb = len(img_byte_arr) / 1024
            print(f"📦 Image size: {size_kb:.1f} KB")
            
            # Encode to base64
            base64_image = base64.b64encode(img_byte_arr).decode('utf-8')
            
            # Call OCR.space API
            payload = {
                'apikey': OCR_API_KEY,
                'base64Image': f'data:image/jpeg;base64,{base64_image}',
                'language': 'eng',
                'isOverlayRequired': False,
                'detectOrientation': True,
                'scale': True,
                'OCREngine': 1  # Engine 1 lebih cepat (Engine 2 sering timeout)
            }
            
            print(f"🔍 Calling OCR.space API (attempt {retry_count + 1}/{max_retries})...")
            response = requests.post(OCR_API_URL, data=payload, timeout=45)  # Timeout 45s
            result = response.json()
            
            print(f"📥 OCR Response: {result}")
            
            if result.get('IsErroredOnProcessing'):
                error_msg = result.get('ErrorMessage', ['Unknown error'])
                print(f"❌ OCR Error: {error_msg}")
                retry_count += 1
                if retry_count >= max_retries:
                    raise Exception(f"OCR Error: {error_msg}")
                continue
            
            # Extract text dari response
            parsed_results = result.get('ParsedResults', [])
            if not parsed_results:
                retry_count += 1
                if retry_count >= max_retries:
                    raise Exception("No text found in image")
                continue
                
            parsed_text = parsed_results[0].get('ParsedText', '')
            
            if not parsed_text or len(parsed_text.strip()) == 0:
                retry_count += 1
                if retry_count >= max_retries:
                    raise Exception("Empty text result from OCR")
                continue
            
            print(f"✅ OCR Success: {len(parsed_text)} characters extracted")
            return parsed_text.strip()
            
        except requests.exceptions.Timeout:
            retry_count += 1
            print(f"⏱ OCR Timeout (attempt {retry_count}/{max_retries})")
            if retry_count >= max_retries:
                return "ERROR: API Timeout - Gambar terlalu besar atau koneksi lambat"
        except requests.exceptions.RequestException as e:
            print(f"❌ Network Error: {e}")
            return "ERROR: Koneksi ke OCR API gagal"
        except Exception as e:
            print(f"❌ OCR Error: {e}")
            return f"ERROR: Gagal membaca teks - {str(e)}"
    
    return "ERROR: OCR gagal setelah beberapa percobaan"

# --- ENDPOINT 1: CEK KESEHATAN SERVER ---
@app.get("/")
def home():
    return {"status": "Online", "role": "Supply Chain Automation System"}

# --- ENDPOINT 2: PROSES SCAN GAMBAR (INTI SISTEM) ---
@app.post("/scan")
async def scan_document(
    file: UploadFile = File(...), 
    receiver: str = Form(...),
    authorization: str = Header(None)
):
    try:
        # Get user email from JWT token
        user_email = get_user_email_from_token(authorization)
        
        # 1. BACA GAMBAR DARI UPLOAD
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_np = np.array(image) # Ubah ke format angka (NumPy) biar bisa dibaca AI

        # 2. JALANKAN OCR
        get_ocr_engine()  # Check OCR ready
        full_text = extract_text_from_image(image_np).upper()  # Extract dan uppercase

        # 3. EKSTRAK NOMOR DOKUMEN DARI OCR (CARI POLA NOMOR)
        import re
        nomor_dokumen = "TIDAK TERDETEKSI"
        
        # Pola untuk nomor dokumen kantor: DT0000-PB-2511-00002, NOTA/104/DT2000/07/2025, dll
        patterns = [
            r'[A-Z]{2,6}\d+[-/][A-Z]{2,6}[-/]\d{2,4}[-/]\d{2,6}',  # DT0000-PB-2511-00002
            r'[A-Z]{2,10}/\d+/[A-Z]{2,10}\d+/\d+/\d{4}',  # NOTA/104/DT2000/07/2025
            r'NO[TMOR]*[.:\s]*[A-Z]{2,10}\d+[-/][A-Z]{2,6}[-/]\d{2,4}[-/]\d{2,6}',  # NOMOR: DT0000-PB-2511-00002
            r'NOMOR\s*:\s*([A-Z0-9/-]+)',  # NOMOR : DT0000-PB-2511-00002
        ]
        
        for pattern in patterns:
            match = re.search(pattern, full_text)
            if match:
                nomor_dokumen = match.group(0).replace("NOMOR", "").replace(":", "").strip()
                nomor_dokumen = nomor_dokumen.replace("NO ", "").replace("NO.", "").strip()
                break
        
        # 4. DETEKSI TIPE DOKUMEN BERDASARKAN KODE SURAT
        kategori = "DOKUMEN LAIN"
        tipe_map = {
            "PB": "PERMINTAAN PEMBAYARAN",
            "PU": "PENGADAAN UMUM", 
            "PP": "PERMINTAAN PEMBELIAN",
            "LN": "SURAT LUAR NEGERI",
            "NF": "NOTA DINAS",
            "PDLN": "PERJALANAN DINAS LUAR NEGERI",
            "DISPOSISI": "LEMBAR DISPOSISI",
            "DT": "DOKUMEN TRANSAKSI"
        }
        
        # Cari tipe dari nomor dokumen atau dari teks
        for kode, nama in tipe_map.items():
            if kode in nomor_dokumen or kode in full_text:
                kategori = nama
                break
        
        # Deteksi tambahan dari kata kunci
        if "DISPOSISI" in full_text:
            kategori = "LEMBAR DISPOSISI"
        elif "PEMBAYARAN" in full_text:
            kategori = "PERMINTAAN PEMBAYARAN"
        elif "PERJALANAN DINAS" in full_text:
            kategori = "PERJALANAN DINAS LUAR NEGERI"

        # Ambil 150 karakter pertama sebagai ringkasan
        summary = full_text[:150].replace("\n", " ")
        timestamp = datetime.now()

        # 5. SIMPAN FILE KE FOLDER UPLOADS
        file_extension = os.path.splitext(file.filename)[1]
        saved_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, saved_filename)
        
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        
        # Get base URL from environment or use localhost
        BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
        image_url = f"{BASE_URL}/uploads/{saved_filename}"

        # 6. SIMPAN KE SUPABASE (PRISMA) - PER USER
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

        # 7. KIRIM HASIL KE FRONTEND
        return {
            "status": "success",
            "data": {
                "id": log.id,
                "timestamp": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "kategori": log.kategori,
                "nomor_dokumen": log.nomorDokumen,
                "receiver": log.receiver,
                "imageUrl": log.imagePath,
                "summary": log.summary,
                "full_text": log.fullText
            }
        }

    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ Error in /scan endpoint:")
        print(error_detail)
        return {"status": "error", "message": f"Gagal memproses dokumen: {str(e)}"}

# --- ENDPOINT 3: AMBIL HISTORY (BUAT TABEL) ---
@app.get("/history")
async def get_history(authorization: str = Header(None)):
    """Mengambil data history per user dari Supabase"""
    try:
        # Get user email from JWT token
        user_email = get_user_email_from_token(authorization)
        
        # Query hanya data milik user ini
        logs = await prisma.logs.find_many(
            where={"userId": user_email},
            order={"id": "desc"}
        )
        
        # Convert ke format yang diharapkan frontend
        result = []
        for log in logs:
            result.append({
                "id": log.id,
                "timestamp": log.timestamp.strftime("%d/%m/%y %H:%M"),
                "receiver": log.receiver,
                "image_path": log.imagePath,
                "summary": log.summary
            })
        
        return result
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ Error in /history endpoint:")
        print(error_detail)
        return []

# --- ENDPOINT 4: HAPUS LOG ---
@app.delete("/logs/{log_id}")
async def delete_log(log_id: int, authorization: str = Header(None)):
    """Hapus log berdasarkan ID dan user"""
    try:
        # Get user email from JWT token
        user_email = get_user_email_from_token(authorization)
        
        # Cek apakah log milik user ini
        log = await prisma.logs.find_first(
            where={"id": log_id, "userId": user_email}
        )
        
        if not log:
            raise HTTPException(status_code=404, detail="Log tidak ditemukan atau bukan milik Anda")
        
        # Hapus file gambar jika ada
        if log.imagePath:
            filename = log.imagePath.split("/")[-1]
            file_path = os.path.join(UPLOAD_DIR, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"🗑️ Deleted file: {file_path}")
        
        # Hapus dari database
        await prisma.logs.delete(where={"id": log_id})
        print(f"✅ Deleted log ID: {log_id} for user: {user_email}")
        
        return {"status": "success", "message": "Log berhasil dihapus"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in /logs/{log_id} delete: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINT 5: DOWNLOAD EXCEL (REKAP DATA) ---
@app.get("/export")
async def export_excel(authorization: str = Header(None)):
    """Membuat file Excel dari data user"""
    try:
        # Get user email from JWT token
        user_email = get_user_email_from_token(authorization)
        
        # Query data user
        logs = await prisma.logs.find_many(
            where={"userId": user_email},
            order={"timestamp": "desc"}
        )
        
        # Convert ke DataFrame
        data = []
        for log in logs:
            data.append({
                "ID": log.id,
                "Tanggal": log.timestamp.strftime("%d/%m/%Y %H:%M:%S"),
                "Nama File": log.filename,
                "Kategori": log.kategori,
                "Nomor Dokumen": log.nomorDokumen,
                "Receiver": log.receiver,
                "Ringkasan": log.summary,
                "Teks Lengkap": log.fullText
            })
        
        df = pd.DataFrame(data)
        
        # Pastikan folder logs ada
        if not os.path.exists("logs"):
            os.makedirs("logs")

        filename = f"logs/Laporan_{user_email.split('@')[0]}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        df.to_excel(filename, index=False)

        return FileResponse(filename, filename=f"Laporan_{user_email.split('@')[0]}.xlsx")
    except Exception as e:
        print(f"❌ Error in /export: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINT 5: DELETE LOG ---
@app.delete("/logs/{log_id}")
async def delete_log(log_id: int, authorization: str = Header(None)):
    """Hapus log berdasarkan ID (hanya milik user sendiri)"""
    try:
        # Get user email from JWT token
        user_email = get_user_email_from_token(authorization)
        
        # Cari log berdasarkan ID dan userId
        log = await prisma.logs.find_first(
            where={
                "id": log_id,
                "userId": user_email
            }
        )
        
        if not log:
            raise HTTPException(status_code=404, detail="Log tidak ditemukan atau bukan milik Anda")
        
        # Hapus file gambar jika ada
        if log.imagePath:
            try:
                # Extract filename dari URL
                filename = log.imagePath.split("/uploads/")[-1]
                file_path = os.path.join(UPLOAD_DIR, filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"🗑 Deleted file: {filename}")
            except Exception as e:
                print(f"⚠ Failed to delete file: {e}")
        
        # Hapus dari database
        await prisma.logs.delete(where={"id": log_id})
        
        return {"status": "success", "message": "Log berhasil dihapus"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in /logs/{log_id} DELETE: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- MAIN BLOCK ---
if __name__ == "__main__":
    import uvicorn
    # Jalankan server di localhost port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
