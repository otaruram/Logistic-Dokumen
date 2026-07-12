"""
Main FastAPI application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from config.settings import settings
from api import auth, scans, batch_scans, signature, fraud, exports, invoices, users, upload, config as config_api, reviews, dashboard, cleanup, chatbot, chat_history, admin, report, cron_report, scan_insight, telegram, partner, payment, ledger, transactions, audit, kyc, kasbon, kasbon_admin, gamification, whitelist
from middleware.security import RateLimitMiddleware, SecurityHeadersMiddleware, IPBlockingMiddleware

# Database will be handled by Prisma

# Create FastAPI app
app = FastAPI(
    title="OtaruChain API",
    description="Backend API for OtaruChain - Document scanning and invoice generation",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Add security middlewares (order matters!)
app.add_middleware(SecurityHeadersMiddleware)  # Security headers
app.add_middleware(IPBlockingMiddleware)       # IP blocking
app.add_middleware(RateLimitMiddleware)        # Rate limiting (DDoS protection)

# Setup CORS as the outermost middleware so error responses still include CORS headers.
_default_cors_origins = [
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:3000",
    "http://localhost:5174",
    "https://logistic-dokumen.vercel.app",
    "https://otaruchain.id",
    "https://www.otaruchain.id",
    "http://otaruchain.id",
    "http://www.otaruchain.id",
    "https://api-ocr.xyz",
    "https://ocr.web.id",
    "https://www.ocr.web.id",
    "https://otaruchain.vercel.app",
    "https://www.otaruchain.vercel.app",
    "https://otaruchain.my.id",
    "https://www.otaruchain.my.id",
]
_env_origins = [o.strip() for o in settings.CORS_ORIGINS if o.strip()]
_cors_origins = list(dict.fromkeys(_env_origins + _default_cors_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With", "x-api-key"],
    expose_headers=["Content-Disposition", "Content-Length"],
)

# Global exception handler — ensures CORS headers are present even on 500 crashes.
# FastAPI exception handlers run INSIDE the middleware stack, but CORSMiddleware only
# adds headers to responses it sees on the way out. To guarantee CORS headers survive
# a 500, we mirror the request Origin back manually when it matches an allowed origin.
from fastapi.responses import JSONResponse
from starlette.requests import Request as StarletteRequest

@app.exception_handler(Exception)
async def global_exception_handler(request: StarletteRequest, exc: Exception):
    import traceback
    print(f"❌ Unhandled error on {request.method} {request.url.path}: {exc}")
    traceback.print_exc()

    origin = request.headers.get("origin", "")
    headers: dict[str, str] = {}
    if origin and (origin in _cors_origins or "*" in _cors_origins):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin, X-Requested-With, x-api-key"

    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {exc}"},
        headers=headers,
    )

# Create upload directory
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs('static', exist_ok=True)

# Mount static files
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(scans.router, prefix="/api/scans", tags=["Scans"])
app.include_router(signature.router)
app.include_router(batch_scans.router)
app.include_router(fraud.router, prefix="/api/scans", tags=["Fraud Scans"])
app.include_router(exports.router, prefix="/api/scans", tags=["Exports"])
app.include_router(invoices.router, prefix="/api/invoices", tags=["Invoices"])
app.include_router(upload.router, tags=["Upload"])
app.include_router(config_api.router, tags=["Config"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["Reviews"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(cleanup.router, prefix="/api/cleanup", tags=["Cleanup"])
app.include_router(chatbot.router)
app.include_router(chat_history.router)
app.include_router(admin.router)
app.include_router(report.router, prefix="/api/report", tags=["Reports"])
app.include_router(cron_report.router)
app.include_router(scan_insight.router, prefix="/api/insight", tags=["Scan Insight"])
app.include_router(telegram.router, prefix="/api/telegram", tags=["Telegram"])
app.include_router(partner.router, tags=["Partner"])  # /api/v1/* routes defined inside partner.py
app.include_router(payment.router, tags=["Payment"])  # /api/v1/payment/* — Louvin proxy
app.include_router(ledger.router, prefix="/api/ledger", tags=["Ledger"])  # OtaruChain integrity seal
app.include_router(transactions.router, prefix="/api/transactions", tags=["Transactions"])  # Duration-filtered aggregates
app.include_router(audit.router, tags=["Partner Audit"])  # /api/partner/v1/user-audit/*
app.include_router(kyc.router, prefix="/api/kyc", tags=["KYC"])  # Identity verification (legacy)
app.include_router(whitelist.router, tags=["Whitelist Auth"])  # Google Login + Phone Whitelist
app.include_router(kasbon.router, tags=["Kasbon"])  # Digital Intake Gateway
app.include_router(kasbon_admin.router, tags=["Kasbon Admin"])


app.include_router(gamification.router)  # /api/v1/gamification/* — badge progress

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "OtaruChain API",
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
