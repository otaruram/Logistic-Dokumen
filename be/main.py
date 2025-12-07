# backend/main.py

# --- IMPORT LIBRARY ---
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List
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
import PyPDF2
from oki_chatbot import OKiChatbot
from drive_service import export_to_google_drive_with_token, upload_image_to_drive

# Load environment variables
load_dotenv()

# --- SUMOPOD CHATBOT CONFIGURATION ---
# Using SumoPoD API via OKiChatbot class (reads from .env)
oki_bot = OKiChatbot()

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

# Allow multiple domains
allowed_origins = [
    "http://localhost:8080",
    "http://localhost:8081",
    "https://ocrai.vercel.app",
    "https://ocr.wtf",
    "https://www.ocr.wtf",
    "*"  # Fallback for development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- HELPER: DECODE JWT TOKEN OR GET EMAIL FROM GOOGLE API ---
def get_user_email_from_token(authorization: str = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization token provided")
    try:
        token = authorization.replace("Bearer ", "")
        
        # Try to decode as JWT first (old login method)
        try:
            decoded = jwt.decode(token, options={"verify_signature": False})
            email = decoded.get("email")
            if email:
                return email
        except:
            # Not a JWT, might be an access token
            pass
        
        # If not JWT, try to get user info from Google API (new login with Drive scope)
        try:
            response = requests.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {token}'},
                timeout=5
            )
            if response.status_code == 200:
                user_info = response.json()
                email = user_info.get('email')
                if email:
                    return email
        except:
            pass
            
        raise HTTPException(status_code=401, detail="Could not extract email from token")
    except HTTPException as he:
        raise he
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
        
        # Convert RGBA to RGB if needed (fix for PNG with transparency)
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background
        
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
        
        # Construct URL gambar - Smart detection for dev/production
        ENVIRONMENT = os.getenv("ENVIRONMENT", "production")
        if ENVIRONMENT == "development":
            BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
        else:
            BASE_URL = os.getenv("PRODUCTION_URL", "https://logistic-dokumen.onrender.com")
        
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
                "timestamp": log.timestamp.isoformat(),
                "kategori": log.kategori,
                "nomorDokumen": log.nomorDokumen,
                "nomor_dokumen": log.nomorDokumen,  # Backward compatibility
                "receiver": log.receiver,
                "imagePath": log.imagePath,
                "imageUrl": log.imagePath,  # Backward compatibility
                "summary": log.summary,
                "fullText": log.fullText
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
        
        # Format response to ensure all fields are properly mapped
        formatted_logs = []
        for log in logs:
            formatted_logs.append({
                "id": log.id,
                "userId": log.userId,
                "timestamp": log.timestamp.isoformat(),
                "filename": log.filename,
                "kategori": log.kategori,
                "nomorDokumen": log.nomorDokumen,
                "receiver": log.receiver,
                "imagePath": log.imagePath,
                "summary": log.summary,
                "fullText": log.fullText
            })
        
        return formatted_logs
    except Exception as e:
        print(f"❌ History error: {str(e)}")
        traceback.print_exc()
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
async def export_excel(authorization: str = Header(None), upload_to_drive: bool = True):
    try:
        user_email = get_user_email_from_token(authorization)
        
        # Extract token for Google Drive
        token = authorization.replace("Bearer ", "") if authorization else None
        
        logs = await prisma.logs.find_many(
            where={"userId": user_email},
            order={"id": "desc"}
        )
        
        # Upload images to Google Drive first if enabled
        image_links = {}
        if upload_to_drive and token:
            folder_name = os.getenv('GOOGLE_DRIVE_FOLDER_NAME', 'LOGISTIC.AI Reports')
            images_folder = f"{folder_name}/Images"
            
            for l in logs:
                if l.imagePath:
                    # Extract filename from URL
                    fname = l.imagePath.split("/")[-1]
                    local_path = os.path.join(UPLOAD_DIR, fname)
                    
                    if os.path.exists(local_path):
                        print(f"📷 Uploading image: {fname}")
                        img_result = upload_image_to_drive(token, local_path, images_folder)
                        if img_result:
                            image_links[l.id] = img_result['direct_link']
        
        data = []
        for l in logs:
            # Convert timezone-aware datetime to timezone-naive for Excel compatibility
            timestamp_naive = l.timestamp.replace(tzinfo=None) if l.timestamp.tzinfo else l.timestamp
            
            # Use Google Drive link if available, otherwise use original
            foto_link = image_links.get(l.id, l.imagePath if l.imagePath else "")
            
            data.append({
                "Tanggal": timestamp_naive,
                "Kategori": l.kategori,
                "Nomor Dokumen": l.nomorDokumen,
                "Penerima": l.receiver,
                "Ringkasan": l.summary,
                "Link Foto": foto_link
            })
            
        df = pd.DataFrame(data)
        filename = f"Laporan_{user_email.split('@')[0]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        # Save to BytesIO with formatting
        excel_buffer = io.BytesIO()
        
        # Use ExcelWriter for advanced formatting
        with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Laporan')
            
            # Get workbook and worksheet
            workbook = writer.book
            worksheet = writer.sheets['Laporan']
            
            # Import openpyxl styles
            from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
            from openpyxl.utils import get_column_letter
            
            # Style untuk header
            header_fill = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
            header_font = Font(bold=True, color="FFFFFF", size=12)
            
            # Border style
            thin_border = Border(
                left=Side(style='thin', color='000000'),
                right=Side(style='thin', color='000000'),
                top=Side(style='thin', color='000000'),
                bottom=Side(style='thin', color='000000')
            )
            
            # Format header row
            for col_num, column_title in enumerate(df.columns, 1):
                cell = worksheet.cell(row=1, column=col_num)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
                cell.border = thin_border
            
            # Format data cells
            for row in worksheet.iter_rows(min_row=2, max_row=worksheet.max_row, min_col=1, max_col=worksheet.max_column):
                for cell in row:
                    cell.border = thin_border
                    
                    # CENTER ALIGN SEMUA KOLOM
                    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
                    
                    # Format tanggal
                    if cell.column == 1 and cell.value:
                        cell.number_format = 'DD/MM/YYYY HH:MM'
                    
                    # Make link clickable dengan text yang lebih pendek
                    if cell.column == 6 and cell.value and isinstance(cell.value, str) and cell.value.startswith('http'):
                        cell.hyperlink = cell.value
                        cell.font = Font(color="0563C1", underline="single")
                        cell.value = "📷 Lihat Foto"  # Ganti URL panjang dengan text pendek
            
            # Auto-adjust column width dengan ukuran lebih baik
            for col_num, column_title in enumerate(df.columns, 1):
                column_letter = get_column_letter(col_num)
                
                # Set specific widths untuk tampilan optimal
                if column_title == "Tanggal":
                    worksheet.column_dimensions[column_letter].width = 22
                elif column_title == "Kategori":
                    worksheet.column_dimensions[column_letter].width = 18
                elif column_title == "Nomor Dokumen":
                    worksheet.column_dimensions[column_letter].width = 25
                elif column_title == "Penerima":
                    worksheet.column_dimensions[column_letter].width = 30
                elif column_title == "Ringkasan":
                    worksheet.column_dimensions[column_letter].width = 60
                elif column_title == "Link Foto":
                    worksheet.column_dimensions[column_letter].width = 18
            
            # Freeze header row
            worksheet.freeze_panes = 'A2'
            
            # Set row height untuk semua baris
            worksheet.row_dimensions[1].height = 35  # Header lebih tinggi
            for row_num in range(2, worksheet.max_row + 1):
                worksheet.row_dimensions[row_num].height = 25  # Data row
        
        excel_content = excel_buffer.getvalue()
        
        # Upload to Google Drive if enabled
        drive_result = None
        if upload_to_drive and token:
            try:
                drive_result = export_to_google_drive_with_token(
                    access_token=token,
                    file_content=excel_content,
                    file_name=filename,
                    convert_to_sheets=True
                )
                print(f"✅ Successfully uploaded to Google Drive: {drive_result['web_view_link']}")
            except Exception as drive_error:
                print(f"⚠️ Google Drive upload failed: {str(drive_error)}")
                traceback.print_exc()
                # Continue with local file download even if Drive upload fails
                # Return info that Drive feature requires OAuth setup
                return {
                    "status": "info",
                    "message": f"Google Drive upload gagal: {str(drive_error)}",
                    "download_url": f"/download/{filename}",
                    "note": "File tetap bisa didownload secara lokal"
                }
        
        # Also save locally for download
        with open(filename, 'wb') as f:
            f.write(excel_content)
        
        # Return response with Google Drive link if available
        if drive_result:
            return {
                "status": "success",
                "message": "File exported to Google Drive",
                "drive_url": drive_result['web_view_link'],
                "file_name": drive_result['file_name'],
                "folder_name": drive_result['folder_name'],
                "download_url": f"/download/{filename}"
            }
        else:
            return FileResponse(filename, filename=filename)

    except Exception as e:
        print(f"❌ Export error: {str(e)}")
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.get("/download/{filename}")
async def download_file(filename: str, authorization: str = Header(None)):
    """Download exported Excel file"""
    try:
        user_email = get_user_email_from_token(authorization)
        file_path = os.path.join(os.getcwd(), filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(file_path, filename=filename)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- PYDANTIC MODELS FOR CHAT ---
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    pdfText: str = ""

# --- ENDPOINT: CHAT WITH OKI AI ---
@app.post("/api/chat")
async def chat_with_oki(
    request: ChatRequest,
    authorization: str = Header(None)
):
    """Chat endpoint untuk Gaskeun - OKi AI Assistant"""
    try:
        # Verify user authentication
        user_email = get_user_email_from_token(authorization)
        
        # Convert messages to dict format
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # Call OKi chatbot (using SumoPoD API)
        assistant_message = oki_bot.chat(messages=messages, pdf_text=request.pdfText)
        
        return {
            "status": "success",
            "message": assistant_message
        }
        
    except Exception as e:
        print(f"❌ Chat error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")
    except Exception as e:
        print(f"❌ Chat error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

# --- ENDPOINT: EXTRACT PDF TEXT ---
@app.post("/api/extract-pdf")
async def extract_pdf_text(
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    """Extract text from PDF file"""
    try:
        # Verify user authentication
        user_email = get_user_email_from_token(authorization)
        
        # Read PDF file
        pdf_bytes = await file.read()
        pdf_file = io.BytesIO(pdf_bytes)
        
        # Extract text using PyPDF2 (use PdfFileReader for older versions)
        try:
            # Try newer API first (PyPDF2 >= 3.0)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
        except AttributeError:
            # Fall back to older API (PyPDF2 < 3.0)
            pdf_reader = PyPDF2.PdfFileReader(pdf_file)
        
        text = ""
        
        # Handle both old and new PyPDF2 APIs
        num_pages = len(pdf_reader.pages) if hasattr(pdf_reader, 'pages') else pdf_reader.numPages
        
        for page_num in range(num_pages):
            page = pdf_reader.pages[page_num] if hasattr(pdf_reader, 'pages') else pdf_reader.getPage(page_num)
            # Try new API first, then fall back to old API
            try:
                text += page.extract_text() + "\n\n"
            except AttributeError:
                text += page.extractText() + "\n\n"
        
        return {
            "status": "success",
            "text": text.strip(),
            "pages": num_pages
        }
        
    except Exception as e:
        print(f"❌ PDF extraction error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF extraction error: {str(e)}")

# --- DELETE ACCOUNT ENDPOINT ---
@app.delete("/delete-account")
async def delete_account(authorization: str = Header(None)):
    """Delete user account and all associated data"""
    try:
        user_email = get_user_email_from_token(authorization)
        
        # Delete all user logs
        deleted = await prisma.logs.delete_many(
            where={"userId": user_email}
        )
        
        print(f"🗑️  Deleted {deleted} logs for user {user_email}")
        
        return {
            "status": "success",
            "message": f"Account deleted successfully. Removed {deleted} logs.",
            "email": user_email
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ Delete account error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF extraction error: {str(e)}")

@app.delete("/delete-account")
async def delete_account(authorization: str = Header(None)):
    """Delete user account and all associated data"""
    try:
        user_email = get_user_email_from_token(authorization)
        
        # Get all logs for this user to delete associated images
        logs = await prisma.logs.find_many(where={"userId": user_email})
        
        # Delete all image files from uploads folder
        for log in logs:
            if log.imagePath:
                filename = log.imagePath.split("/")[-1]
                file_path = os.path.join(UPLOAD_DIR, filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"🗑️ Deleted image: {filename}")
        
        # Delete all logs from database
        deleted_logs = await prisma.logs.delete_many(where={"userId": user_email})
        print(f"🗑️ Deleted {deleted_logs} logs for user: {user_email}")
        
        return {
            "status": "success",
            "message": "Account deleted successfully",
            "deleted_logs": deleted_logs
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ Delete account error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")

# --- ADMIN ENDPOINT: RESET DATABASE ---
class ResetRequest(BaseModel):
    admin_password: str

@app.post("/admin/reset-database")
async def admin_reset_database(request: ResetRequest):
    """Reset all database data (ADMIN ONLY - requires password)"""
    try:
        # Verify admin password from environment
        ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "supply2024reset")
        
        if request.admin_password != ADMIN_PASSWORD:
            raise HTTPException(status_code=403, detail="Invalid admin password")
        
        # Get all logs to delete associated images
        logs = await prisma.logs.find_many()
        
        # Delete all image files from uploads folder
        deleted_files = 0
        for log in logs:
            if log.imagePath:
                filename = log.imagePath.split("/")[-1]
                file_path = os.path.join(UPLOAD_DIR, filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    deleted_files += 1
        
        # Delete all logs from database
        deleted_logs = await prisma.logs.delete_many()
        
        print(f"🔄 DATABASE RESET: {deleted_logs} logs deleted, {deleted_files} files removed")
        
        return {
            "status": "success",
            "message": "Database reset successfully",
            "deleted_logs": deleted_logs,
            "deleted_files": deleted_files
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ Reset database error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to reset database: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)