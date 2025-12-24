"""
Backend Configuration
Load environment variables and setup configurations
"""
import os
from dotenv import load_dotenv
from pathlib import Path

# --- LOGIKA PENCARI .ENV (HUNTER) ---
# Kita cari file .env di beberapa kemungkinan lokasi
current_file = Path(__file__).resolve()
possible_paths = [
    current_file.parent.parent / '.env',         # 1. Di dalam folder be/ (be/.env)
    current_file.parent.parent.parent / '.env',  # 2. Di folder root project (omni-scan/.env)
    current_file.parent / '.env'                 # 3. Di folder config/ (be/config/.env)
]

env_path = None
for path in possible_paths:
    if path.exists():
        env_path = path
        print(f"✅ CONFIG: File .env ditemukan di: {path}")
        break

if env_path:
    load_dotenv(dotenv_path=env_path)
else:
    print("⚠️ WARNING: File .env TIDAK DITEMUKAN di folder manapun!")

class Settings:
    """Application settings"""
    
    # Database
    DATABASE_URL: str = os.getenv('DATABASE_URL', '')
    
    # API Keys - Separate for different features
    # For DGTNZ/OCR - Sumopod proxy
    OPENAI_API_KEY: str = os.getenv('OPENAI_API_KEY', '')
    OPENAI_BASE_URL: str = os.getenv('OPENAI_BASE_URL', 'https://ai.sumopod.com/v1')
    
    # For Audit.WTF - Sumopod proxy (SEPARATE API KEY)
    AUDIT_OPENAI_API_KEY: str = os.getenv('AUDIT_OPENAI_API_KEY', '')
    AUDIT_OPENAI_BASE_URL: str = os.getenv('AUDIT_OPENAI_BASE_URL', 'https://ai.sumopod.com/v1')
    AUDIT_OPENAI_MODEL: str = os.getenv('AUDIT_OPENAI_MODEL', 'gpt-4o-mini')
    
    # For Quiz - Sumopod proxy
    QUIZ_OPENAI_API_KEY: str = os.getenv('QUIZ_OPENAI_API_KEY', '')
    QUIZ_BASE_URL: str = os.getenv('QUIZ_BASE_URL', 'https://ai.sumopod.com/v1')
    
    # Groq API - For Audit.WTF (2-Stage Pipeline)
    GROQ_API_KEY: str = os.getenv('GROQ_API_KEY', '')
    GROQ_VISION_MODEL: str = os.getenv('GROQ_VISION_MODEL', 'llama-3.2-11b-vision-preview')
    GROQ_TEXT_MODEL: str = os.getenv('GROQ_TEXT_MODEL', 'llama-3.3-70b-versatile')
    
    # For Audit - Groq API (2-Stage Pipeline)
    GROQ_API_KEY: str = os.getenv('GROQ_API_KEY', '')
    GROQ_VISION_MODEL: str = 'llama-3.2-11b-vision-preview'
    GROQ_TEXT_MODEL: str = 'llama-3.3-70b-versatile'
    
    # ImageKit - Main project
    IMAGEKIT_PUBLIC_KEY: str = os.getenv('IMAGEKIT_PUBLIC_KEY', '')
    IMAGEKIT_PRIVATE_KEY: str = os.getenv('IMAGEKIT_PRIVATE_KEY', '')
    IMAGEKIT_URL_ENDPOINT: str = os.getenv('IMAGEKIT_URL_ENDPOINT', '')
    
    # ImageKit - QR Feature (separate account)
    IMAGEKIT_PUBLIC_KEY_QR: str = os.getenv('IMAGEKIT_PUBLIC_KEY_QR', '')
    IMAGEKIT_PRIVATE_KEY_QR: str = os.getenv('IMAGEKIT_PRIVATE_KEY_QR', '')
    IMAGEKIT_URL_ENDPOINT_QR: str = os.getenv('IMAGEKIT_URL_ENDPOINT_QR', '')
    
    # ImageKit
    IMAGEKIT_PUBLIC_KEY: str = os.getenv('IMAGEKIT_PUBLIC_KEY', '')
    IMAGEKIT_PRIVATE_KEY: str = os.getenv('IMAGEKIT_PRIVATE_KEY', '')
    IMAGEKIT_URL_ENDPOINT: str = os.getenv('IMAGEKIT_URL_ENDPOINT', '')
    
    # Server Configuration
    ENV: str = os.getenv('PYTHON_ENV', 'development')
    
    # Development
    DEV_PORT: int = int(os.getenv('DEV_BE_PORT', '8000'))
    DEV_URL: str = os.getenv('DEV_BE_URL', 'http://localhost:8000')
    DEV_FE_URL: str = os.getenv('DEV_FE_URL', 'http://localhost:8080')
    
    # Production
    API_URL: str = os.getenv("API_URL", "https://api-ocr.xyz")
    PROD_FE_URL: str = os.getenv('PROD_FE_URL', 'https://ocr.wtf')
    
    # CORS
    CORS_ORIGINS: list = os.getenv('CORS_ORIGINS', '').split(',')
    
    # JWT
    JWT_SECRET: str = os.getenv('JWT_SECRET', 'change-this-secret')
    JWT_ALGORITHM: str = 'HS256'
    JWT_EXPIRATION_HOURS: int = 24
    
    # Tesseract
    TESSERACT_CMD: str = os.getenv('TESSERACT_CMD', r'C:\Program Files\Tesseract-OCR\tesseract.exe')
    
    # Supabase (Cari VITE_ atau Biasa)
    SUPABASE_URL: str = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL', '')
    SUPABASE_ANON_KEY: str = os.getenv('SUPABASE_ANON_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY', '')
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
    
    # Google Drive API
    GOOGLE_API_KEY: str = os.getenv('GOOGLE_API_KEY', '')
    
    # File Upload
    UPLOAD_DIR: str = 'uploads'
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: set = {'.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.gif', '.bmp'}
    
    @property
    def is_development(self) -> bool:
        return self.ENV == 'development'
    
    @property
    def base_url(self) -> str:
        return self.DEV_URL if self.is_development else self.API_URL
    
    @property
    def frontend_url(self) -> str:
        return self.DEV_FE_URL if self.is_development else self.PROD_FE_URL
    
    def validate(self):
        print("\n🔍 --- FINAL CONFIG CHECK ---")
        if not self.SUPABASE_URL:
            print("❌ SUPABASE_URL: KOSONG/MISSING")
        else:
            print(f"✅ SUPABASE_URL: Terisi ({self.SUPABASE_URL})")
            
        if not self.SUPABASE_ANON_KEY:
            print("❌ SUPABASE_ANON_KEY: KOSONG/MISSING")
        elif len(self.SUPABASE_ANON_KEY) < 20:
            print("⚠️ SUPABASE_ANON_KEY: Terlalu Pendek (Mencurigakan)")
        else:
            print(f"✅ SUPABASE_ANON_KEY: Terisi ({self.SUPABASE_ANON_KEY[:5]}...)")

settings = Settings()
settings.validate()
