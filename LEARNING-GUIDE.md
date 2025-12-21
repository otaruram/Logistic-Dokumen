# 🎓 CORE CODE LEARNING GUIDE - OCR.WTF

> **Panduan untuk memahami codebase OCR.WTF dari nol sampai mahir**

---

## 📚 **TAHAP 1: FUNDAMENTALS (Wajib Pahami Dulu)**

### **1.1. Entry Point - `be/main.py`**
**File terpenting!** Ini adalah otak dari aplikasi.

```python
# KONSEP KUNCI:
app = FastAPI()  # Initialize aplikasi

# Middleware (urutan penting!)
1. SecurityHeadersMiddleware    # XSS, clickjacking protection
2. IPBlockingMiddleware          # Block malicious IPs
3. RateLimitMiddleware          # DDoS protection (100 req/min)

# Routers (endpoint groups)
app.include_router(auth.router)      # /api/auth/*
app.include_router(scans.router)     # /api/scans/*
app.include_router(quiz.router)      # /api/quiz/*
```

**Yang Harus Dipahami:**
- ✅ **Middleware order matters** - Security headers dulu, baru rate limiting
- ✅ **Router = endpoint group** - Semua `/api/auth/*` ada di `api/auth.py`
- ✅ **CORS settings** - Allow origins untuk frontend (localhost + production)

---

### **1.2. Configuration - `be/config/settings.py`**
**Semua environment variables ada di sini.**

```python
# KONSEP KUNCI:
class Settings(BaseSettings):
    SUPABASE_URL: str           # Database URL
    SUPABASE_SERVICE_ROLE_KEY   # Admin key (bypass RLS)
    OPENAI_API_KEY             # AI key for OCR/Quiz
    JWT_SECRET                  # Token encryption
    REDIS_HOST                  # Cache server
```

**Yang Harus Dipahami:**
- ✅ **Pydantic BaseSettings** - Auto-load dari `.env` file
- ✅ **Service Role vs Anon Key** - Service role bypass RLS
- ✅ **Environment separation** - Dev vs Production config

---

### **1.3. Database Connection - `be/config/database.py`**
**Connection pooling ke Supabase (PostgreSQL).**

```python
# KONSEP KUNCI:
engine = create_engine(
    DATABASE_URL,
    pool_size=10,        # 10 concurrent connections
    max_overflow=20      # +20 if needed
)

SessionLocal = sessionmaker(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db  # Dependency injection
    finally:
        db.close()  # Always close!
```

**Yang Harus Dipahami:**
- ✅ **Connection pooling** - Reuse connections (faster)
- ✅ **Dependency injection** - `Depends(get_db)` auto-close
- ✅ **Context manager** - `try/finally` ensures cleanup

---

## 🔐 **TAHAP 2: AUTHENTICATION (Critical untuk Security)**

### **2.1. Auth Flow - `be/api/auth.py` + `be/utils/auth.py`**

**Flow Login:**
```python
1. User POST /api/auth/login dengan email + password
2. Backend query user dari database
3. Verify password dengan bcrypt
4. Generate JWT token (expire 7 hari)
5. Return token ke frontend
6. Frontend simpan di localStorage
7. Frontend kirim token di header: Authorization: Bearer <token>
```

**Flow Protected Endpoint:**
```python
@router.post("/submit")
async def submit_review(
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_active_user)  # ← Magic!
):
    # current_user sudah authenticated!
    # Bisa langsung pakai current_user.id, current_user.email
```

**Yang Harus Dipahami:**
- ✅ **JWT (JSON Web Token)** - Stateless auth (no session storage)
- ✅ **Bcrypt hashing** - Password never stored plain text
- ✅ **Depends()** - FastAPI dependency injection untuk auth
- ✅ **OAuth2PasswordBearer** - Standard OAuth2 token flow

**File Kunci:**
- `be/utils/auth.py` → `get_current_user()` function (decode JWT)
- `be/api/auth.py` → Login/Register endpoints

---

## 🧠 **TAHAP 3: AI INTEGRATION (Yang Bikin Project Ini Keren)**

