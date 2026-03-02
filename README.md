# OCR.WTF — Document Intelligence Platform

**Scan, digitize, and analyse documents with AI-powered OCR + fraud detection.**

| Layer | Stack |
|-------|-------|
| Frontend | React 18 · Vite · TypeScript · Shadcn/UI · Framer Motion |
| Backend | FastAPI · Python 3.12 · SQLAlchemy · Supabase |
| OCR Engine | Tesseract + OpenAI GPT-4o-mini (+ Groq Llama 3 fallback) |
| Storage | ImageKit (images) · Supabase (DB + Auth + Realtime) |
| Infra | Docker Compose · Nginx · Let's Encrypt · OpenCloudOS VPS |

---

## Features

### DGTNZ (Digitize)
- AI OCR with auto-correction (typos, structure)
- Supports JPG, PNG, PDF
- Batch scan (up to 20 files via Redis queue)
- Recipient & digital signature capture
- Google Drive export (Excel)

### Fraud Detection
- Dedicated fraud scan mode (`/save-fraud`)
- Structured field extraction: nominal, client, surat jalan, due date
- Confidence scoring (low/medium/high)
- Separate `fraud_scans` table in Supabase

### Dashboard
- Logistics Trust Score (weighted scoring function in Supabase)
- Revenue tracking (`extracted_finance_data`)
- Weekly activity chart (realtime via Supabase channels)
- Credit balance + usage history
- Document status breakdown (verified / tampered / processing)

### Security
- Row Level Security (RLS) on **all 13 Supabase tables**
- Rate limiting + IP blocking middleware
- Security headers middleware
- JWT auth via Supabase

---

## Project Structure

```
├── be/                          # FastAPI backend
│   ├── api/
│   │   ├── scans.py             # Core CRUD + upload + save-with-signature
│   │   ├── fraud.py             # Fraud history, debug, save-fraud
│   │   ├── exports.py           # Google Drive export
│   │   ├── auth.py              # Login / register
│   │   ├── users.py             # Profile & credits
│   │   ├── invoices.py          # Invoice generation
│   │   ├── dashboard.py         # Dashboard aggregation
│   │   ├── reviews.py           # User reviews
│   │   ├── cleanup.py           # Weekly data cleanup
│   │   ├── config.py            # App config endpoint
│   │   └── upload.py            # File upload
│   ├── services/
│   │   ├── scan_helpers.py      # Shared: credit check, upload+OCR, Supabase sync
│   │   ├── ocr_service.py       # Tesseract + OpenAI OCR pipeline
│   │   ├── imagekit_service.py  # ImageKit upload (standard)
│   │   ├── imagekit_qr_service.py # ImageKit upload (QR/enhanced)
│   │   ├── queue_service.py     # Redis job queue
│   │   ├── drive_service.py     # Google Drive API
│   │   └── oki_chatbot.py       # AI chatbot service
│   ├── config/                  # Database, Redis, settings
│   ├── middleware/               # Security middlewares
│   ├── models/                  # SQLAlchemy models
│   ├── schemas/                 # Pydantic schemas
│   ├── utils/                   # Auth, file handler, invoice utils
│   ├── workers/                 # Background scan worker
│   ├── main.py                  # FastAPI app entry
│   ├── Dockerfile               # Backend container
│   └── requirements.txt
├── fe/                          # React frontend
│   └── src/
│       ├── components/tabs/     # DashboardTab, DgtnzTab, etc.
│       ├── lib/supabaseClient.ts
│       └── ...
├── database/
│   ├── schema.sql               # Table + function definitions
│   └── enable_rls_all.sql       # RLS policies for all 13 tables
├── docker-compose.yml           # backend + redis + scan-worker
└── vercel.json                  # Frontend deploy config
```

---

## Local Development

### Prerequisites
- Python 3.12+, Node.js 18+, Docker, Redis

### Backend
```bash
cd be
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
# Set env vars (see .env.example)
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd fe
bun install    # or npm install
bun dev        # http://localhost:5173
```

### Docker (full stack)
```bash
docker-compose up -d --build
# Backend: http://localhost:8000
# Docs:    http://localhost:8000/api/docs
```

---

## VPS Deployment (OpenCloudOS)

The production stack runs on an OpenCloudOS VPS with nginx reverse proxy + Let's Encrypt SSL.

### Deploy / Update
```bash
ssh root@<VPS_IP>
cd ~/Logistic-Dokumen
git pull origin main
docker-compose up -d --build
```

### Nginx config
Located at `/etc/nginx/conf.d/api-ocr.conf`:
- SSL termination (certs at `/etc/letsencrypt/live/api-ocr.xyz/`)
- OPTIONS preflight handled by nginx with CORS headers
- All other requests proxied to `127.0.0.1:8000` (FastAPI handles its own CORS)

### SSL renewal
```bash
certbot renew --dry-run   # test
certbot renew             # actual
```

---

## Supabase RLS Setup

All 13 tables must have Row Level Security enabled. Run in Supabase SQL Editor:

```bash
# File: database/enable_rls_all.sql
```

Tables covered:
| Table | Policy |
|-------|--------|
| `profiles` | `auth.uid() = id` |
| `documents` | `auth.uid() = user_id` |
| `extracted_finance_data` | `auth.uid() = user_id` |
| `fraud_scans` | `auth.uid() = user_id` |
| `activities` | `auth.uid() = user_id` |
| `document_audits` | `auth.uid() = user_id` |
| `invoices` | `auth.uid() = user_id` |
| `reviews` | `auth.uid() = user_id` |
| `scans` | `auth.uid() = user_id` |
| `imagekit_files` | `auth.uid() = user_id` |
| `credit_history` | `auth.uid() = user_id` |
| `ppt_history` | `auth.uid() = user_id` |
| `quizzes` | `auth.uid() = user_id` |

> Backend uses `service_role` key → bypasses RLS automatically.  
> Frontend uses `anon` key → policies enforced.

---

## Environment Variables

See [.env.example](.env.example) for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `OPENAI_API_KEY` | OpenAI API key for OCR enhancement |
| `IMAGEKIT_*` | ImageKit credentials |
| `REDIS_URL` | Redis connection string |

---

## License

Proprietary software. All rights reserved.
