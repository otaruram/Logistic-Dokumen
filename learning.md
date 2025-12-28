# 📚 Pembelajaran Backend OCR.WTF - Fokus Arsitektur

> **Dokumentasi Pembelajaran Backend** untuk memahami struktur folder dan komponen utama aplikasi OCR.WTF

---

## 🎯 Tujuan Pembelajaran

Dokumen ini membantu Anda memahami:
- Arsitektur backend FastAPI
- Struktur folder dan tanggung jawab masing-masing
- Alur data dari request hingga response
- Best practices yang diterapkan

---

## 📁 Struktur Folder Backend

```
be/
├── api/           # 🎯 API Endpoints (Routes)
├── config/        # ⚙️ Konfigurasi & Database
├── middleware/    # 🛡️ Security & Rate Limiting
├── models/        # 🗄️ Database Models (SQLAlchemy)
├── prisma/        # 🔷 Prisma Schema (ORM Alternative)
├── schemas/       # ✅ Request/Response Validation (Pydantic)
├── services/      # 🧠 Business Logic & External APIs
├── static/        # 📦 Static Files (Exports, Assets)
└── utils/         # 🔧 Helper Functions
```

---

## 1️⃣ Folder: `api/` - API Endpoints

**Tanggung Jawab:** Menangani HTTP requests dan routing

### 📄 File-file Penting:

| File | Fungsi | Endpoint Utama |
|------|--------|----------------|
| `auth.py` | Autentikasi Google OAuth | `/api/auth/login`, `/api/auth/google` |
| `scans.py` | DGTNZ.WTF - OCR & Digitalisasi | `/api/scans/upload`, `/api/scans/save-with-signature` |
| `invoices.py` | Invoice.WTF - Generate Invoice | `/api/invoices/create`, `/api/invoices/pdf` |
| `dashboard.py` | Dashboard Analytics | `/api/dashboard/stats`, `/api/dashboard/weekly-activity` |
| `cleanup.py` | Monthly Cleanup Logic | `/api/cleanup/preview`, `/api/cleanup/execute` |
| `reviews.py` | User Reviews & Ratings | `/api/reviews/submit`, `/api/reviews/list` |
| `users.py` | User Management | `/api/users/me`, `/api/users/delete-account` |
| `upload.py` | File Upload Handler | `/api/upload` |
| `config.py` | Frontend Config | `/api/config` |

### 🔍 Contoh Alur Request (DGTNZ):

```
1. User upload foto dokumen → POST /api/scans/save-with-signature
2. scans.py menerima request
3. Validasi file & check credits
4. Upload ke ImageKit (services/imagekit_qr_service.py)
5. OCR processing (services/ocr_service.py)
6. Simpan ke database (models/models.py → Scan)
7. Deduct 1 credit (CreditHistory)
8. Return response (schemas/schemas.py → ScanResponse)
```

### 💡 Best Practice yang Diterapkan:

- **Separation of Concerns:** Setiap file fokus pada 1 fitur
- **Dependency Injection:** `Depends(get_current_user)` untuk auth
- **Background Tasks:** OCR processing tidak block response
- **Error Handling:** Try-except dengan HTTPException

---

## 2️⃣ Folder: `config/` - Konfigurasi

**Tanggung Jawab:** Setup environment, database, dan external services

### 📄 File-file:

| File | Fungsi |
|------|--------|
| `settings.py` | Load `.env`, validasi API keys |
| `database.py` | SQLAlchemy session & connection |
| `redis_client.py` | Redis untuk rate limiting |

### 🔑 Environment Variables (dari `settings.py`):

```python
# Database
DATABASE_URL              # PostgreSQL connection

# AI Services
OPENAI_API_KEY           # OCR enhancement (DGTNZ)
AUDIT_OPENAI_API_KEY     # Audit.WTF fraud detection
QUIZ_OPENAI_API_KEY      # Quiz generation
GROQ_API_KEY_1-4         # Backup AI (4 keys rotation)

# ImageKit
IMAGEKIT_PUBLIC_KEY      # Main storage
IMAGEKIT_PUBLIC_KEY_QR   # QR feature (separate account)

# Supabase
SUPABASE_URL             # Auth & RLS
SUPABASE_ANON_KEY        # Frontend auth
SUPABASE_SERVICE_ROLE_KEY # Backend bypass RLS

# Server
ENV                      # development/production
API_URL                  # Production backend URL
PROD_FE_URL             # Production frontend URL
```

### 🎯 Kenapa Pisah API Keys?

- **Rate Limiting:** Setiap fitur punya quota sendiri
- **Cost Tracking:** Monitoring biaya per feature
- **Fault Tolerance:** Jika 1 key limit, fitur lain tetap jalan

---

## 3️⃣ Folder: `middleware/` - Security Layer

**Tanggung Jawab:** Proteksi DDoS, rate limiting, security headers

### 📄 File: `security.py`

#### 🛡️ 3 Middleware Utama:

```python
1. RateLimitMiddleware
   - Global: 100 req/min per IP
   - Per endpoint:
     * /api/scans/upload → 10 req/min
     * /api/quiz/generate → 5 req/min
     * /api/reviews/submit → 3 req/min
   - Storage: Redis (key: "endpoint_rate:{ip}:{path}")

2. SecurityHeadersMiddleware
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection: 1; mode=block
   - Strict-Transport-Security: HSTS
   - Permissions-Policy: Disable geolocation, camera, mic

3. IPBlockingMiddleware
   - Blocklist IPs yang abuse
   - Auto-block jika terlalu banyak 429 errors
```

### 🔥 Urutan Middleware (di `main.py`):

```python
app.add_middleware(SecurityHeadersMiddleware)  # 1. Headers dulu
app.add_middleware(IPBlockingMiddleware)       # 2. Block IP jahat
app.add_middleware(RateLimitMiddleware)        # 3. Rate limit terakhir
```

