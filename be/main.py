from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import numpy as np
from PIL import Image
import io
import pandas as pd
from datetime import datetime
import os
import traceback
import requests
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler

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
scheduler = None

# --- BACKGROUND TASK: RESET RATING BULANAN ---
async def monthly_rating_reset_task():
    try:
        if prisma.is_connected():
            await prisma.rating.delete_many()
            print("✅ All ratings reset for new month.")
    except Exception as e:
        print(f"❌ Error resetting ratings: {e}")

# --- LIFESPAN (STARTUP & SHUTDOWN) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting Server...")
    try:
        await connect_db() 
        print("✅ Database Connected")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")

    global smart_ocr, credit_service, scheduler
    smart_ocr = SmartOCRProcessor(os.getenv('OCR_SPACE_API_KEY', 'helloworld'))
    credit_service = CreditService()
    
    # Scheduler: Reset rating setiap tanggal 1 jam 00:00
    scheduler = AsyncIOScheduler()
    scheduler.add_job(monthly_rating_reset_task, "cron", day=1, hour=0, minute=0, timezone='Asia/Jakarta')
    scheduler.start()
    
    yield
    
    if scheduler: scheduler.shutdown()
    await disconnect_db()
    print("🛑 Server Shutdown")

# --- APP SETUP ---
app = FastAPI(lifespan=lifespan)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pricing_router, prefix="/api/pricing")

# --- HELPER FUNCTIONS ---

# Validasi Access Token (Untuk User Baru dengan Izin Drive)
def get_user_email_from_access_token(access_token):
    try:
        res = requests.get('https://www.googleapis.com/oauth2/v3/userinfo', headers={'Authorization': f'Bearer {access_token}'})
        if res.status_code == 200:
            return res.json().get('email')
    except: pass
    return None

async def extract_text_from_image(image_np):
    try:
        if smart_ocr:
            text = await smart_ocr.enhanced_ocr_extract(image_np)
            if text and not text.startswith("[ERROR"):
                doc_type = smart_ocr.detect_document_type(text)
                structured = smart_ocr.extract_structured_data(text, doc_type)
                summary = smart_ocr.generate_smart_summary(text, structured, doc_type)
                return {"raw_text": text, "summary": summary, "document_type": doc_type, "structured_data": structured}
        return {"raw_text": "", "summary": "Gagal Baca Teks", "document_type": "error"}
    except Exception as e:
        return {"raw_text": str(e), "summary": "Error Sistem", "document_type": "error"}

# --- MODELS ---
class RatingRequest(BaseModel):
    stars: int
    emoji: str
    message: str
    userName: str
    userAvatar: str

class LogUpdate(BaseModel):
    summary: str

# --- ENDPOINTS ---

@app.get("/health")
def health(): return {"status": "ok", "db": prisma.is_connected()}

# 1. RATING
@app.post("/rating")
async def create_rating(data: RatingRequest, authorization: str = Header(None)):
    try:
        # Coba validasi token (bisa JWT atau Access Token)
        token = authorization.replace("Bearer ", "").strip()
        user_email = None
        try: user_email = get_user_email_from_token(authorization) # Coba JWT
        except: user_email = get_user_email_from_access_token(token) # Coba Access Token
        
        if not user_email: 
             # Fallback: Rating boleh anonymous kalau token gagal? Atau strict?
             # Kita buat strict biar aman, tapi kalau gagal decode, pakai email dari request (kurang aman tapi jalan)
             user_email = "anonymous@ocr.wtf" 

        if not prisma.is_connected(): await connect_db()
        await prisma.rating.create(data={
            "userId": user_email,
            "userName": data.userName,
            "userAvatar": data.userAvatar,
            "stars": data.stars,
            "emoji": data.emoji,
            "message": data.message
        })
        return {"status": "success", "message": "Rating terkirim!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/ratings")
async def get_ratings():
    try:
        if not prisma.is_connected(): await connect_db()
        ratings = await prisma.rating.find_many(take=50, order={"createdAt": "desc"})
        return {"status": "success", "data": ratings}
    except Exception as e:
        return {"status": "error", "data": []}