### **3.1. OCR Service - `be/services/ocr_service.py`**

**Pipeline:**
```python
1. Upload image → Save to temp file
2. Tesseract OCR → Extract raw text (local, free)
3. GPT-3.5 Turbo → Fix typos (via Sumopod proxy)
4. Return: raw_text + enhanced_text + confidence_score
```

**Code Breakdown:**
```python
# Step 1: Tesseract OCR (local processing)
text = pytesseract.image_to_string(image)
confidence = average_confidence(data['conf'])

# Step 2: AI Enhancement (API call)
response = openai.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "system", "content": "Fix OCR typos"},
        {"role": "user", "content": raw_text}
    ]
)
enhanced_text = response.choices[0].message.content
```

**Yang Harus Dipahami:**
- ✅ **Tesseract** - Free OCR engine (85-95% accuracy)
- ✅ **OpenAI API** - GPT-3.5 untuk koreksi typo
- ✅ **Sumopod proxy** - Custom base_url (bukan OpenAI langsung)
- ✅ **Cost optimization** - Tesseract gratis, GPT hanya untuk enhancement

**File Kunci:**
- `be/services/ocr_service.py` → OCR logic
- `be/api/scans.py` → Upload & process endpoint

---

### **3.2. Quiz Generator - `be/api/quiz.py`**

**Pipeline:**
```python
1. Upload PDF → PyPDF2 extract text
2. GPT-4o → Generate 20 questions dengan 4 options
3. Validate JSON structure
4. Save to Supabase
5. Return quiz_id
```

**Prompt Engineering (PENTING!):**
```python
system_prompt = """You are an expert professor.
Create {num_questions} questions in Indonesian.
Each question must have 4 options, ONLY 1 correct.
Use VALID JSON format."""

user_prompt = f"""Topic: {topic}
Context: {pdf_text}

JSON format:
{{
  "title": "Kuis: ...",
  "questions": [
    {{
      "id": 1,
      "question": "...",
      "options": [
        {{"text": "A", "isCorrect": false}},
        {{"text": "B", "isCorrect": true}},
        ...
      ],
      "explanation": "..."
    }}
  ]
}}
"""
```

**Yang Harus Dipahami:**
- ✅ **GPT-4o** - Lebih expensive tapi better quality ($0.05-0.10/request)
- ✅ **Prompt engineering** - System + user prompt structure
- ✅ **JSON response format** - `response_format={"type": "json_object"}`
- ✅ **Error handling** - Validate structure before save

**File Kunci:**
- `be/api/quiz.py` → Quiz generation logic

---

## 🛡️ **TAHAP 4: SECURITY (DDoS Protection)**

### **4.1. Rate Limiting - `be/middleware/security.py`**

**3-Layer Protection:**
```python
# Layer 1: Global rate limit
100 requests/minute per IP

# Layer 2: Endpoint-specific limits
"/api/scans/upload": 10 req/min     # OCR expensive
"/api/quiz/generate": 5 req/min     # GPT-4 very expensive
"/api/auth/login": 10 req/min       # Prevent brute force

# Layer 3: IP blocking
if rate_limit_exceeded:
    block_ip(ip_address, duration=3600)  # 1 hour ban
```

**Implementation:**
```python
class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        ip = request.client.host
        path = request.url.path
        
        # Check Redis for rate limit
        count = redis.incr(f"rate:{ip}:{path}")
        redis.expire(f"rate:{ip}:{path}", 60)  # 1 minute window
        
        if count > limit:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests"}
            )
        
        return await call_next(request)
```

**Yang Harus Dipahami:**
- ✅ **Redis for rate limiting** - In-memory counter (very fast)
- ✅ **Sliding window** - 60 second window with auto-expire
- ✅ **Middleware pattern** - Intercept all requests
- ✅ **HTTP 429** - Standard "Too Many Requests" status code

**File Kunci:**
- `be/middleware/security.py` → Rate limiting + security headers
- `be/config/redis_client.py` → Redis connection

