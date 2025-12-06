# backend/main.py

# --- IMPORT LIBRARY ---
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import easyocr
import numpy as np
from PIL import Image
import io
import sqlite3
import pandas as pd
from datetime import datetime
import os
import shutil

# --- INISIALISASI APP ---
app = FastAPI(title="Supply Chain OCR API", description="Backend untuk scan dokumen gudang")

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
DB_NAME = "supply_chain.db"

def init_db():
    """Membuat tabel database jika belum ada (Hanya jalan sekali di awal)"""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    # Kita buat tabel 'logs' untuk menyimpan riwayat scan
    c.execute('''
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            filename TEXT,
            kategori TEXT,
            nomor_dokumen TEXT,
            receiver TEXT,
            image_path TEXT,
            summary TEXT,
            full_text TEXT
        )
    ''')
    conn.commit()
    conn.close()

# Jalankan fungsi database saat server nyala
init_db()

# --- SETUP AI (EASYOCR) ---
# Kita pakai variabel global agar model dimuat sekali saja
reader = None

def get_ocr_engine():
    """Fungsi Lazy Loading: Model baru dimuat saat dipanggil agar server ringan"""
    global reader
    if reader is None:
        print("⏳ Sedang memuat model AI (EasyOCR)... Tunggu sebentar...")
        # gpu=False karena kita pakai laptop biasa (CPU)
        reader = easyocr.Reader(['id', 'en'], gpu=False)
        print("✅ Model AI Siap!")
    return reader

# --- ENDPOINT 1: CEK KESEHATAN SERVER ---
@app.get("/")
def home():
    return {"status": "Online", "role": "Supply Chain Automation System"}

# --- ENDPOINT 2: PROSES SCAN GAMBAR (INTI SISTEM) ---
@app.post("/scan")
async def scan_document(file: UploadFile = File(...), receiver: str = Form(...)):
    try:
        # Pastikan tabel logs ada sebelum insert
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                filename TEXT,
                kategori TEXT,
                nomor_dokumen TEXT,
                receiver TEXT,
                image_path TEXT,
                summary TEXT,
                full_text TEXT
            )
        ''')
        conn.commit()
        conn.close()
        
        # 1. BACA GAMBAR DARI UPLOAD
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_np = np.array(image) # Ubah ke format angka (NumPy) biar bisa dibaca AI

        # 2. JALANKAN OCR
        model = get_ocr_engine()
        result = model.readtext(image_np, detail=0) # detail=0 cuma ambil teksnya
        full_text = " ".join(result).upper() # Gabung jadi satu paragraf besar

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
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 5. SIMPAN FILE KE FOLDER UPLOADS
        file_extension = os.path.splitext(file.filename)[1]
        saved_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, saved_filename)
        
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        
        # Get base URL from environment or use localhost
        BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
        image_url = f"{BASE_URL}/uploads/{saved_filename}"

        # 6. SIMPAN KE DATABASE (PERSISTENT)
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("INSERT INTO logs (timestamp, filename, kategori, nomor_dokumen, receiver, image_path, summary, full_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                  (timestamp, file.filename, kategori, nomor_dokumen, receiver.upper(), image_url, summary, full_text))
        conn.commit()
        last_id = c.lastrowid # Ambil ID data yang baru masuk
        conn.close()

        # 7. KIRIM HASIL KE FRONTEND
        return {
            "status": "success",
            "data": {
                "id": last_id,
                "timestamp": timestamp,
                "kategori": kategori,
                "nomor_dokumen": nomor_dokumen,
                "receiver": receiver.upper(),
                "imageUrl": image_url,
                "summary": summary,
                "full_text": full_text
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
def get_history():
    """Mengambil semua data lama dari database"""
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        
        # Pastikan tabel logs ada
        c.execute('''
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                filename TEXT,
                kategori TEXT,
                nomor_dokumen TEXT,
                receiver TEXT,
                image_path TEXT,
                summary TEXT,
                full_text TEXT
            )
        ''')
        conn.commit()
        
        # Ambil data menggunakan cursor langsung
        c.execute("SELECT id, timestamp, receiver, image_path, summary FROM logs ORDER BY id DESC")
        rows = c.fetchall()
        conn.close()
        
        # Convert ke list of dictionaries
        result = []
        for row in rows:
            result.append({
                "id": row[0],
                "timestamp": row[1],
                "receiver": row[2],
                "image_path": row[3],
                "summary": row[4]
            })
        
        return result
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ Error in /history endpoint:")
        print(error_detail)
        return []

# --- ENDPOINT 4: DOWNLOAD EXCEL (REKAP DATA) ---
@app.get("/export")
def export_excel():
    """Membuat file Excel dari seluruh database"""
    conn = sqlite3.connect(DB_NAME)
    df = pd.read_sql_query("SELECT * FROM logs", conn)
    conn.close()

    # Pastikan folder logs ada
    if not os.path.exists("logs"):
        os.makedirs("logs")

    filename = f"logs/Laporan_Gudang_{datetime.now().strftime('%Y%m%d')}.xlsx"
    df.to_excel(filename, index=False)

    return FileResponse(filename, filename="Laporan_Stok.xlsx")

# --- MAIN BLOCK ---
if __name__ == "__main__":
    import uvicorn
    # Jalankan server di localhost port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