# 2. SCANNING
@app.post("/scan")
async def scan_document(
    file: UploadFile = File(...), 
    receiver: str = Form(...),
    authorization: str = Header(None)
):
    try:
        # Validasi Token Hybrid
        token = authorization.replace("Bearer ", "").strip()
        user_email = None
        try: user_email = get_user_email_from_token(authorization)
        except: user_email = get_user_email_from_access_token(token)
        
        if not user_email: return {"status": "error", "message": "Login diperlukan"}

        remaining_credits = 0
        if not prisma.is_connected(): await connect_db()
        
        # Cek Kredit
        credits = await credit_service.get_user_credits(user_email, prisma)
        remaining_credits = credits
        if credits < 1:
            return {"status": "error", "error_type": "insufficient_credits", "message": "Kredit habis.", "remaining_credits": 0}

        # Proses File
        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        
        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
        filename = f"{timestamp_str}_{clean_name}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f: f.write(content)
        
        BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
        if os.getenv("ENVIRONMENT") == "production":
             BASE_URL = "https://logistic-dokumen.onrender.com"
        image_url = f"{BASE_URL}/uploads/{filename}"

        # OCR
        ocr_res = await extract_text_from_image(image_np)
        doc_data = ocr_res.get("structured_data", {})
        
        nomor_dokumen = doc_data.get('invoice_number') or doc_data.get('do_number') or "MANUAL CHECK"
        doc_type = ocr_res.get("document_type", "unknown")
        kategori = "DOKUMEN"
        if doc_type == "invoice": kategori = "INVOICE"
        elif doc_type == "delivery_note": kategori = "SURAT JALAN"

        # Simpan DB
        user = await prisma.user.find_unique(where={"email": user_email})
        if not user: await credit_service.ensure_default_credits(user_email, prisma)

        log = await prisma.logs.create(data={
            "userId": user_email,
            "timestamp": datetime.now(),
            "filename": file.filename,
            "kategori": kategori,
            "nomorDokumen": nomor_dokumen,
            "receiver": receiver.upper(),
            "imagePath": image_url,
            "summary": ocr_res.get("summary", "Ringkasan otomatis"),
            "fullText": ocr_res.get("raw_text", "")
        })

        new_bal = await credit_service.deduct_credits(user_email, 1, f"Scan #{log.id}", prisma)
        if new_bal is not None: remaining_credits = new_bal

        return {
            "status": "success",
            "data": {
                "id": log.id, "kategori": kategori, "nomorDokumen": nomor_dokumen,
                "summary": ocr_res.get("summary", ""), "imagePath": image_url
            },
            "remaining_credits": remaining_credits
        }
    except Exception as e:
        print(f"Scan Error: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}

# 3. HISTORY & LOGS
@app.get("/history")
async def get_history(authorization: str = Header(None)):
    try:
        token = authorization.replace("Bearer ", "").strip()
        user_email = None
        try: user_email = get_user_email_from_token(authorization)
        except: user_email = get_user_email_from_access_token(token)
        
        if not user_email: return []

        if not prisma.is_connected(): await connect_db()
        logs = await prisma.logs.find_many(where={"userId": user_email}, order={"id": "desc"})
        return [{
            "id": l.id, "timestamp": l.timestamp.isoformat(),
            "kategori": l.kategori, "nomorDokumen": l.nomorDokumen,
            "receiver": l.receiver, "imagePath": l.imagePath,
            "summary": l.summary
        } for l in logs]
    except: return []

@app.put("/logs/{log_id}")
async def update_log(log_id: int, log_data: LogUpdate, authorization: str = Header(None)):
    try:
        token = authorization.replace("Bearer ", "").strip()
        user_email = None
        try: user_email = get_user_email_from_token(authorization)
        except: user_email = get_user_email_from_access_token(token)
        
        if not prisma.is_connected(): await connect_db()
        updated = await prisma.logs.update(where={"id": log_id}, data={"summary": log_data.summary})
        return {"status": "success", "data": updated}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.delete("/logs/{log_id}")
async def delete_log(log_id: int, authorization: str = Header(None)):
    try:
        token = authorization.replace("Bearer ", "").strip()
        user_email = None
        try: user_email = get_user_email_from_token(authorization)
        except: user_email = get_user_email_from_access_token(token)
        
        if not prisma.is_connected(): await connect_db()
        log = await prisma.logs.find_first(where={"id": log_id, "userId": user_email})
        if not log: raise HTTPException(404, "Log not found")
        if log.imagePath:
            try:
                filename = log.imagePath.split("/")[-1]
                filepath = os.path.join(UPLOAD_DIR, filename)
                if os.path.exists(filepath): os.remove(filepath)
            except: pass
        await prisma.logs.delete(where={"id": log_id})
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

# 4. EXPORT ENDPOINT (SMART: DOWNLOAD / DRIVE)
@app.get("/export")
async def export_excel(authorization: str = Header(None), upload_to_drive: bool = False):
    try:
        # Validasi Hybrid (Support JWT & Access Token)
        token = authorization.replace("Bearer ", "").strip()
        user_email = None
        try:
             # Cek JWT dulu (Format ID Token)
             user_email = get_user_email_from_token(authorization)
        except:
             # Kalau gagal, cek Access Token ke Google
             user_email = get_user_email_from_access_token(token)

        if not user_email: return {"status": "error", "message": "Token Invalid / Expired"}
        
        if not prisma.is_connected(): await connect_db()
        logs = await prisma.logs.find_many(where={"userId": user_email}, order={"id": "desc"})
        
        if not logs: return {"status": "error", "message": "Tidak ada data."}

        # Bikin File Excel di Memory
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='xlsxwriter') as writer:
            workbook = writer.book
            worksheet = workbook.add_worksheet("Log Harian")
            
            fmt_header = workbook.add_format({'bold': True, 'bg_color': 'black', 'font_color': 'white', 'align': 'center', 'border': 1})
            fmt_center = workbook.add_format({'align': 'center', 'valign': 'vcenter', 'border': 1})
            fmt_left = workbook.add_format({'align': 'left', 'valign': 'vcenter', 'text_wrap': True, 'border': 1})
            fmt_link = workbook.add_format({'font_color': 'blue', 'underline': 1, 'align': 'center', 'border': 1})

            headers = ["NO", "TANGGAL", "JAM", "KATEGORI", "NOMOR", "PENERIMA", "RINGKASAN", "FOTO"]
            for col, txt in enumerate(headers): worksheet.write(0, col, txt, fmt_header)
            worksheet.set_column('G:G', 40) 

            for i, l in enumerate(logs):
                row = i + 1
                worksheet.write(row, 0, i+1, fmt_center)
                worksheet.write(row, 1, l.timestamp.strftime("%Y-%m-%d"), fmt_center)
                worksheet.write(row, 2, l.timestamp.strftime("%H:%M"), fmt_center)
                worksheet.write(row, 3, l.kategori, fmt_center)
                worksheet.write(row, 4, l.nomorDokumen, fmt_center)
                worksheet.write(row, 5, l.receiver, fmt_center)
                worksheet.write(row, 6, l.summary, fmt_left)
                
                link = l.imagePath
                # Upload foto on demand (hanya jika pakai Access Token Drive)
                if upload_to_drive and token and "drive" not in link and l.imagePath:
                     try:
                        fname = l.imagePath.split("/")[-1]
                        fpath = os.path.join(UPLOAD_DIR, fname)
                        if os.path.exists(fpath):
                            res = upload_image_to_drive(token, fpath, "OCR_IMAGES")
                            if res and res.get('web_view_link'): link = res['web_view_link']
                     except: pass

                if "http" in link: worksheet.write_url(row, 7, link, fmt_link, string="Lihat Foto")
                else: worksheet.write(row, 7, "-", fmt_center)

        buffer.seek(0)
        content = buffer.getvalue()
        filename = f"Laporan_{datetime.now().strftime('%Y%m%d%H%M')}.xlsx"

        # KEPUTUSAN: Upload ke Drive atau Download Biasa?
        if upload_to_drive:
            try:
                # Coba upload dengan token yang ada
                drive_res = export_to_google_drive_with_token(token, content, filename)
                if drive_res and drive_res.get('web_view_link'):
                    return {"status": "success", "drive_url": drive_res.get('web_view_link')}
                return {"status": "error", "message": "Gagal upload ke Drive (Respon kosong)."}
            except Exception as e:
                print(f"Drive Error: {e}")
                return {"status": "error", "message": "Gagal ke Drive (Token Expired?)."}
        else:
            # Download Biasa (Stream File)
            return Response(
                content=content, 
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )

    except Exception as e: return {"status": "error", "message": str(e)}

# 5. DELETE ACCOUNT
@app.delete("/delete-account")
async def delete_account(authorization: str = Header(None)):
    try:
        token = authorization.replace("Bearer ", "").strip()
        user_email = None
        try: user_email = get_user_email_from_token(authorization)
        except: user_email = get_user_email_from_access_token(token)
        
        if not prisma.is_connected(): await connect_db()
        user = await prisma.user.find_unique(where={"email": user_email})
        if not user: raise HTTPException(404, "User tidak ditemukan")
        
        user_logs = await prisma.logs.find_many(where={"userId": user_email})
        for log in user_logs:
            if log.imagePath:
                try:
                    filename = log.imagePath.split("/")[-1]
                    filepath = os.path.join(UPLOAD_DIR, filename)
                    if os.path.exists(filepath): os.remove(filepath)
                except: pass

        await prisma.rating.delete_many(where={"userId": user_email})
        await prisma.credittransaction.delete_many(where={"userId": user.id})
        await prisma.logs.delete_many(where={"userId": user_email})
        await prisma.user.delete(where={"id": user.id})
        return {"status": "success"}
    except Exception as e: return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
