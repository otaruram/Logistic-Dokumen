from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, requests
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from db import prisma, connect_db, disconnect_db
from pricing_service import CreditService

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await disconnect_db()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- AUTH HELPER ---
def get_user_email(auth: str):
    if not auth: return None
    token = auth.replace("Bearer ", "").strip()
    res = requests.get('https://www.googleapis.com/oauth2/v3/userinfo', headers={'Authorization': f'Bearer {token}'})
    return res.json().get('email') if res.status_code == 200 else None

# --- ENDPOINTS ---
@app.get("/me")
async def get_my_profile(authorization: str = Header(None)):
    email = get_user_email(authorization)
    if not email: raise HTTPException(401, "Sesi Habis")

    user = await prisma.user.find_unique(where={"email": email})
    
    # FIX: Jika user tidak ada (habis hapus akun), create ulang dengan 3 kredit
    if not user:
        user = await prisma.user.create(data={
            "email": email, "creditBalance": 3, "tier": "free",
            "createdAt": datetime.now(), "lastCreditReset": datetime.now()
        })
    else:
        await CreditService.ensure_daily_credits(email, prisma)
        user = await prisma.user.find_unique(where={"email": email})

    # LOGIC RESET BULANAN (Setiap 30 hari dari createdAt)
    next_reset = user.createdAt + timedelta(days=30)
    while next_reset < datetime.now(): next_reset += timedelta(days=30)
    days_left = (next_reset - datetime.now()).days

    return {
        "status": "success",
        "data": {
            **user.dict(),
            "resetInfo": {
                "nextResetDate": next_reset.strftime("%d %b %Y"),
                "daysLeft": days_left,
                "color": "red" if days_left <= 7 else "green"
            }
        }
    }

@app.delete("/delete-account")
async def delete_account(authorization: str = Header(None)):
    email = get_user_email(authorization)
    try:
        # Hapus relasi dulu biar gak error Foreign Key
        await prisma.logs.delete_many(where={"userId": email})
        await prisma.rating.delete_many(where={"userId": email})
        await prisma.user.delete(where={"email": email})
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/rating")
async def post_rating(data: dict, authorization: str = Header(None)):
    email = get_user_email(authorization) or "anonymous"
    try:
        await prisma.rating.create(data={**data, "userId": email})
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