**⚠️ Order matters!** Headers harus ditambahkan sebelum blocking.

---

## 4️⃣ Folder: `models/` - Database Models

**Tanggung Jawab:** Define struktur tabel database (SQLAlchemy ORM)

### 📄 File: `models.py`

#### 🗄️ Model Utama:

```python
1. User
   - id (UUID), email, username, credits
   - Relations: scans[], invoices[], creditHistory[]

2. Scan (DGTNZ.WTF)
   - OCR results: extractedText, confidenceScore
   - Digitization: recipientName, signatureUrl, imageKitUrl
   - Status: pending → processing → completed/failed

3. Invoice (Invoice.WTF)
   - Client info, items (JSON), total
   - Status: draft → sent → paid/overdue

4. CreditHistory
   - Track credit usage: -1 per scan, +10 daily reset
   - action: "scan", "invoice", "refill"

5. DocumentAudit (Audit.WTF)
   - Fraud detection: isDuplicate, isSuspicious
   - Unique constraint: (invoiceNumber, vendorName, totalAmount)

6. PPTHistory (PPT.WTF)
   - PDF storage dengan expiration (1 week)
   - expiresAt: createdAt + 7 days
```

### 🔗 Relationships:

```python
User.scans → Scan.user (One-to-Many)
User.creditHistory → CreditHistory.user (One-to-Many)
```

**Cascade Delete:** Jika user dihapus, semua data terkait ikut terhapus.

---

## 5️⃣ Folder: `prisma/` - Modern ORM

**Tanggung Jawab:** Alternative ORM dengan type safety

### 📄 File: `schema.prisma`

#### 🔷 Kenapa Pakai Prisma + SQLAlchemy?

| Aspek | SQLAlchemy | Prisma |
|-------|-----------|--------|
| **Migrations** | Manual Alembic | Auto-generate |
| **Type Safety** | ❌ | ✅ (Python types) |
| **Relations** | Manual joins | Auto-populate |
| **Performance** | Mature | Modern, faster queries |

#### 📊 Contoh Model Prisma:

```prisma
model Scan {
  id               Int     @id @default(autoincrement())
  userId           String  @map("user_id") @db.Uuid
  extractedText    String? @map("extracted_text") @db.Text
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@map("scans")
}
```

**Keuntungan:**
- `@map()`: Snake_case di DB, camelCase di code
- `@@index()`: Auto-create index untuk query cepat
- `onDelete: Cascade`: Auto-delete child records

---

## 6️⃣ Folder: `schemas/` - Request/Response Validation

**Tanggung Jawab:** Validasi input/output dengan Pydantic

### 📄 File: `schemas.py`

#### ✅ Pydantic Schemas:

```python
1. UserCreate (Request)
   - email: EmailStr (auto-validate format)
   - password: str (min 8 chars)

2. ScanResponse (Response)
   - id, extractedText, confidenceScore
   - Config: from_attributes = True (SQLAlchemy compat)

3. InvoiceCreate (Request)
   - items: List[InvoiceItem] (nested validation)
   - issueDate, dueDate: datetime (auto-parse)

4. Token (Response)
   - access_token: str (JWT)
   - token_type: "bearer"
```

### 🎯 Kenapa Pydantic?

- **Auto Validation:** Email format, date parsing, range checks
- **Type Hints:** IDE autocomplete & type checking
- **Error Messages:** User-friendly validation errors
- **Serialization:** SQLAlchemy → JSON otomatis

---

## 7️⃣ Folder: `services/` - Business Logic

**Tanggung Jawab:** Integrasi dengan external APIs & complex logic

### 📄 File-file:

| File | Fungsi | External API |
|------|--------|--------------|
| `ocr_service.py` | OCR processing | Tesseract + OpenAI/Groq |
| `imagekit_service.py` | Image upload | ImageKit.io (main) |
| `imagekit_qr_service.py` | QR code upload | ImageKit.io (QR account) |

### 🧠 Contoh: `ocr_service.py`

#### Alur OCR Processing:

```python
1. extract_text_tesseract(image_path)
   → Tesseract OCR → raw_text + confidence

2. enhance_with_openai(raw_text)
   → Try OpenAI → Fallback to Groq (4 keys rotation)
   → Fix typos & formatting

3. process_image(image_path)
   → Combine step 1 & 2
   → Return: {raw_text, enhanced_text, confidence, processing_time}
```

#### 🔄 Fallback Strategy:

```
OpenAI (gpt-4o-mini)
  ↓ (if failed)
Groq Key 1 (llama-3.3-70b)
  ↓ (if failed)
Groq Key 2
  ↓ (if failed)
Groq Key 3
  ↓ (if failed)
Groq Key 4
  ↓ (if all failed)
Return raw_text (no enhancement)
```

**💡 Benefit:** 99.9% uptime, cost optimization

---

## 8️⃣ Folder: `utils/` - Helper Functions

**Tanggung Jawab:** Reusable utilities

### 📄 File-file:

| File | Fungsi |
|------|--------|
| `auth.py` | JWT & Supabase auth, password hashing |
| `file_handler.py` | File upload validation, cleanup |
| `invoice_utils.py` | Invoice number generation, PDF rendering |

### 🔐 Contoh: `auth.py`

#### Dual Authentication:

```python
async def get_current_user(
    token: str = Depends(oauth2_scheme),           # JWT
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),  # Supabase
    db: Session = Depends(get_db)
):
    # 1. Try Supabase token (Google OAuth)
    if credentials:
        user_response = supabase.auth.get_user(credentials.credentials)
        → Get/Create user in local DB
    
    # 2. Fallback to JWT token
    if token:
        payload = jwt.decode(token, JWT_SECRET)
        → Get user from DB
    
    # 3. Raise 401 if both failed
```

