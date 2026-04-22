<div align="center">

# 🔍 OCR.WTF

**AI-Powered Document Intelligence Platform**

*Scan · Verify · Analyze · Protect*

[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Frontend](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Database](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![OCR](https://img.shields.io/badge/OCR-Tesseract_+_GPT--4o-412991?style=flat-square&logo=openai)](https://openai.com/)
[![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?style=flat-square&logo=docker)](https://docker.com/)

[Live Demo](https://ocr.wtf) · [API Docs](https://api-ocr.xyz/api/docs)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [User Flows](#user-flows)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Database Schema](#database-schema)
- [Security](#security)
- [Scheduled Jobs](#scheduled-jobs)
- [Environment Variables](#environment-variables)

---

## Overview

**OCR.WTF** is a full-stack document intelligence platform designed for the Indonesian logistics and finance market. It transforms physical documents (receipts, invoices, surat jalan) into structured digital data using AI-powered OCR, provides fraud verification through cryptographic hashing, and offers an AI chatbot for document Q&A — all accessible via a mobile-first progressive web app.

### Key Capabilities

| Capability | Description |
|-----------|-------------|
| **DGTNZ Scanner** | AI OCR with auto-correction, batch processing, digital signatures |
| **Fraud Detection** | Cryptographic document verification with confidence scoring |
| **Otaru AI Chatbot** | Upload docs and ask questions in natural language |
| **Financial Analysis** | Auto-extract structured data: amounts, dates, clients |
| **Invoice Generator** | Create professional invoices from scan data |
| **Partner Portal** | B2B API key management, credit scoring endpoint, pricing |
| **Admin Panel** | User management, credit control, activity monitoring |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│                    React 18 · Vite · TypeScript                     │
│              Shadcn/UI · Framer Motion · Tailwind CSS               │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NGINX (Reverse Proxy + SSL)                      │
│              Let's Encrypt · CORS Preflight · Gzip                  │
│                      api-ocr.xyz:443                                │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP :8000
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FASTAPI APPLICATION                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────────┐ │
│  │ Scans API│ │ Fraud API│ │ Chat API │ │Admin   │ │Partner API │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬───┘ └─────┬──────┘ │
│       │             │            │             │           │        │
│  ┌────▼─────────────▼────────────▼─────────────▼───────────▼──────┐ │
│  │                    SERVICES LAYER                               │ │
│  │  OCR Service · Scan Helpers · ImageKit · Drive · Chatbot       │ │
│  └────┬──────────┬──────────┬──────────┬──────────┬───────────────┘ │
│       │          │          │          │          │                  │
│  ┌────▼──┐  ┌───▼───┐  ┌──▼───┐  ┌──▼───┐  ┌──▼──────┐           │
│  │Tesser-│  │OpenAI │  │ Groq │  │Image-│  │Google  │           │
│  │ act   │  │GPT-4o │  │Llama3│  │ Kit  │  │Drive   │           │
│  └───────┘  └───────┘  └──────┘  └──────┘  └────────┘           │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │            MIDDLEWARE (Rate Limit · IP Block · Security)      │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │  Supabase  │ │ PostgreSQL │ │   Redis    │
     │  Auth+RLS  │ │  (Local)   │ │   Queue    │
     └────────────┘ └────────────┘ └────────────┘
```

### Data Flow

```
Document Upload → ImageKit Storage → Tesseract OCR → GPT-4o Enhancement
       ↓                                                      ↓
  Digital Signature                              Structured Field Extraction
       ↓                                                      ↓
  SHA-256 Hash                               Confidence Scoring (low/med/high)
       ↓                                                      ↓
  Supabase Sync ←←←←←←←←←←←← Status Mapping ←←←←←←←←←
                               low  → tampered  (rejected, not saved)
                               med  → processing (saved, needs review)
                               high → verified   (saved, authentic)
```

---

## Features

### 📸 DGTNZ Scanner
- **AI-Powered OCR**: Tesseract + GPT-4o for 98%+ accuracy
- **Batch Processing**: Scan up to 20 files via Redis queue worker
- **Digital Signatures**: Capture and embed recipient signatures
- **Multi-Format**: Supports JPG, PNG, PDF
- **Auto-Correction**: AI fixes OCR typos and formats structured data
- **Google Drive Export**: One-click export as Excel

### 🔍 Fraud Detection
- **Confidence Scoring**: 3-tier system based on verifiable field count
  - 🔴 **Low (0-1 fields)** → `tampered` — Auto-rejected, not saved
  - 🟡 **Medium (2 fields)** → `processing` — Accepted, needs manual review
  - 🟢 **High (3+ fields)** → `verified` — Document authenticated
- **Cryptographic Verification**: SHA-256 content hashing
- **Structured Extraction**: Nominal, client name, surat jalan number, due date

### 🤖 Otaru AI Chatbot
- **Document Q&A**: Upload images, PDFs, or DOCX and ask questions
- **Session Management**: Multi-session chat history stored in Supabase
- **Privacy-First**: Files processed in-memory, never stored on server

### 📊 Dashboard
- **Logistics Trust Score**: Weighted scoring function via Supabase RPC
- **Revenue Tracking**: Real-time financial data
- **Weekly Activity Chart**: Real-time updates via Supabase channels
- **Credit Balance**: 10 daily credits, auto-reset at midnight WIB

### 🤝 Partner Portal (B2B)
- **API Key Management**: Generate, rotate, and revoke API keys
- **Credit Scoring API**: `GET /api/v1/scoring/{email}` — returns trust score, risk label, scan history
- **Interactive Playground**: Test the scoring API directly from the portal
- **API Docs**: cURL examples, response format, integration guide
- **Pricing Plans**: Starter (Rp29k/mo), Growth (Rp99k/mo), Enterprise (custom)

### 🛡️ Admin Panel
> Restricted to admin email (configurable via `ADMIN_EMAIL` env var)

- **User Management**: List all users with email, credits, online status
- **Credit Control**: Set/add credits for any user
- **Ban/Unban**: Instantly ban or unban users
- **Activity Viewer**: Per-user activity breakdown
- **Audit Logging**: All admin actions logged

---

## User Flows

### Main App Flow
```
Landing Page (ocr.wtf)
    │
    ├─ Click "Start Free" / "Sign In"
    │       ↓
    │   Google OAuth Login
    │       ↓
    │   Main Dashboard
    │       ├── Dashboard Tab (stats, trust score, activity)
    │       ├── DGTNZ Tab (scan, fraud detection)
    │       ├── Otaru Tab (AI chatbot)
    │       └── Profile Tab (settings, credits)
    │
    └─ Not logged in → Landing page with features overview
```

### Partner Portal Login Flow
```
Partner Portal (/partner)
    │
    ├─ Already logged in → Full portal access
    │       ├── Dashboard (platform stats)
    │       ├── API + Docs (key management, playground, docs)
    │       └── Pricing (plan selection)
    │
    └─ Not logged in
            ↓
        Click "Sign In with Google"
            ↓
        Sets localStorage flag "redirect_to_partner"
            ↓
        Google OAuth → Redirects to main dashboard (/)
            ↓
        Main Dashboard detects flag → Shows popup:
        "Lanjut ke Otaru Partner?"
            ↓
        ├── Click "Buka Partner Portal" → Navigate to /partner
        │   (flag cleared, popup won't show again)
        │
        └── Click X (dismiss) → Stay on dashboard
            (flag cleared, popup won't show again)
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------| 
| **Frontend** | React 18, Vite, TypeScript | SPA with mobile-first responsive UI |
| **UI** | Shadcn/UI, Tailwind CSS, Framer Motion | Components, styling, animations |
| **Backend** | FastAPI, Python 3.12 | REST API, background tasks |
| **Auth** | Supabase Auth (Google OAuth) | Authentication, JWT tokens |
| **Database** | Supabase (PostgreSQL) | Primary data store |
| **Queue** | Redis, Custom Worker | Batch scan processing |
| **OCR** | Tesseract OCR | Base text extraction |
| **AI** | OpenAI GPT-4o-mini | OCR correction, structured extraction |
| **AI Fallback** | Groq Llama 3.3 70B | Backup (4 key rotation) |
| **Storage** | ImageKit (2 accounts) | Document images + QR/signatures |
| **Backup** | Google Drive API | User-initiated scan export |
| **Infra** | Docker Compose, Nginx, Let's Encrypt | Container, proxy, SSL |
| **Hosting** | OpenCloudOS VPS (2GB RAM) | Production server |

---

## Project Structure

```
├── be/                              # FastAPI Backend
│   ├── api/
│   │   ├── admin.py                 # Admin panel endpoints
│   │   ├── auth.py                  # Authentication
│   │   ├── chatbot.py               # Otaru AI chatbot
│   │   ├── chat_history.py          # Chat session CRUD
│   │   ├── cleanup.py               # Scheduled jobs (credit reset, cleanup)
│   │   ├── config.py                # App config endpoint
│   │   ├── dashboard.py             # Dashboard aggregation
│   │   ├── exports.py               # Google Drive export
│   │   ├── fraud.py                 # Fraud detection
│   │   ├── invoices.py              # Invoice generation
│   │   ├── partner.py               # B2B Partner API (scoring, API keys)
│   │   ├── payment.py               # Payment proxy
│   │   ├── report.py                # PDF/email reports
│   │   ├── reviews.py               # User review system
│   │   ├── scan_insight.py          # Scan insight analysis
│   │   ├── scans.py                 # Core scan CRUD + upload
│   │   ├── telegram.py              # Telegram bot integration
│   │   ├── upload.py                # File upload handler
│   │   └── users.py                 # User profile, credits
│   ├── config/                      # Settings, database, Redis
│   ├── middleware/security.py       # Rate limiting, IP blocking, headers
│   ├── models/                      # SQLAlchemy ORM models
│   ├── schemas/                     # Pydantic schemas
│   ├── services/                    # Business logic (OCR, chatbot, etc.)
│   ├── utils/auth.py               # JWT + Supabase token validation
│   ├── workers/                     # Background workers (scan, telegram)
│   ├── main.py                      # FastAPI app entry point
│   └── Dockerfile
│
├── fe/                              # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/MainLayout.tsx    # Main app shell + partner popup
│   │   │   ├── layout/Header.tsx        # Dashboard header
│   │   │   ├── tabs/DashboardTab.tsx    # Dashboard view
│   │   │   ├── tabs/DgtnzTab.tsx        # Scanner + fraud view
│   │   │   ├── tabs/ProfileTab.tsx      # User profile
│   │   │   ├── tabs/AdminTab.tsx        # Admin panel
│   │   │   ├── tabs/ApiTab.tsx          # API tab (within dashboard)
│   │   │   ├── ui/                      # Reusable UI components
│   │   │   ├── LandingPage.tsx          # Public landing page
│   │   │   └── LoginPage.tsx            # Login page
│   │   ├── pages/
│   │   │   ├── Index.tsx                # Root page (landing/login/app)
│   │   │   ├── PartnerPortal.tsx        # Partner Portal (standalone page)
│   │   │   └── OtaruChatPage.tsx        # Otaru AI chatbot
│   │   ├── hooks/                       # Custom React hooks
│   │   ├── lib/supabaseClient.ts        # Supabase client
│   │   ├── context/DeviceContext.tsx     # Device detection
│   │   └── types/                       # TypeScript types
│   └── vite.config.ts
│
├── database/
│   ├── schema.sql                   # Supabase table definitions
│   └── enable_rls_all.sql           # RLS policies
│
├── .github/workflows/deploy-be.yml  # Backend CI/CD
└── docker-compose.yml               # Backend + Redis + Workers
```

---

## API Reference

### Authentication
All authenticated endpoints require `Authorization: Bearer <supabase_jwt>` header.

### Core Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/scans/save-with-signature` | Bearer | Process scan with OCR + signature |
| `GET` | `/api/scans/` | Bearer | List user's scan history |
| `POST` | `/api/scans/save-fraud` | Bearer | Process fraud scan |
| `GET` | `/api/scans/fraud-history` | Bearer | List fraud scan history |
| `POST` | `/api/chatbot/chat` | Bearer | Send message to AI chatbot |
| `GET` | `/api/dashboard/stats` | Bearer | Dashboard statistics |
| `GET` | `/api/users/credits` | Bearer | Get credit balance |
| `POST` | `/api/exports/drive` | Bearer | Export to Google Drive |

### Partner API (B2B)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/apikeys/generate` | Bearer | Generate/rotate API key |
| `GET` | `/api/v1/apikeys/me` | Bearer | Get active API key |
| `DELETE` | `/api/v1/apikeys/me` | Bearer | Revoke API key |
| `GET` | `/api/v1/partner/stats` | Public | Platform stats |
| `GET` | `/api/v1/scoring/{email}` | x-api-key | Credit score by email |

### Admin Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/admin/users` | Bearer (admin) | List all users |
| `POST` | `/api/admin/users/{id}/credits` | Bearer (admin) | Set credits |
| `POST` | `/api/admin/users/{id}/ban` | Bearer (admin) | Ban/unban |
| `DELETE` | `/api/admin/users/{id}` | Bearer (admin) | Delete user |

> **Full interactive docs**: [https://api-ocr.xyz/api/docs](https://api-ocr.xyz/api/docs)

---

## Getting Started

### Prerequisites

| Dependency | Version |
|-----------|---------|
| Python | 3.12+ |
| Node.js | 18+ |
| Docker & Docker Compose | Latest |
| Redis | 7+ |
| Tesseract OCR | 5+ |

### Backend

```bash
cd be
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env       # Configure environment variables
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd fe
npm install
npm run dev  # http://localhost:5173
```

### Docker (Full Stack)

```bash
docker compose up -d --build
# Backend:  http://localhost:8000
# API Docs: http://localhost:8000/api/docs
```

---

## Deployment

### Production (OpenCloudOS VPS)

```bash
ssh root@<VPS_IP>
cd ~/Logistic-Dokumen
git pull origin main
docker compose down --remove-orphans
docker compose up -d --build
```

### Nginx Config

Located at `/etc/nginx/conf.d/api-ocr.conf`:
- SSL termination via Let's Encrypt
- CORS preflight with `x-api-key` in allowed headers
- Proxy pass to `127.0.0.1:8000`

### Frontend Deployment

Auto-deployed to **Vercel** from `main` branch.

---

## Database Schema

### Supabase Tables (14 tables with RLS)

| Table | Description |
|-------|-------------|
| `profiles` | User profiles, credits |
| `documents` | Scanned document records |
| `extracted_finance_data` | Structured financial data |
| `fraud_scans` | Fraud detection results |
| `chat_sessions` | Chatbot sessions |
| `chat_messages` | Chat messages |
| `activities` | User activity log |
| `document_audits` | Document audit trail |
| `invoices` | Generated invoices |
| `reviews` | App reviews |
| `imagekit_files` | ImageKit file tracking |
| `credit_history` | Credit usage log |
| `api_keys` | Partner API keys |
| `admin_audit_logs` | Admin action log |

> Backend uses `service_role` key → bypasses RLS. Frontend uses `anon` key → RLS enforced.

---

## Security

- **Supabase Auth** with Google OAuth 2.0, JWT validation on every request
- **Row Level Security (RLS)** on all Supabase tables
- **Rate Limiting** per IP (100 req/min global, endpoint-specific limits)
- **IP Blocking** for abusive IPs (auto-block via Redis)
- **Security Headers**: HSTS, X-Content-Type-Options, XSS Protection
- **CORS Whitelist**: Specific allowed origins (no wildcard)
- **Zero Data Retention** for chatbot file uploads
- **SHA-256 Hashing** for document integrity verification

---

## Scheduled Jobs

| Job | Schedule | Endpoint |
|-----|----------|----------|
| Daily Credit Reset | 00:00 WIB | `POST /api/cleanup/daily-credit-reset` |
| Monthly Cleanup | 1st of month 03:00 WIB | `POST /api/cleanup/monthly-cleanup` |

```bash
0 17 * * * curl -s -X POST https://api-ocr.xyz/api/cleanup/daily-credit-reset -H "Authorization: Bearer $CLEANUP_SECRET"
0 20 1 * * curl -s -X POST https://api-ocr.xyz/api/cleanup/monthly-cleanup -H "Authorization: Bearer $CLEANUP_SECRET"
```

---

## Environment Variables

See [`.env.example`](.env.example) for the complete template.

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `DATABASE_URL` | ✅ | Local PostgreSQL connection |
| `OPENAI_API_KEY` | ✅ | OpenAI API key |
| `GROQ_API_KEY_1..4` | ❌ | Groq fallback keys |
| `IMAGEKIT_PUBLIC_KEY` | ✅ | ImageKit public key |
| `IMAGEKIT_PRIVATE_KEY` | ✅ | ImageKit private key |
| `REDIS_URL` | ✅ | Redis connection string |
| `ADMIN_EMAIL` | ❌ | Admin email |
| `CLEANUP_SECRET` | ✅ | Cron job auth secret |
| `JWT_SECRET` | ✅ | JWT signing secret |

---

## License

Proprietary software. All rights reserved. © 2025 OCR.WTF
