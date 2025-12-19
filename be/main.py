from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os, tempfile, pytz
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
    user_email = get_user_email_hybrid(authorization) # Pastikan fungsi helper ini ada
    if not user_email: raise HTTPException(401, "Sesi Invalid")

    await CreditService.ensure_daily_credits(user_email, prisma)
    user = await prisma.user.find_unique(where={"email": user_email})
    
    if not user:
        user = await prisma.user.create(data={"email": user_email, "creditBalance": 3, "createdAt": datetime.now(), "lastCreditReset": datetime.now()})

    # Hitung Reset 30 Hari sejak Akun Dibuat
    join_date = user.createdAt.replace(tzinfo=pytz.utc).astimezone(WIB)
    next_reset = join_date + timedelta(days=30)
    while next_reset < datetime.now(WIB): next_reset += timedelta(days=30)

    return {
        "status": "success",
        "data": {
            "email": user.email, "creditBalance": user.creditBalance, "picture": user.picture, "name": user.name,
            "resetInfo": { "nextResetDate": next_reset.strftime("%d %B %Y"), "daysLeft": (next_reset - datetime.now(WIB)).days }
        }
    }

@app.delete("/delete-account")
async def delete_account(authorization: str = Header(None)):
    user_email = get_user_email_hybrid(authorization)
    if not user_email: raise HTTPException(401, "Akses Ditolak")
    
    # Hapus semua data terkait
    async with prisma.tx() as tx:
        await tx.logs.delete_many(where={"userId": user_email})
        await tx.user.delete(where={"email": user_email})
    return {"status": "success"}