**🎯 Kenapa Dual Auth?**
- **Supabase:** Google OAuth, social login
- **JWT:** Traditional email/password, API access

---

## 9️⃣ Folder: `static/` - Static Files

**Tanggung Jawab:** Serve files yang di-generate

### 📁 Struktur:

```
static/
└── exports/
    ├── invoice_001.pdf
    ├── ppt_presentation.pdf
    └── audit_report.xlsx
```

### 🔗 Mounting di `main.py`:

```python
app.mount("/static", StaticFiles(directory="static"), name="static")
```

**Access URL:** `https://api-ocr.xyz/static/exports/invoice_001.pdf`

---

## 🔄 Alur Request End-to-End

### Contoh: Upload Scan (DGTNZ.WTF)

```
┌─────────────┐
│  Frontend   │ POST /api/scans/save-with-signature
└──────┬──────┘ Body: {file, recipient_name, signature_url}
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  Middleware Layer (main.py)                         │
│  1. SecurityHeadersMiddleware → Add security headers│
│  2. IPBlockingMiddleware → Check if IP blocked      │
│  3. RateLimitMiddleware → Check rate limit (10/min) │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  API Route (api/scans.py)                           │
│  @router.post("/save-with-signature")               │
│  - Depends(get_current_active_user) → Auth check    │
│  - Validate file type & size                        │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Service Layer (services/)                          │
│  1. imagekit_qr_service.upload() → Upload to cloud  │
│  2. ocr_service.process_image() → Extract text      │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Database Layer (models/models.py)                  │
│  1. Create Scan record                              │
│  2. Deduct 1 credit from User                       │
│  3. Create CreditHistory record                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Response (schemas/schemas.py)                      │
│  ScanResponse: {id, extractedText, imageKitUrl, ... }│
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
                  ┌─────────┐
                  │ Frontend│
                  └─────────┘
```

---

## 🎓 Best Practices yang Diterapkan

### 1. **Layered Architecture**
```
API Layer (api/) → Service Layer (services/) → Data Layer (models/)
```
**Benefit:** Easy testing, maintainability

### 2. **Dependency Injection**
```python
def endpoint(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
```
**Benefit:** Testable, reusable, clean code

### 3. **Environment-based Config**
```python
settings.is_development → Use DEV_URL
settings.is_production → Use API_URL
```
**Benefit:** Single codebase, multiple environments

### 4. **Error Handling**
```python
try:
    # Business logic
except SpecificError as e:
    raise HTTPException(status_code=400, detail=str(e))
```
**Benefit:** User-friendly errors, no crashes

### 5. **Background Tasks**
```python
background_tasks.add_task(process_scan_background, scan_id, file_path)
return {"status": "processing"}  # Immediate response
```
**Benefit:** Fast response, better UX

### 6. **Rate Limiting**
```python
RATE_LIMITS = {
    "/api/scans/upload": 10,  # 10 req/min
}
```
**Benefit:** Prevent abuse, cost control

### 7. **Database Indexing**
```python
@@index([userId])  # Fast user queries
@@index([createdAt])  # Fast date filtering
```
**Benefit:** Query performance

---

## 🚀 Tips Pembelajaran

### 1. **Mulai dari `main.py`**
   - Lihat router registration
   - Pahami middleware order
   - Trace 1 endpoint dari awal sampai akhir

### 2. **Baca `settings.py`**
   - Catat semua environment variables
   - Pahami fallback logic (OpenAI → Groq)

### 3. **Explore 1 Feature Lengkap**
   - Pilih: DGTNZ (scans.py)
   - Trace: API → Service → Model → Schema
   - Run di Postman/Thunder Client

### 4. **Pelajari Error Handling**
   - Lihat try-except patterns
   - Pahami HTTPException usage
   - Test error scenarios

### 5. **Understand Database Relations**
   - Buka `models.py` & `schema.prisma`
   - Gambar ER diagram
   - Pahami cascade delete

---

## 📖 Referensi

- **FastAPI Docs:** https://fastapi.tiangolo.com
- **Pydantic:** https://docs.pydantic.dev
- **SQLAlchemy:** https://docs.sqlalchemy.org
- **Prisma Python:** https://prisma-client-py.readthedocs.io
- **ImageKit:** https://docs.imagekit.io
- **Supabase Auth:** https://supabase.com/docs/guides/auth

---

## 🎯 Next Steps

1. ✅ Baca dokumentasi ini
2. ✅ Clone & setup local environment
3. ✅ Run `uvicorn main:app --reload`
4. ✅ Test 1 endpoint dengan Postman
5. ✅ Modify 1 feature (tambah field baru)
6. ✅ Deploy ke VPS/Render

---

## 🏗️ Teknologi & Infrastruktur Core

Berikut adalah teknologi utama yang digunakan dalam aplikasi OCR.WTF:

---

### 1️⃣ **VPS Deployment (Ubuntu Server)**

**Platform:** Ubuntu VPS dengan Docker

#### 📦 Deployment Stack:

```bash
# Stack yang digunakan:
- OS: Ubuntu 20.04/22.04 LTS
- Container: Docker + Docker Compose
- Web Server: Nginx (Reverse Proxy)
- Process Manager: Uvicorn (ASGI Server)
- Database: PostgreSQL (Supabase Cloud)
- Cache: Redis (Rate Limiting)
```

#### 🚀 Deployment Process:

