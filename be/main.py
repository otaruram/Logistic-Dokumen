from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import numpy as np
from PIL import Image
import io, os, requests
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from db import prisma, connect_db, disconnect_db
from utils import get_user_email_from_token
from smart_ocr_processor import SmartOCRProcessor
from pricing_service import CreditService
from imagekit_service import upload_to_imagekit

load_dotenv()
smart_ocr = None
scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    global smart_ocr
    try:
        smart_ocr = SmartOCRProcessor(os.getenv('OCR_SPACE_API_KEY', 'helloworld'))
    except: pass
    scheduler.start()
    yield
    await disconnect_db()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- HELPERS ---
def get_user_email_hybrid(auth: str):
    if not auth: return None
    token = auth.replace("Bearer ", "").strip()
    try:
        res = requests.get('https://www.googleapis.com/oauth2/v3/userinfo', headers={'Authorization': f'Bearer {token}'}, timeout=5)
        if res.status_code == 200: return res.json().get('email')
        return get_user_email_from_token(auth)
    except: return None

# --- MODELS ---
class RatingRequest(BaseModel):
    stars: int
    emoji: str
    message: str
    userName: str
    userAvatar: str

# --- ENDPOINTS ---

@app.get("/me")
async def get_my_profile(authorization: str = Header(None)):
    user_email = get_user_email_hybrid(authorization)
    if not user_email: raise HTTPException(401)

    user = await prisma.user.find_unique(where={"email": user_email})
    if not user:
        user = await prisma.user.create(data={
            "email": user_email, "creditBalance": 3, "tier": "free",
            "createdAt": datetime.now(), "lastCreditReset": datetime.now()
        })
    else:
        await CreditService.ensure_daily_credits(user_email, prisma)
        user = await prisma.user.find_unique(where={"email": user_email})

    # Logic Reset Bulanan (Anniversary Date)
    today = datetime.now()
    next_reset = datetime(today.year, today.month, user.createdAt.day if user.createdAt.day <= 28 else 28)
    if next_reset <= today:
        next_reset = (next_reset + timedelta(days=32)).replace(day=user.createdAt.day if user.createdAt.day <= 28 else 28)
    
    days_left = (next_reset - today).days
    return {
        "status": "success",
        "data": {
            **user.dict(),
            "resetInfo": {
                "nextResetDate": next_reset.strftime("%d %B %Y"),
                "daysLeft": days_left,
                "color": "red" if days_left <= 7 else "green"
            }
        }
    }

@app.delete("/delete-account")
async def delete_account(authorization: str = Header(None)):
    email = get_user_email_hybrid(authorization)
    if not email: return {"status": "error"}
    
    # Cascade delete manual (aman untuk Foreign Key)
    await prisma.logs.delete_many(where={"userId": email})
    await prisma.rating.delete_many(where={"userId": email})
    await prisma.user.delete(where={"email": email})
    return {"status": "success"}

@app.get("/ratings")
async def get_ratings():
    data = await prisma.rating.find_many(order={"createdAt": "desc"}, take=10)
    return {"status": "success", "data": data}

@app.post("/rating")
async def post_rating(data: RatingRequest, authorization: str = Header(None)):
    email = get_user_email_hybrid(authorization) or "anonymous"
    await prisma.rating.create(data={**data.dict(), "userId": email})
    return {"status": "success"}
