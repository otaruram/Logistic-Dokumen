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

# --- LIFESPAN (STARTUP) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting Server...")
    try:
        await connect_db() 
        print("✅ Database Connected")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")

    global smart_ocr, credit_service
    smart_ocr = SmartOCRProcessor(os.getenv('OCR_SPACE_API_KEY', 'helloworld'))
    credit_service = CreditService()
    
    yield
    
    await disconnect_db()
    print("🛑 Server Shutdown")

# --- APP DEFINITION ---
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

class LogUpdate(BaseModel):
    summary: str

@app.put("/logs/{log_id}")
async def update_log(log_id: int, log_data: LogUpdate, authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        if not prisma.is_connected(): await connect_db()
        log = await prisma.logs.find_first(where={"id": log_id, "userId": user_email})
        if not log: raise HTTPException(404, "Log tidak ditemukan")
        updated = await prisma.logs.update(where={"id": log_id}, data={"summary": log_data.summary})
        return {"status": "success", "data": updated}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/scan")
async def scan_document(
    file: UploadFile = File(...), 
    receiver: str = Form(...),
    authorization: str = Header(None)
):
    try:
        user_email = get_user_email_from_token(authorization)
        remaining_credits = 0

        if not prisma.is_connected(): await connect_db()
        
        credits = await credit_service.get_user_credits(user_email, prisma)
        remaining_credits = credits
        
        if credits < 1:
            return {"status": "error", "error_type": "insufficient_credits", "message": "Kredit habis.", "remaining_credits": 0}

        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        ocr_res = await extract_text_from_image(image_np)

        doc_data = ocr_res.get("structured_data", {})
        nomor_dokumen = (doc_data.get('invoice_number') or doc_data.get('do_number') or doc_data.get('po_number') or "MANUAL CHECK")
        
        tipe_doc = ocr_res.get("document_type", "unknown")
        kategori = "DOKUMEN"
        if tipe_doc == "invoice": kategori = "INVOICE"
        elif tipe_doc == "delivery_note": kategori = "SURAT JALAN"

        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        clean_filename = file.filename.replace(" ", "_")
        filename = f"{timestamp_str}_{clean_filename}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f: f.write(content)
        
        BASE_URL = os.getenv("BASE_URL", "http://localhost:8000") 
        if os.getenv("ENVIRONMENT") == "production": BASE_URL = "https://logistic-dokumen.onrender.com"
        image_url = f"{BASE_URL}/uploads/{filename}"

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
            "summary": ocr_res.get("summary", "Ringkasan tidak tersedia"),
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

@app.get("/history")
async def get_history(authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        if not prisma.is_connected(): await connect_db()
        logs = await prisma.logs.find_many(where={"userId": user_email}, order={"id": "desc"})
        return [{
            "id": l.id, "timestamp": l.timestamp.isoformat(),
            "kategori": l.kategori, "nomorDokumen": l.nomorDokumen,
            "receiver": l.receiver, "imagePath": l.imagePath,
            "summary": l.summary
        } for l in logs]
    except: return []

@app.delete("/logs/{log_id}")
async def delete_log(log_id: int, authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
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

# 🔥 ENDPOINT DELETE ACCOUNT (REFACTORED) 🔥
@app.delete("/delete-account")
async def delete_account(authorization: str = Header(None)):
    try:
        user_email = get_user_email_from_token(authorization)
        if not prisma.is_connected(): await connect_db()

        user = await prisma.user.find_unique(where={"email": user_email})
        if not user: raise HTTPException(404, "User tidak ditemukan")

        # 1. Hapus File Fisik
        user_logs = await prisma.logs.find_many(where={"userId": user_email})
        for log in user_logs:
            if log.imagePath:
                try:
                    filename = log.imagePath.split("/")[-1]
                    filepath = os.path.join(UPLOAD_DIR, filename)
                    if os.path.exists(filepath): os.remove(filepath)
                except: pass

        # 2. Hapus Data DB
        await prisma.credittransaction.delete_many(where={"userId": user.id})
        await prisma.logs.delete_many(where={"userId": user_email})
        await prisma.user.delete(where={"id": user.id})

        return {"status": "success", "message": "Akun berhasil dihapus permanen."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/export")
async def export_excel(authorization: str = Header(None), upload_to_drive: bool = True):
    try:
        user_email = get_user_email_from_token(authorization)
        token = authorization.replace("Bearer ", "")
        
        if not prisma.is_connected(): await connect_db()
        
        logs = await prisma.logs.find_many(where={"userId": user_email}, order={"id": "desc"})
        if not logs: return {"status": "error", "message": "Tidak ada data"}

        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='xlsxwriter') as writer:
            workbook = writer.book
            worksheet = workbook.add_worksheet("Log Harian")
            
            # Format Styles
            header_fmt = workbook.add_format({'bold': True, 'font_color': 'white', 'bg_color': '#000000', 'align': 'center', 'valign': 'vcenter', 'border': 1})
            center_fmt = workbook.add_format({'align': 'center', 'valign': 'vcenter', 'border': 1})
            left_fmt = workbook.add_format({'align': 'left', 'valign': 'vcenter', 'text_wrap': True, 'border': 1})
            link_fmt = workbook.add_format({'font_color': 'blue', 'underline': 1, 'align': 'center', 'valign': 'vcenter', 'border': 1})

            # Headers
            headers = ["NO", "TANGGAL", "JAM", "KATEGORI", "NOMOR DOKUMEN", "PENERIMA", "RINGKASAN", "FOTO"]
            for col, text in enumerate(headers): worksheet.write(0, col, text, header_fmt)
            
            worksheet.set_column('A:A', 5); worksheet.set_column('B:C', 15); worksheet.set_column('D:F', 20)
            worksheet.set_column('G:G', 50); worksheet.set_column('H:H', 15)

            for i, log in enumerate(logs):
                row = i + 1
                drive_link = log.imagePath
                
                # Logic Upload Image to Drive
                if upload_to_drive and token and log.imagePath and "drive.google.com" not in log.imagePath:
                    try:
                        fname = log.imagePath.split("/")[-1]
                        fpath = os.path.join(UPLOAD_DIR, fname)
                        if os.path.exists(fpath):
                            res = upload_image_to_drive(token, fpath, "OCR_IMAGES")
                            if res and res.get('web_view_link'): drive_link = res['web_view_link']
                    except: pass

                worksheet.write(row, 0, i + 1, center_fmt)
                worksheet.write(row, 1, log.timestamp.strftime("%Y-%m-%d"), center_fmt)
                worksheet.write(row, 2, log.timestamp.strftime("%H:%M"), center_fmt)
                worksheet.write(row, 3, log.kategori, center_fmt)
                worksheet.write(row, 4, log.nomorDokumen, center_fmt)
                worksheet.write(row, 5, log.receiver, center_fmt)
                worksheet.write(row, 6, log.summary, left_fmt)
                
                if "http" in drive_link: worksheet.write_url(row, 7, drive_link, link_fmt, string="Lihat Foto")
                else: worksheet.write(row, 7, drive_link, center_fmt)

        buffer.seek(0)
        file_content = buffer.getvalue()
        filename = f"Laporan_{datetime.now().strftime('%Y%m%d%H%M')}.xlsx"

        if upload_to_drive and token:
            try:
                drive_res = export_to_google_drive_with_token(token, file_content, filename)
                return {"status": "success", "drive_url": drive_res.get('web_view_link'), "folder_name": drive_res.get('folder_name')}
            except Exception as e: return {"status": "error", "message": f"Gagal ke Drive: {str(e)}"}

        return {"status": "error", "message": "Token tidak valid"}
    except Exception as e: return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