```bash
# 1. Clone repository
git clone https://github.com/otaruram/Logistic-Dokumen
cd Logistic-Dokumen/be

# 2. Build Docker image
docker build -t ocr-backend .

# 3. Run container
docker run -d \
  --name ocr-api \
  -p 8000:8000 \
  --env-file .env \
  --restart unless-stopped \
  ocr-backend

# 4. Setup Nginx reverse proxy
# /etc/nginx/sites-available/api-ocr.xyz
server {
    listen 80;
    server_name api-ocr.xyz;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**🎯 Kenapa VPS?**
- **Full Control:** Akses root, custom config
- **Cost Effective:** Lebih murah untuk traffic tinggi
- **No Cold Start:** Always warm, tidak seperti serverless
- **Custom Dependencies:** Tesseract OCR, LibreOffice

---

### 2️⃣ **Docker Containerization**

**File:** `Dockerfile` - Production-ready container

```dockerfile
# Use Python 3.12 slim image (smaller size)
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies required for PDF processing
RUN apt-get update && apt-get install -y \
    poppler-utils \           # PDF to image conversion
    tesseract-ocr \           # OCR engine
    tesseract-ocr-ind \       # Indonesian language pack
    libgl1 \                  # OpenCV dependency
    libglib2.0-0 \            # Image processing
    libreoffice \             # PPT to PDF conversion
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Generate Prisma client
RUN prisma generate

# Create uploads directory
RUN mkdir -p uploads

# Expose port 8000
EXPOSE 8000

# Health check (Docker monitors container health)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/', timeout=5)" || exit 1

# Run with Uvicorn (production-ready ASGI server)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
```

**🎯 Docker Benefits:**
- **Reproducible:** Same environment di dev & production
- **Isolated:** Dependencies tidak conflict dengan system
- **Scalable:** Easy horizontal scaling dengan multiple containers
- **Portable:** Deploy ke VPS, AWS, GCP, Azure

#### 🔧 Build Script (`build.sh`):

```bash
#!/bin/bash
# Build script for Render/VPS deployment

# Install dependencies
pip install -r requirements.txt

# Generate Prisma Client
export PRISMA_PY_DEBUG_GENERATOR=1
python -m prisma generate

# Push database schema (create/update tables)
python -m prisma db push --skip-generate

echo "✅ Build completed successfully!"
```

---

### 3️⃣ **OCR Technology Stack**

**Dual-Engine Approach:** Tesseract + AI Enhancement

#### 🔍 OCR Pipeline:

```
┌─────────────┐
│ Input Image │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ Tesseract OCR       │ ← Open-source, offline
│ - Extract raw text  │
│ - Confidence score  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ AI Enhancement      │ ← OpenAI/Groq
│ - Fix typos         │
│ - Format text       │
│ - Improve accuracy  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Enhanced Text       │
└─────────────────────┘
```

#### 📊 Technology Details:

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **OCR Engine** | Tesseract 5.x | Text extraction dari image |
| **Language** | tesseract-ocr-ind | Support Bahasa Indonesia |
| **AI Enhancement** | OpenAI GPT-4o-mini | Fix typos & formatting |
| **Fallback AI** | Groq Llama-3.3-70b | Backup jika OpenAI down |
| **Image Processing** | Pillow (PIL) | Brightness/contrast enhancement |

#### 🎯 Kenapa Dual-Engine?

```python
# Tesseract: Fast, offline, free
raw_text = tesseract.image_to_string(image)  # ~1-2 seconds

# AI: Accurate, context-aware, online
enhanced_text = openai.fix_typos(raw_text)  # ~2-3 seconds

# Total: ~3-5 seconds (acceptable UX)
```

**Benefits:**
- **Speed:** Tesseract cepat untuk raw extraction
- **Accuracy:** AI fix typos & context errors
- **Fallback:** Jika AI down, tetap ada Tesseract result
- **Cost:** Tesseract gratis, AI hanya untuk enhancement

---

### 4️⃣ **API Architecture (FastAPI)**

**Framework:** FastAPI (Modern Python ASGI)

#### 🚀 FastAPI Features:

```python
# 1. Auto API Documentation (Swagger UI)
# Access: https://api-ocr.xyz/api/docs

# 2. Type Validation (Pydantic)
class ScanCreate(BaseModel):
    filename: str
    recipient_name: Optional[str] = None

# 3. Dependency Injection
@router.post("/upload")
async def upload(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    pass

# 4. Background Tasks (Non-blocking)
background_tasks.add_task(process_ocr, scan_id)
return {"status": "processing"}  # Immediate response

# 5. WebSocket Support (Real-time)
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
```

#### 📊 Performance Metrics:

| Metric | Value | Notes |
|--------|-------|-------|
| **Response Time** | ~50-200ms | Tanpa OCR processing |
| **OCR Processing** | ~3-5 seconds | Background task |
| **Throughput** | ~1000 req/min | With rate limiting |
| **Workers** | 2 | Uvicorn workers |

---

### 5️⃣ **Rate Limiting & DDoS Protection**

**Technology:** Redis + Custom Middleware

#### 🛡️ Rate Limiting Strategy:

```python
# File: middleware/security.py

RATE_LIMITS = {
    "/api/scans/upload": 10,           # 10 req/min (OCR expensive)
    "/api/quiz/generate": 5,           # 5 req/min (AI expensive)
    "/api/invoices/create": 20,        # 20 req/min
    "/api/reviews/submit": 3,          # 3 req/min (prevent spam)
}

GLOBAL_LIMIT = 100  # 100 req/min per IP (all endpoints)
```

#### 🔧 Implementation:

```python
class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host
        
        # 1. Check global rate limit
        if not self._check_global_rate_limit(client_ip):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."}
            )
        
        # 2. Check endpoint-specific rate limit
        path = request.url.path
        if path in self.RATE_LIMITS:
            limit = self.RATE_LIMITS[path]
            if not self._check_endpoint_rate_limit(client_ip, path, limit):
                return JSONResponse(status_code=429, ...)
        
        return await call_next(request)
    
    def _check_endpoint_rate_limit(self, ip: str, path: str, limit: int):
        # Redis key: "endpoint_rate:{ip}:{path}"
        key = f"endpoint_rate:{ip}:{path.replace('/', '_')}"
        current = redis.get(key)
        
        if current is None:
            redis.setex(key, 60, 1)  # Expire in 60 seconds
            return True
        
        if int(current) >= limit:
            return False  # Rate limit exceeded
        
        redis.incr(key)
        return True