---

## 📊 **TAHAP 5: CACHING STRATEGY**

### **5.1. Redis Cache - `be/config/redis_client.py`**

**Cache Pattern:**
```python
# 1. Check cache first
cache_key = f"user:{user_id}:credits"
cached = redis.get(cache_key)
if cached:
    return cached  # 1-5ms response time! ⚡

# 2. If miss, query database
result = db.query(User).filter_by(id=user_id).first()

# 3. Store in cache
redis.setex(cache_key, 300, result.credits)  # Cache 5 minutes

# 4. Return result
return result
```

**Cache Strategy:**
```python
# Hot data (frequently accessed)
user_credits → 5 minutes
dashboard_stats → 1 minute
reviews_list → 10 minutes

# Cold data (rarely accessed)
invoice_history → 1 hour
old_scans → 24 hours
```

**Yang Harus Dipahami:**
- ✅ **Cache-aside pattern** - Check cache first, fallback to DB
- ✅ **TTL (Time To Live)** - Auto-expire old data
- ✅ **Cache invalidation** - Update/delete cache when data changes
- ✅ **Redis data types** - String, Hash, List, Set

---

## 🎯 **TAHAP 6: KEY DESIGN PATTERNS**

### **6.1. Dependency Injection**
```python
# FastAPI magic: Auto-resolve dependencies
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/users/me")
async def get_me(
    db: Session = Depends(get_db),           # Auto-inject DB
    user: User = Depends(get_current_user)    # Auto-inject User
):
    # db and user already available!
    return user
```

### **6.2. Pydantic Validation**
```python
# Input validation (before hitting database)
class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)           # 1-5 only
    feedback: str = Field(max_length=1000)    # Max 1000 chars

# If invalid → HTTP 422 Unprocessable Entity
# If valid → Continue to endpoint
```

### **6.3. ORM (SQL Injection Protection)**
```python
# ❌ NEVER do this (SQL injection vulnerable):
query = f"SELECT * FROM users WHERE email = '{email}'"

# ✅ ALWAYS use ORM (parameterized query):
user = db.query(User).filter(User.email == email).first()
# Generated SQL: SELECT * FROM users WHERE email = $1
# Parameter: [email] ← automatically escaped!
```

---

## 🗂️ **FILE STRUCTURE OVERVIEW**

### **Must Understand (Core):**
```
be/
├── main.py                    # ⭐ Entry point (start here!)
├── config/
│   ├── settings.py           # ⭐ Environment variables
│   ├── database.py           # ⭐ DB connection pool
│   └── redis_client.py       # ⭐ Redis cache client
├── api/
│   ├── auth.py              # ⭐ Login/Register
│   ├── scans.py             # ⭐ OCR endpoints
│   ├── quiz.py              # ⭐ AI quiz generator
│   └── reviews.py           # Submit reviews
├── middleware/
│   └── security.py           # ⭐ Rate limiting + DDoS protection
├── services/
│   └── ocr_service.py       # ⭐ Tesseract + GPT integration
└── utils/
    └── auth.py              # ⭐ JWT + password hashing
```

### **Nice to Know (Secondary):**
```
be/
├── models/
│   └── models.py            # SQLAlchemy models (DB tables)
├── schemas/
│   └── schemas.py           # Pydantic schemas (validation)
├── api/
│   ├── invoices.py          # Invoice generator
│   ├── tools.py             # PDF tools (compress, split, etc)
│   ├── dashboard.py         # Analytics
│   └── community.py         # Reviews & teams
└── utils/
    ├── pdf_tools.py         # PDF manipulation
    └── file_handler.py      # File upload/download
```

### **Can Ignore (Not Important):**
```
be/
├── *.sql files              # Database migrations (one-time setup)
├── migrate.py               # Prisma migration (deprecated)
├── setup.py                 # Initial setup script
└── IMPLEMENTATION_SUMMARY.md # Old documentation
```

---

## 🎓 **LEARNING PATH (Step-by-Step)**

