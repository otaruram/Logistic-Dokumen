from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io, os, tempfile, pytz, requests
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# IMPORTS LOKAL
from db import prisma, connect_db, disconnect_db
from utils import get_user_email_from_token
from smart_ocr_processor import SmartOCRProcessor
from pricing_service import CreditService

load_dotenv()

WIB = pytz.timezone('Asia/Jakarta')

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await disconnect_db()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# HELPER AUTH
def get_user_email_hybrid(authorization: str):
    if not authorization: return None
    token = authorization.replace("Bearer ", "").strip()
    # Logic verifikasi token google/custom di sini
    try: return get_user_email_from_token(authorization)
    except: return None

# --- ENDPOINT UTAMA ---

@app.get("/me")
async def get_my_profile(authorization: str = Header(None)):
    user_email = get_user_email_hybrid(authorization)
    if not user_email: raise HTTPException(401, "Unauthorized")

    # 1. Jalankan Reset Harian
    await CreditService.ensure_daily_credits(user_email, prisma)
    
    user = await prisma.user.find_unique(where={"email": user_email})
    if not user:
        # Create user baru jika belum ada
        user = await prisma.user.create(data={
            "email": user_email,
            "creditBalance": 3,
            "createdAt": datetime.now(),
            "lastCreditReset": datetime.now()
        })

    # 2. Hitung Mundur Reset Data (30 Hari sejak Akun Dibuat)
    join_date = user.createdAt.replace(tzinfo=pytz.utc).astimezone(WIB)
    now = datetime.now(WIB)
    
    # Hitung siklus 30 hari berikutnya
    next_data_reset = join_date + timedelta(days=30)
    while next_data_reset < now:
        next_data_reset += timedelta(days=30)

    days_left = (next_data_reset - now).days

    return {
        "status": "success",
        "data": {
            "email": user.email,
            "creditBalance": user.creditBalance,
            "createdAt": user.createdAt,
            "resetInfo": {
                "nextResetDate": next_data_reset.strftime("%d %B %Y"),
                "daysLeft": days_left
            }
        }
    }

@app.post("/export-excel")
async def export_excel(authorization: str = Header(None)):
    user_email = get_user_email_hybrid(authorization)
    if not user_email: raise HTTPException(401, "Unauthorized")

    logs = await prisma.logs.find_many(where={"userId": user_email}, order={"timestamp": "desc"})
    if not logs: return {"status": "error", "message": "Data kosong"}

    # Siapkan Data
    df = pd.DataFrame([
        {
            "Tanggal": l.timestamp.strftime("%Y-%m-%d"),
            "Jam": l.timestamp.strftime("%H:%M"),
            "Kategori": l.kategori,
            "Penerima": l.receiver,
            "Ringkasan": l.summary
        } for l in logs
    ])

    # Buat File Excel Rapih (Langsung Download)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        with pd.ExcelWriter(tmp.name, engine='xlsxwriter') as writer:
            df.to_excel(writer, sheet_name='Laporan_OCR', index=False)
            workbook = writer.book
            worksheet = writer.sheets['Laporan_OCR']
            
            # Formatting Standard Kantor
            header_fmt = workbook.add_format({'bold': True, 'fg_color': '#1A1A1A', 'font_color': '#FFFFFF', 'border': 1})
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_fmt)
                worksheet.set_column(col_num, col_num, 25)

        return FileResponse(
            path=tmp.name, 
            filename=f"Laporan_OCR_{datetime.now().strftime('%d%m%Y')}.xlsx",
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