```

**🎯 Benefits:**
- **Cost Control:** Prevent abuse dari single IP
- **Fair Usage:** Semua user dapat akses yang adil
- **DDoS Protection:** Auto-block IP yang abuse
- **Redis Storage:** Fast, in-memory, auto-expire

---

### 6️⃣ **Cron Jobs & Automation**

**Scheduled Tasks:** Daily & Monthly cleanup

#### ⏰ Cron Schedule:

```bash
# Crontab configuration
# Daily credit reset (00:00 UTC)
0 0 * * * curl -X POST https://api-ocr.xyz/api/cleanup/daily-credit-reset \
  -H "Authorization: Bearer your-secret-key"

# Monthly cleanup (1st of month, 02:00 UTC)
0 2 1 * * curl -X POST https://api-ocr.xyz/api/cleanup/monthly-cleanup \
  -H "Authorization: Bearer your-secret-key"
```

#### 🔧 Daily Credit Reset (`cron_credits.py`):

```python
import asyncio
from supabase import create_client

async def reset_credits():
    """Reset all user credits to 10 daily at 00:00 UTC"""
    print("🔄 Starting daily credit reset...")
    
    # Update all users where credits < 10
    response = supabase.table("users")\
        .update({"credits": 10})\
        .neq("id", "00000000-0000-0000-0000-000000000000")\
        .execute()
    
    print(f"✅ Successfully reset credits for users.")

if __name__ == "__main__":
    asyncio.run(reset_credits())
```

#### 🗑️ Monthly Cleanup (`api/cleanup.py`):

```python
@router.post("/monthly-cleanup")
async def trigger_monthly_cleanup(authorization: str = Header(None)):
    """Delete data older than 30 days"""
    
    # Verify authorization
    if authorization != f"Bearer {CLEANUP_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    cleanup_date = datetime.now() - timedelta(days=30)
    
    # 1. Delete old DGTNZ scans (30 days)
    scans_result = supabase_admin.table("scans")\
        .delete()\
        .lt("created_at", cleanup_date.isoformat())\
        .execute()
    
    # 2. Delete old ImageKit file tracking
    imagekit_result = supabase_admin.table("imagekit_files")\
        .delete()\
        .lt("created_at", cleanup_date.isoformat())\
        .execute()
    
    # 3. Delete expired PPT history (1 week expiration)
    ppt_result = supabase_admin.table("ppt_history")\
        .delete()\
        .lt("expires_at", datetime.now().isoformat())\
        .execute()
    
    # 4. Delete old files from static/exports/
    deleted_files = 0
    exports_dir = Path("static/exports")
    
    for file_path in exports_dir.iterdir():
        if file_path.is_file():
            file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
            if file_mtime < cleanup_date:
                file_path.unlink()  # Delete file
                deleted_files += 1
    
    return {
        "deleted": {
            "scans": len(scans_result.data),
            "imagekit_files": len(imagekit_result.data),
            "ppt_history": len(ppt_result.data),
            "export_files": deleted_files
        }
    }
```

**🎯 Automation Benefits:**
- **Storage Management:** Auto-delete old files (save cost)
- **User Experience:** Daily credit reset (fair usage)
- **Data Privacy:** Auto-cleanup sensitive data
- **No Manual Work:** Fully automated

---

### 7️⃣ **Application Lifecycle Management**

#### 🔄 User Lifecycle (30-Day Cycles):

```
User Registration (Day 0)
    ↓
┌─────────────────────────────────────┐
│  Cycle 1: Day 0-29                  │
│  - 10 credits daily                 │
│  - Scans stored                     │
│  - Activity tracked                 │
└──────────────┬──────────────────────┘
               │ (Day 30)
               ▼
┌─────────────────────────────────────┐
│  Monthly Cleanup                    │
│  - Delete scans > 30 days           │
│  - Delete ImageKit files            │
│  - Reset cycle counter              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Cycle 2: Day 30-59                 │
│  - Continue with fresh data         │
└─────────────────────────────────────┘
```

#### 📊 Lifecycle Calculation Logic:

```python
# File: api/dashboard.py

# Calculate which cycle user is in
days_since_join = (now - join_date).days
cycle_number = days_since_join // 30           # 0, 1, 2, ...
days_in_current_cycle = days_since_join % 30   # 0-29
days_until_cleanup = 30 - days_in_current_cycle # Remaining days

# Current cycle start date
current_cycle_start = join_date + timedelta(days=cycle_number * 30)

# Count scans in CURRENT cycle only (not total)
scans_count = supabase.table("scans")\
    .select("id", count="exact")\
    .eq("user_id", user_id)\
    .gte("created_at", current_cycle_start.isoformat())\
    .execute()
```

**🎯 Benefits:**
- **Fair Usage:** Setiap user punya cycle sendiri
- **Storage Control:** Auto-cleanup prevent unlimited growth
- **Predictable:** User tahu kapan data akan dihapus
- **Privacy:** Data tidak disimpan selamanya

---

### 8️⃣ **Database & ORM (Prisma + Supabase)**

**Stack:** PostgreSQL (Supabase) + Prisma ORM

#### 🗄️ Database Architecture:

```prisma
// File: prisma/schema.prisma

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id             String   @id @default(uuid()) @db.Uuid
  email          String   @unique
  credits        Int      @default(10)
  createdAt      DateTime @default(now())
  
  scans         Scan[]
  creditHistory CreditHistory[]
  
  @@map("users")
}

model Scan {
  id               Int     @id @default(autoincrement())
  userId           String  @map("user_id") @db.Uuid
  extractedText    String? @db.Text
  imageKitUrl      String?
  
  createdAt DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@map("scans")
}
```

#### 🔐 Row Level Security (RLS):

```sql
-- Supabase RLS Policy
-- Users can only see their own scans

