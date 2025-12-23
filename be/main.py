"""
Main FastAPI application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from config.settings import settings
from api import auth, scans, invoices, users, upload, config as config_api, reviews, tools, quiz, dashboard, cleanup, audit, ppt
from middleware.security import RateLimitMiddleware, SecurityHeadersMiddleware, IPBlockingMiddleware

# Database will be handled by Prisma

# Create FastAPI app
app = FastAPI(
    title="OCR.WTF API",
    description="Backend API for ocr.wtf - Document scanning and invoice generation",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:8081", 
        "http://localhost:3000",
        "https://logistic-dokumen.vercel.app",
        "https://ocr.wtf",
        "https://www.ocr.wtf",
        "*"  # Allow all origins for now - REMOVE in production!
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add security middlewares (order matters!)
app.add_middleware(SecurityHeadersMiddleware)  # Security headers
app.add_middleware(IPBlockingMiddleware)       # IP blocking
app.add_middleware(RateLimitMiddleware)        # Rate limiting (DDoS protection)

# Create upload directory
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Create static exports directory for PPT files
os.makedirs("static/exports", exist_ok=True)

# Mount static files
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(scans.router, prefix="/api/scans", tags=["Scans"])
app.include_router(invoices.router, prefix="/api/invoices", tags=["Invoices"])
app.include_router(upload.router, tags=["Upload"])
app.include_router(config_api.router, tags=["Config"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["Reviews"])
app.include_router(tools.router, prefix="/api/tools", tags=["Tools"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["Quiz"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(cleanup.router, prefix="/api/cleanup", tags=["Cleanup"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])
app.include_router(ppt.router, prefix="/api/ppt", tags=["PPT - Premium"])

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "OCR.WTF API",
        "version": "1.0.0",
        "docs": f"{settings.base_url}/docs"  # Update link di response JSON juga
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.DEV_PORT,
        reload=settings.is_development
    )