### **Week 1: Foundations**
1. ✅ Read `be/main.py` - Understand app initialization
2. ✅ Read `be/config/settings.py` - Learn environment config
3. ✅ Read `be/config/database.py` - Understand connection pooling
4. ✅ Read `be/utils/auth.py` - JWT authentication flow
5. ✅ Test: Create a simple endpoint with auth protection

### **Week 2: Core Features**
1. ✅ Read `be/services/ocr_service.py` - Tesseract + GPT pipeline
2. ✅ Read `be/api/scans.py` - OCR endpoint implementation
3. ✅ Read `be/api/quiz.py` - GPT-4 quiz generator
4. ✅ Test: Generate quiz from PDF, analyze prompt engineering
5. ✅ Experiment: Modify prompts, see output changes

### **Week 3: Security & Performance**
1. ✅ Read `be/middleware/security.py` - Rate limiting implementation
2. ✅ Read `be/config/redis_client.py` - Cache strategy
3. ✅ Read `be/models/models.py` - Database schema
4. ✅ Test: Trigger rate limit, see IP blocking
5. ✅ Monitor: Check Redis cache hit rate

### **Week 4: Advanced Topics**
1. ✅ Study Docker deployment (`Dockerfile`, `docker-compose.yml`)
2. ✅ Analyze nginx config (reverse proxy)
3. ✅ Review Supabase RLS policies (row level security)
4. ✅ Load testing with 100 concurrent users
5. ✅ Cost optimization strategies

---

## 💡 **KEY CONCEPTS TO MASTER**

### **1. Async/Await**
```python
# Synchronous (blocks thread)
def slow_function():
    time.sleep(5)  # Blocks for 5 seconds
    return "done"

# Asynchronous (non-blocking)
async def fast_function():
    await asyncio.sleep(5)  # Other requests processed meanwhile
    return "done"
```

### **2. Middleware Pattern**
```python
# Execute code BEFORE endpoint
async def dispatch(request, call_next):
    # Before endpoint
    print("Request received")
    
    # Call endpoint
    response = await call_next(request)
    
    # After endpoint
    print("Response sent")
    return response
```

### **3. Dependency Injection**
```python
# Auto-resolve dependencies (no manual instantiation)
async def endpoint(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # db and user automatically injected!
```

### **4. ORM Pattern**
```python
# Object-Relational Mapping (SQL as Python objects)
user = db.query(User).filter(User.email == email).first()
# Instead of: SELECT * FROM users WHERE email = ?
```

### **5. Caching Strategy**
```python
# Cache-aside pattern
1. Check cache → Hit? Return
2. Miss? → Query DB
3. Store in cache
4. Return result
```

---

## 🚀 **NEXT LEVEL: SCALING**

### **Things to Learn:**
1. **Kubernetes** - Container orchestration (auto-scaling)
2. **Load Balancing** - Distribute traffic across multiple servers
3. **Database Sharding** - Split database for performance
4. **CDN Integration** - Cloudflare for global edge caching
5. **Monitoring** - Prometheus, Grafana, Sentry

---

## 📚 **RECOMMENDED RESOURCES**

### **FastAPI:**
- Official Docs: https://fastapi.tiangolo.com
- Tutorial: FastAPI + SQLAlchemy + Alembic

### **Redis:**
- Redis University: https://university.redis.com
- Learn caching strategies

### **Docker:**
- Docker Docs: https://docs.docker.com
- Multi-stage builds optimization

### **PostgreSQL:**
- PostgreSQL Tutorial: https://www.postgresqltutorial.com
- Connection pooling, indexes, query optimization

### **Security:**
- OWASP Top 10: https://owasp.org/www-project-top-ten
- Learn: SQL injection, XSS, CSRF, DDoS

---

**🎯 FOCUS ORDER:**
1. **main.py** → Understand app structure
2. **auth.py + utils/auth.py** → Authentication flow
3. **ocr_service.py + scans.py** → AI integration
4. **middleware/security.py** → DDoS protection
5. **redis_client.py** → Caching strategy

**Start with `main.py` and follow the imports!** 🚀