CREATE POLICY "Users can view own scans"
ON scans FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scans"
ON scans FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scans"
ON scans FOR DELETE
USING (auth.uid() = user_id);
```

**🎯 Benefits:**
- **Type Safety:** Prisma auto-generate types
- **Auto Migrations:** `prisma db push` auto-update schema
- **RLS Security:** User hanya bisa akses data sendiri
- **Cloud Hosted:** Supabase handle backup, scaling

---

### 9️⃣ **External Services Integration**

#### 🔗 Third-Party APIs:

| Service | Purpose | Fallback |
|---------|---------|----------|
| **ImageKit.io** | Image hosting & CDN | 2 separate accounts (main + QR) |
| **OpenAI** | OCR enhancement | Groq API (4 keys rotation) |
| **Groq** | AI fallback | Return raw Tesseract text |
| **Supabase** | Auth & Database | JWT fallback for auth |
| **Redis** | Rate limiting cache | Allow all if Redis down |

#### 🔄 Fallback Strategy Example:

```python
# OCR Enhancement with multiple fallbacks
async def enhance_with_openai(text: str) -> str:
    # 1. Try OpenAI (Primary)
    if openai_client:
        try:
            return openai_client.enhance(text)
        except Exception as e:
            print(f"OpenAI failed: {e}")
    
    # 2. Try Groq (Fallback 1-4)
    for idx, groq_client in enumerate(groq_clients):
        try:
            return groq_client.enhance(text)
        except Exception as e:
            print(f"Groq key {idx+1} failed: {e}")
            continue
    
    # 3. Return original text (Last resort)
    print("All AI failed, returning raw text")
    return text
