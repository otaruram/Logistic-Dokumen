#!/usr/bin/env python3
"""
Start backend development server
"""
import uvicorn
from config.settings import settings

if __name__ == "__main__":
    print(f"""
╔═══════════════════════════════════════════╗
║     OCR.WTF Backend Server Starting      ║
╠═══════════════════════════════════════════╣
║  Environment: {settings.ENV:<25} ║
║  Port: {settings.DEV_PORT:<32} ║
║  URL: {settings.DEV_URL:<33} ║
║  API Docs: {settings.DEV_URL}/api/docs          ║
╚═══════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.DEV_PORT,
        reload=settings.is_development,
        log_level="info"
    )
