# 🔐 Environment Variables & API Keys Setup Guide

## 📁 File Structure

```
Supply-Chain/
├── be/
│   ├── .env          # Backend secrets (JANGAN PUSH KE GITHUB!)
│   └── main.py
├── fe/
│   ├── .env.local    # Frontend local (JANGAN PUSH KE GITHUB!)
│   └── .env          # Frontend production (push ke GitHub)
```

---

## 🔑 API Keys Yang Dibutuhkan

### 1️⃣ Supabase PostgreSQL (Database)
### 2️⃣ OCR.space API Key (OCR Service)  
### 3️⃣ Google OAuth Client ID (Login System)

---

## Backend Environment (be/.env)

**PENTING:** File ini **JANGAN PUSH** ke GitHub!

Buat file `be/.env`:

```env
# 1. SUPABASE DATABASE
DATABASE_URL="postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-x-region.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-x-region.pooler.supabase.com:5432/postgres"

# 2. OCR API KEY
OCR_API_KEY="K87256153888957"

# 3. SERVER URLs
BASE_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:5173"

# 4. PRISMA (optional untuk development)
PRISMA_PY_DEBUG_GENERATOR="1"
```
- Deploy ke Vercel
- Build production (`npm run build`)
- Push ke GitHub

---

### 2. `.env.local` (Local Development - JANGAN Push)

**File:** `fe/.env.local`
```env
VITE_API_URL=http://localhost:8000
```

**Kapan dipakai:**
- Development lokal (`npm run dev`)
- Test dengan backend lokal

**Priority:** `.env.local` > `.env` (Vite otomatis pakai `.env.local` kalau ada)

---

## 🚀 Run Local Development

### Terminal 1: Backend
```bash
cd be
python main.py
```
Backend jalan di: `http://localhost:8000`
- Otomatis pakai default `BASE_URL=http://localhost:8000`

### Terminal 2: Frontend
```bash
cd fe
npm run dev
```
Frontend jalan di: `http://localhost:5173`
- Otomatis pakai `.env.local` → `VITE_API_URL=http://localhost:8000`

**Test:** Buka `http://localhost:5173` → upload file → harusnya connect ke backend lokal

---

## 🌐 Production Deployment

### Backend (Render):
✅ Sudah deploy di: `https://logistic-dokumen.onrender.com`
✅ Environment variables di Render Dashboard:
- `BASE_URL` = `https://logistic-dokumen.onrender.com`
- `FRONTEND_URL` = `https://ocrai.vercel.app`
- `PYTHON_VERSION` = `3.11.0`

### Frontend (Vercel):
✅ Sudah deploy di: `https://ocrai.vercel.app`
✅ Vercel otomatis pakai `fe/.env` → `VITE_API_URL=https://logistic-dokumen.onrender.com`

**Atau set di Vercel Dashboard:**
1. Project **ocrai** → Settings → Environment Variables
2. Key: `VITE_API_URL` → Value: `https://logistic-dokumen.onrender.com`
3. Save → Redeploy

---

## 📝 Summary

| Environment | Backend | Frontend |
|-------------|---------|----------|
| **Local** | Default `localhost:8000` | `.env.local` → `localhost:8000` |
| **Production** | Render Dashboard env vars | `.env` → `logistic-dokumen.onrender.com` |

### Current Setup:
- ✅ `be/` - No .env needed (uses defaults or Render env vars)
- ✅ `fe/.env` - Production URL (pushed to GitHub)
- ✅ `fe/.env.local` - Local URL (git ignored)

### To Switch Between Local/Production:

**Testing Local:**
```bash
# Backend terminal
cd be
python main.py

# Frontend terminal  
cd fe
npm run dev  # Otomatis pakai .env.local
```

**Testing Production:**
```bash
# Langsung buka browser
https://ocrai.vercel.app
```

---

## 🔐 Git Ignore

Pastikan `.env.local` tidak di-push:

**File:** `.gitignore`
```
.env.local
.env.*.local
```

`.env` (production) **boleh di-push** karena itu URL public.

---

## ⚠️ Troubleshooting

### Frontend lokal connect ke backend production
**Problem:** Frontend lokal pakai `.env` (production URL) instead of `.env.local`

**Solution:** 
- Pastikan file `.env.local` ada di folder `fe/`
- Restart dev server: `Ctrl+C` → `npm run dev`
- Vite prioritas: `.env.local` > `.env`

### Backend lokal tidak bisa diakses frontend
**Problem:** CORS error

**Solution:** Backend `main.py` sudah include `localhost:5173` di CORS:
```python
allow_origins=[
    "http://localhost:5173",  # ✅ Sudah ada
    ...
]
```

Restart backend kalau masih error.