```

---

## 🎯 Technology Stack Summary

### Backend:
- **Language:** Python 3.12
- **Framework:** FastAPI (ASGI)
- **Server:** Uvicorn (2 workers)
- **ORM:** Prisma + SQLAlchemy
- **Database:** PostgreSQL (Supabase)
- **Cache:** Redis
- **Container:** Docker

### AI & Processing:
- **OCR:** Tesseract 5.x + tesseract-ocr-ind
- **AI Enhancement:** OpenAI GPT-4o-mini
- **AI Fallback:** Groq Llama-3.3-70b (4 keys)
- **Image Processing:** Pillow (PIL)
- **PDF Processing:** Poppler, LibreOffice

### Infrastructure:
- **Deployment:** VPS Ubuntu + Docker
- **Reverse Proxy:** Nginx
- **CDN:** ImageKit.io (2 accounts)
- **Auth:** Supabase + JWT
- **Cron:** System crontab

### Security:
- **Rate Limiting:** Redis-based middleware
- **DDoS Protection:** IP blocking + rate limits
- **Auth:** Dual token (Supabase + JWT)
- **RLS:** Row Level Security (Supabase)
- **Password:** Bcrypt hashing

### Automation:
- **Daily:** Credit reset (00:00 UTC)
- **Monthly:** Data cleanup (1st of month)
- **Health Check:** Docker healthcheck (30s interval)

---

## 💻 Contoh Kode Core (Real Implementation)

Berikut adalah contoh kode penting dari aplikasi yang perlu dipahami:

---

### 1️⃣ API Endpoint: Upload & Save Scan (DGTNZ)

**File:** `api/scans.py` - Endpoint utama untuk digitalisasi dokumen

```python
@router.post("/save-with-signature")
async def save_scan_with_signature(
    file: UploadFile = File(...),
    recipient_name: str = Form(""),
    signature_url: str = Form(""),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Save scan to database with recipient name and signature"""
    
    # 1. CHECK CREDITS FIRST (Prevent abuse)
    if current_user.credits < SCAN_COST:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Required: {SCAN_COST}, Available: {current_user.credits}"
        )
    
    try:
        content = await file.read()
        
        # 2. UPLOAD TO IMAGEKIT (Cloud Storage)
        imagekit_result = ImageKitQRService.upload_file(
            file=content,
            file_name=file.filename or "scan.jpg",
            folder="/qr-scans"
        )
        image_url = imagekit_result.get("url")
        
        # 3. SAVE TEMP FILE FOR OCR
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename or "")[1]) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # 4. PROCESS OCR (Tesseract + OpenAI Enhancement)
            ocr_result = await OCRService.process_image(tmp_path, use_ai_enhancement=True)
            extracted = ocr_result.get("enhanced_text") or ocr_result.get("raw_text") or "No text detected"
            
            # 5. CREATE DATABASE RECORD
            new_scan = Scan(
                user_id=current_user.id,
                original_filename=file.filename,
                file_path=tmp_path,
                file_size=len(content),
                file_type=file.content_type,
                imagekit_url=image_url,
                recipient_name=recipient_name,
                signature_url=signature_url,
                extracted_text=extracted,
                confidence_score=ocr_result.get("confidence_score", 0),
                processing_time=ocr_result.get("processing_time", 0),
                status='completed'
            )
            
            db.add(new_scan)
            db.commit()
            db.refresh(new_scan)
            
            # 6. DEDUCT CREDITS & LOG HISTORY
            current_user.credits -= SCAN_COST
            
            credit_log = CreditHistory(
                user_id=current_user.id,
                amount=-SCAN_COST,
                action='scan',
                reference_id=new_scan.id
            )
            db.add(credit_log)
            db.commit()
            
            # 7. RETURN RESPONSE
            return {
                "id": new_scan.id,
                "file_path": image_url,
                "imagekit_url": image_url,
                "extracted_text": extracted,
                "recipient_name": recipient_name,
                "signature_url": signature_url,
                "status": "completed",
                "credits_remaining": current_user.credits
            }
        finally:
            # 8. CLEANUP TEMP FILE
            try:
                os.unlink(tmp_path)
            except:
                pass
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Save scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Save failed: {str(e)}")
```

**🎯 Pelajaran Penting:**
- **Credit Check First:** Validasi credits sebelum processing (line 9-13)
- **Try-Finally Pattern:** Cleanup temp files meski error (line 24, 74-78)
- **Transaction Pattern:** Commit database setelah semua operasi sukses (line 66)
- **Error Handling:** Catch specific HTTPException vs generic Exception (line 80-85)

---

### 2️⃣ Authentication: Dual Token Support

**File:** `utils/auth.py` - Support JWT & Supabase OAuth

```python
async def get_current_user(
    token: str = Depends(oauth2_scheme),           # JWT Token
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),  # Supabase Token
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user - supports both JWT and Supabase tokens"""
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Check if Supabase is available
    if not supabase:
        raise HTTPException(
            status_code=500, 
            detail="Server Error: Supabase connection not configured"
        )
    
    # 1. TRY SUPABASE TOKEN FIRST (Google OAuth)
    if credentials:
        try:
            supabase_token = credentials.credentials
            user_response = supabase.auth.get_user(supabase_token)
            
            if user_response.user:
                # Get or create user in local DB
                email = user_response.user.email
                user = db.query(User).filter(User.email == email).first()
                
                if not user:
                    # Auto-create user for OAuth login
                    user = User(
                        email=email,
                        username=email.split('@')[0],
                        hashed_password="",  # No password for OAuth users
                        credits=10,
                        is_active=True
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                
                return user
        except Exception as e:
            print(f"⚠️ Supabase auth failed: {str(e)}")
            # Continue to fallback JWT instead of raising immediately
    
    # 2. FALLBACK TO JWT TOKEN (Email/Password Login)
    if token:
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            user_id: int = payload.get("sub")
            
            if user_id is None:
                raise credentials_exception
                
            user = db.query(User).filter(User.id == user_id).first()
            
            if user is None:
                raise credentials_exception
            
            return user
        except JWTError:
            pass
    
    # 3. BOTH FAILED - RAISE 401
    raise credentials_exception
```

**🎯 Pelajaran Penting:**
- **Graceful Fallback:** Try Supabase → Fallback to JWT (line 21-47, 50-63)
- **Auto User Creation:** OAuth users dibuat otomatis di local DB (line 32-42)
- **No Password for OAuth:** OAuth users tidak punya password (line 36)
- **Continue on Error:** Supabase error tidak langsung raise, coba JWT dulu (line 45-46)

---

### 3️⃣ Dashboard Stats: Monthly Cleanup Cycle

**File:** `api/dashboard.py` - Calculate cleanup cycle based on join date

```python
@router.get("/stats")
async def get_dashboard_stats(user = Depends(get_current_user)):
    """Get user's dashboard statistics - Only DGTNZ feature"""
    try:
        user_id = str(user.id) if hasattr(user, 'id') else str(user.get('id'))
        
        # Get user's current credits and created_at date
        user_data = supabase_admin.table("users").select("credits, created_at").eq("id", user_id).execute()
        credits = user_data.data[0].get("credits", 10) if user_data.data else 10
        user_created_at = user_data.data[0].get("created_at") if user_data.data else None
        
        total_activities = 0
        days_until_cleanup = 30
        next_cleanup = datetime.now() + timedelta(days=30)
        
        if user_created_at:
            # Parse Creation Date (handle Z for UTC)
            if user_created_at.endswith('Z'):
                user_created_at = user_created_at[:-1] + '+00:00'
            
            join_date = datetime.fromisoformat(user_created_at)
            now = datetime.now(join_date.tzinfo) if join_date.tzinfo else datetime.now()
            
            # 1. CALCULATE CLEANUP CYCLE (30-day cycles from join date)
            days_since_join = (now - join_date).days
            if days_since_join < 0: days_since_join = 0
            
            cycle_number = days_since_join // 30           # Which cycle are we in?
            days_in_current_cycle = days_since_join % 30   # Days into current cycle
            days_until_cleanup = 30 - days_in_current_cycle # Days remaining
            
            current_cycle_start = join_date + timedelta(days=cycle_number * 30)
            next_cleanup = now + timedelta(days=days_until_cleanup)
            
            # 2. COUNT SCANS IN CURRENT CYCLE (Total Activity)
            scans_count = supabase_admin.table("scans")\
                .select("id", count="exact")\
                .eq("user_id", user_id)\
                .gte("created_at", current_cycle_start.isoformat())\
                .execute()
            
            total_activities = scans_count.count or 0
            
        return {
            "totalActivities": total_activities,
            "credits": credits,
            "maxCredits": 10,
            "nextCleanupDays": days_until_cleanup,
            "nextCleanupDate": next_cleanup.strftime("%d %b %Y"),
        }
        
    except Exception as e:
        print(f"❌ Dashboard Stats Error: {e}")
        # Return safe defaults on error
        return {
            "totalActivities": 0,
            "credits": 10,
            "maxCredits": 10,
            "nextCleanupDays": 30,
            "nextCleanupDate": (datetime.now() + timedelta(days=30)).strftime("%d %b %Y"),
        }
```

**🎯 Pelajaran Penting:**
- **Cycle Calculation:** 30-day cycles dari join date, bukan fixed date (line 26-32)
- **Timezone Handling:** Parse UTC 'Z' suffix dengan benar (line 18-19)
- **Current Cycle Scans:** Hitung activity dari awal cycle, bukan total (line 35-41)
- **Safe Defaults:** Return default values jika error (line 54-61)

---

### 4️⃣ Image Enhancement: Signature Brightness

**File:** `services/imagekit_qr_service.py` - Enhance signature before upload

```python
@staticmethod
def upload_signature(file: Union[bytes, str], file_name: str) -> dict:
    """Upload signature with brightness enhancement to ImageKit QR account"""
    
    try:
        # 1. READ FILE CONTENT
        if isinstance(file, bytes):
            content = file
        elif isinstance(file, str) and (file.startswith('/') or file.startswith('C:')):
            with open(file, 'rb') as f:
                content = f.read()
        else:
            content = file
        
        # 2. ENHANCE SIGNATURE BRIGHTNESS AND CONTRAST
        print("🎨 Enhancing signature brightness...")
        img = Image.open(BytesIO(content))
        
        # Handle transparency (RGBA) before converting to RGB
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            img = img.convert('RGBA')
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])  # Use alpha channel as mask
            img = background
        
        # Convert to RGB if needed (e.g. Grayscale)
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Increase brightness by 30%
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(1.3)
        
        # Increase contrast by 15%
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.15)
        
        # 3. CONVERT BACK TO BYTES
        buffer = BytesIO()
        img.save(buffer, format='PNG', quality=95)
        enhanced_content = buffer.getvalue()
        
        # 4. UPLOAD TO IMAGEKIT
        file_content = base64.b64encode(enhanced_content).decode('utf-8')
        
        options = UploadFileRequestOptions(
            folder="/qr-signatures",
            use_unique_file_name=True,
            overwrite_file=False
        )
        
        result = imagekit_qr.upload_file(
            file=file_content,
            file_name=file_name,
            options=options
        )
        
        # 5. EXTRACT RESULT (Handle different response formats)
        url = getattr(result, 'url', None)
        file_id = getattr(result, 'file_id', None)
        
        # Fallback for dict response
        if url is None and isinstance(result, dict):
            url = result.get('url')
            file_id = result.get('fileId')
        
        # Fallback to response_metadata
        if url is None and hasattr(result, 'response_metadata'):
            raw = result.response_metadata.raw
            url = raw.get('url')
            file_id = raw.get('fileId')
        
        return {
            "file_id": file_id,
            "url": url,
            "name": file_name
        }
        
    except Exception as e:
        print(f"❌ Signature upload error: {str(e)}")
        raise Exception(f"Signature upload failed: {str(e)}")
