from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io, os, tempfile, pytz
from datetime import datetime, timedelta
from pricing_service import CreditService
from db import prisma, connect_db, disconnect_db
from contextlib import asynccontextmanager

WIB = pytz.timezone('Asia/Jakarta')

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await disconnect_db()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/me")
async def get_my_profile(authorization: str = Header(None)):
    # Masukkan logic auth Mas di sini (get_user_email_hybrid)
    user_email = "user@example.com" 
    
    await CreditService.ensure_daily_credits(user_email, prisma)
    user = await prisma.user.find_unique(where={"email": user_email})
    
    # Logic Notif 30 Hari sejak Akun Dibuat
    join_date = user.createdAt.replace(tzinfo=pytz.utc).astimezone(WIB)
    next_reset = join_date + timedelta(days=30)
    while next_reset < datetime.now(WIB): next_reset += timedelta(days=30)
    
    return {
        "status": "success",
        "data": {
            "creditBalance": user.creditBalance,
            "resetInfo": {
                "nextResetDate": next_reset.strftime("%d %B %Y"),
                "daysLeft": (next_reset - datetime.now(WIB)).days
            }
        }
    }

@app.post("/export-excel")
async def export_excel(authorization: str = Header(None)):
    user_email = "user@example.com"
    logs = await prisma.logs.find_many(where={"userId": user_email})
    df = pd.DataFrame([{"Tanggal": l.timestamp, "Ringkasan": l.summary} for l in logs])

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        with pd.ExcelWriter(tmp.name, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False)
        return FileResponse(path=tmp.name, filename="Laporan_OCR.xlsx")
