# Simple FastAPI app without Prisma for testing
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
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
import json
import re
import traceback
import PyPDF2
from contextlib import asynccontextmanager

# Import smart OCR dan AI modules
from smart_ocr_processor import SmartOCRProcessor
from ai_text_summarizer import AITextSummarizer

# Import pricing system
from pricing_service import CreditService
from pricing_endpoints import router as pricing_router

from dotenv import load_dotenv
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global smart_ocr, ai_summarizer
    
    print("🚀 Starting Enhanced OCR API...")
    
    # Initialize Smart OCR and AI Summarizer
    try:
        smart_ocr = SmartOCRProcessor()
        ai_summarizer = AITextSummarizer()
        print("✅ Smart OCR and AI Summarizer initialized")
    except Exception as e:
        print(f"⚠️ Failed to initialize Smart OCR/AI: {e}")
    
    yield
    
    # Shutdown
    print("🔄 Shutting down Enhanced OCR API...")

# Create FastAPI app
app = FastAPI(
    title="Supply Chain OCR API", 
    description="Enhanced OCR API with Smart Processing and Credit System",
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include pricing router
app.include_router(pricing_router, prefix="/api/pricing", tags=["pricing"])

# Simple test endpoints without Prisma
@app.get("/")
async def root():
    return {"message": "Enhanced OCR API with Credit System is running!"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "smart_ocr_ready": smart_ocr is not None,
        "ai_summarizer_ready": ai_summarizer is not None
    }

@app.post("/test-ocr")
async def test_ocr_endpoint(file: UploadFile = File(...)):
    """Test endpoint for OCR without database operations"""
    try:
        # Read uploaded file
        file_content = await file.read()
        
        # Test Smart OCR processing
        if smart_ocr:
            result = smart_ocr.enhanced_ocr_extract(file_content, file.filename)
            
            # Test AI summarization if available
            if ai_summarizer and result.get("text"):
                summary_result = ai_summarizer.generate_intelligent_summary(
                    result["text"], 
                    result.get("document_type", "unknown")
                )
                result["ai_summary"] = summary_result
            
            return {
                "status": "success",
                "filename": file.filename,
                "processing_result": result
            }
        else:
            return {"status": "error", "message": "Smart OCR not initialized"}
            
    except Exception as e:
        return {
            "status": "error", 
            "message": f"Processing failed: {str(e)}",
            "traceback": traceback.format_exc()
        }

# Helper function for token validation
def get_user_email_from_token(authorization: str):
    """Extract user email from JWT token"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.split(' ')[1]
    try:
        payload = jwt.decode(token, os.getenv("SECRET_KEY", "your-secret-key"), algorithms=["HS256"])
        return payload.get("sub")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/test-pricing")
async def test_pricing():
    """Test pricing configuration"""
    try:
        return {
            "status": "success",
            "pricing_config": CreditService.PRICING_CONFIG
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)