```

**🎯 Pelajaran Penting:**
- **Transparency Handling:** Convert RGBA to RGB dengan white background (line 20-24)
- **Image Enhancement:** Brightness +30%, Contrast +15% (line 30-36)
- **Multiple Fallbacks:** Handle different ImageKit response formats (line 58-70)
- **Type Flexibility:** Accept bytes, file path, or base64 string (line 7-13)

---

### 5️⃣ User Registration with Password Hashing

**File:** `api/auth.py` - Secure user registration

```python
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register new user"""
    
    # 1. CHECK IF USER EXISTS (Email OR Username)
    existing_user = db.query(User).filter(
        (User.email == user_data.email) | (User.username == user_data.username)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email or username already registered"
        )
    
    # 2. HASH PASSWORD (Never store plain password!)
    hashed_password = get_password_hash(user_data.password)
    
    # 3. CREATE NEW USER
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password,
        credits=10  # Initial credits (daily reset)
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user
```

**🎯 Pelajaran Penting:**
- **Duplicate Check:** Check email OR username dengan single query (line 6-8)
- **Password Hashing:** Never store plain password, use bcrypt (line 17)
- **Initial Credits:** New users get 10 credits (line 24)
- **Refresh Pattern:** Refresh object after commit to get DB-generated fields (line 29)

---

### 6️⃣ Background Task Pattern

**File:** `api/scans.py` - Process OCR in background

```python
async def process_scan_background(scan_id: int, file_path: str, db: Session):
    """Background task to process OCR"""
    try:
        # 1. PROCESS OCR (Time-consuming task)
        result = await OCRService.process_image(file_path, use_ai_enhancement=True)
        
        # 2. UPDATE SCAN RECORD WITH RESULTS
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if scan:
            scan.extracted_text = result['enhanced_text']
            scan.confidence_score = result['confidence_score']
            scan.processing_time = result['processing_time']
            scan.status = 'completed'
            db.commit()
    
    except Exception as e:
        # 3. UPDATE SCAN WITH ERROR (Don't crash!)
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if scan:
            scan.status = 'failed'
            scan.error_message = str(e)
            db.commit()

# Usage in endpoint:
@router.post("/upload")
async def upload_scan(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # ... create scan record with status='processing' ...
    
    # Add background task (non-blocking)
    background_tasks.add_task(process_scan_background, new_scan.id, file_path, db)
    
    # Return immediately (don't wait for OCR)
    return new_scan
```

**🎯 Pelajaran Penting:**
- **Non-Blocking:** Return response immediately, process OCR in background (line 34-37)
- **Error Handling:** Update status to 'failed' if OCR crashes (line 17-22)
- **Status Tracking:** Use status field: pending → processing → completed/failed (line 13, 20)
- **BackgroundTasks:** FastAPI built-in, no need for Celery for simple tasks (line 26, 34)

---

## 🔍 Pattern Summary

### ✅ Best Practices yang Diterapkan:

1. **Dependency Injection**
   ```python
   current_user: User = Depends(get_current_active_user)
   db: Session = Depends(get_db)
   ```

2. **Try-Finally for Cleanup**
   ```python
   try:
       # Use temp file
   finally:
       os.unlink(tmp_path)  # Always cleanup
   ```

3. **Graceful Fallbacks**
   ```python
   try:
       # Try primary method
   except:
       # Fallback to secondary method
   ```

4. **Transaction Pattern**
   ```python
   db.add(record)
   db.commit()
   db.refresh(record)  # Get DB-generated fields
   ```

5. **Safe Defaults on Error**
   ```python
   except Exception as e:
       print(f"Error: {e}")
       return {"default": "values"}  # Don't crash frontend
   ```

---

**🎉 Selamat Belajar!** Jika ada pertanyaan, cek kode langsung atau tanya di dokumentasi resmi.
