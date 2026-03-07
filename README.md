<div align="center">

# 🔍 OCR.WTF

**AI-Powered Document Intelligence Platform**

*Scan · Verify · Analyze · Protect*

[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Frontend](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Database](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![OCR](https://img.shields.io/badge/OCR-Tesseract_+_GPT--4o-412991?style=flat-square&logo=openai)](https://openai.com/)
[![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?style=flat-square&logo=docker)](https://docker.com/)

[Live Demo](https://ocr.wtf) · [API Docs](https://api-ocr.xyz/api/docs) · [Report Bug](https://github.com/otaruram/Logistic-Dokumen/issues)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Database Schema](#database-schema)
- [Security](#security)
- [Scheduled Jobs](#scheduled-jobs)
- [Environment Variables](#environment-variables)
- [License](#license)

---

## Overview

**OCR.WTF** is a full-stack document intelligence platform designed for the Indonesian logistics and finance market. It transforms physical documents (receipts, invoices, surat jalan) into structured digital data using AI-powered OCR, provides fraud verification through cryptographic hashing, and offers an AI chatbot for document Q&A — all accessible via a mobile-first progressive web app.

### Key Capabilities

| Capability | Description |
|-----------|-------------|
| **DGTNZ Scanner** | AI OCR with auto-correction, batch processing, digital signatures |
| **Fraud Detection** | Cryptographic document verification with confidence scoring (tampered/processing/verified) |
| **Otaru AI Chatbot** | Upload docs and ask questions in natural language (supports images, PDF, DOCX) |
| **Financial Analysis** | Auto-extract structured data: amounts, dates, clients, invoice numbers |
| **Invoice Generator** | Create professional invoices from scan data |
| **Admin Panel** | User management, credit control, activity monitoring, ban/unban |

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
│  │ Scans API│ │ Fraud API│ │ Chat API │ │Admin API│ │ Cleanup API│ │
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
- **Separate Fraud Log**: Dedicated `fraud_scans` table in Supabase

### 🤖 Otaru AI Chatbot
- **Document Q&A**: Upload images, PDFs, or DOCX and ask questions
- **Session Management**: Multi-session chat history stored in Supabase
- **Privacy-First**: Files processed in-memory, never stored on server
- **Smart Context**: AI understands document structure and content

### 📊 Dashboard
- **Logistics Trust Score**: Weighted scoring function via Supabase RPC
- **Revenue Tracking**: Real-time financial data from `extracted_finance_data`
- **Weekly Activity Chart**: Real-time updates via Supabase channels
- **Credit Balance**: 10 daily credits, auto-reset at midnight WIB
- **Status Breakdown**: Visual cards for verified/processing/tampered counts

### 🛡️ Admin Panel
> Restricted to admin email (configurable via `ADMIN_EMAIL` env var)

- **User Management**: List all users with email, credits, online status
- **Credit Control**: Set/add credits for any user
- **Ban/Unban**: Instantly ban or unban users via Supabase Auth
- **Delete Users**: Complete data wipe across all tables
- **Activity Viewer**: Per-user activity breakdown (scans, chats, fraud)
- **Data Retention**: Extend cleanup retention period per user
- **Audit Logging**: All admin actions logged to `admin_audit_logs` table
- **Infinite Credits**: Admin exempt from credit deduction and daily reset

### 📋 Additional Features
- **Invoice Generator**: Create invoices from scan data
- **User Reviews**: In-app review system displayed on landing page
- **Multi-Language**: Indonesian and English support
- **Delete Account**: Complete self-service account deletion

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, Vite, TypeScript | SPA with mobile-first responsive UI |
| **UI Framework** | Shadcn/UI, Tailwind CSS, Framer Motion | Component library, styling, animations |
| **Backend** | FastAPI, Python 3.12, SQLAlchemy | REST API, ORM, background tasks |
| **Auth** | Supabase Auth (Google OAuth) | Authentication, JWT tokens |
| **Database** | Supabase (PostgreSQL), Local PostgreSQL | Primary data store, scan records |
| **Queue** | Redis, Custom Worker | Batch scan processing |
| **OCR Engine** | Tesseract OCR | Base text extraction |
| **AI Enhancement** | OpenAI GPT-4o-mini | OCR correction, structured extraction |
| **AI Fallback** | Groq Llama 3.3 70B | Backup for OpenAI downtime (4 key rotation) |
| **File Storage** | ImageKit (2 accounts) | Document images + QR/signatures |
| **Cloud Backup** | Google Drive API | User-initiated scan export |
| **Infrastructure** | Docker Compose, Nginx, Let's Encrypt | Containerization, reverse proxy, SSL |
| **Hosting** | OpenCloudOS VPS (2GB RAM) | Production server |

---

## Project Structure

```
├── be/                              # FastAPI Backend
│   ├── api/
│   │   ├── admin.py                 # Admin panel endpoints (email-guarded)
│   │   ├── auth.py                  # Authentication (login/register)
│   │   ├── chatbot.py               # Otaru AI chatbot endpoints
│   │   ├── chat_history.py          # Chat session CRUD
│   │   ├── cleanup.py               # Scheduled jobs (credit reset, data cleanup)
│   │   ├── config.py                # App config endpoint
│   │   ├── dashboard.py             # Dashboard aggregation
│   │   ├── exports.py               # Google Drive export
│   │   ├── fraud.py                 # Fraud detection endpoints
│   │   ├── invoices.py              # Invoice generation
│   │   ├── reviews.py               # User review system
│   │   ├── scans.py                 # Core scan CRUD + upload
│   │   ├── upload.py                # File upload handler
│   │   └── users.py                 # User profile, credits, delete account
│   ├── config/
│   │   ├── database.py              # SQLAlchemy engine + sessions
│   │   ├── redis_config.py          # Redis connection
│   │   └── settings.py              # Environment variables loader
│   ├── middleware/
│   │   └── security.py              # Rate limiting, IP blocking, security headers
│   ├── models/
│   │   └── models.py                # SQLAlchemy ORM models
│   ├── schemas/
│   │   └── schemas.py               # Pydantic request/response schemas
│   ├── services/
│   │   ├── chatbot_service.py       # AI chatbot logic (OpenAI + Groq)
│   │   ├── drive_service.py         # Google Drive API integration
│   │   ├── imagekit_qr_service.py   # ImageKit upload (QR/signatures)
│   │   ├── imagekit_service.py      # ImageKit upload (standard)
│   │   ├── ocr_service.py           # Tesseract + AI OCR pipeline
│   │   ├── queue_service.py         # Redis job queue
│   │   └── scan_helpers.py          # Shared: credits, upload+OCR, Supabase sync
│   ├── utils/
│   │   └── auth.py                  # JWT + Supabase token validation
│   ├── workers/
│   │   └── scan_worker.py           # Background batch scan processor
│   ├── main.py                      # FastAPI app entry point
│   ├── Dockerfile                   # Backend container
│   └── requirements.txt             # Python dependencies
│
├── fe/                              # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/           # Header, stats cards
│   │   │   ├── dgtnz/               # Scan history, fraud history
│   │   │   ├── layout/              # MainLayout, responsive container
│   │   │   ├── tabs/                # DashboardTab, DgtnzTab, AdminTab, etc.
│   │   │   ├── ui/                  # Bottom navigation, buttons, cards
│   │   │   └── LandingPage.tsx      # Public landing page (SEO optimized)
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── lib/                     # Supabase client, utilities
│   │   ├── pages/                   # OtaruChatPage
│   │   └── types/                   # TypeScript type definitions
│   ├── index.html                   # SEO meta tags, JSON-LD structured data
│   └── vite.config.ts               # Vite configuration
│
├── database/
│   ├── schema.sql                   # Supabase table definitions
│   └── enable_rls_all.sql           # RLS policies for all tables
│
├── .github/workflows/
│   └── deploy-be.yml                # Backend CI/CD (Docker build + deploy)
│
├── docker-compose.yml               # Backend + Redis + Scan Worker
└── .env.example                     # Environment variable template
```

---

## API Reference

### Authentication
All authenticated endpoints require `Authorization: Bearer <supabase_jwt>` header.

### Scans
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/scans/` | List user's scan history |
| `POST` | `/api/scans/upload-signature` | Upload and enhance digital signature |
| `POST` | `/api/scans/save-with-signature` | Process scan with OCR + signature |
| `DELETE` | `/api/scans/{id}` | Delete a scan record |

### Fraud Detection
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/scans/fraud-history` | List user's fraud scan history |
| `POST` | `/api/scans/save-fraud` | Process fraud scan (auto-reject low confidence) |
| `DELETE` | `/api/scans/{id}` | Delete a fraud record |

### Chatbot (Otaru)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chatbot/chat` | Send message to AI chatbot (supports file upload) |
| `GET` | `/api/chatbot/stats` | Get chatbot usage statistics |
| `GET` | `/api/chat-history/sessions` | List chat sessions |
| `DELETE` | `/api/chat-history/sessions/{id}` | Delete a chat session |

### Admin (Requires admin email)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/stats` | Global platform statistics |
| `GET` | `/api/admin/users` | List all users |
| `GET` | `/api/admin/users/{id}/activity` | User activity details |
| `POST` | `/api/admin/users/{id}/credits` | Set user credits |
| `POST` | `/api/admin/users/{id}/ban` | Ban/unban user |
| `DELETE` | `/api/admin/users/{id}` | Delete user + all data |
| `POST` | `/api/admin/users/{id}/extend-retention` | Extend data retention |

### Scheduled Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cleanup/daily-credit-reset` | Reset all credits to 10 (admin excluded) |
| `POST` | `/api/cleanup/monthly-cleanup` | Delete data older than 30 days |

### Dashboard & Misc
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users/credits` | Get current credit balance |
| `GET` | `/api/dashboard/stats` | Dashboard statistics |
| `POST` | `/api/exports/drive` | Export scans to Google Drive |
| `POST` | `/api/reviews/` | Submit app review |

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
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env  # Configure your environment variables
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

The production stack runs on an OpenCloudOS VPS with Nginx reverse proxy and Let's Encrypt SSL.

```bash
# Deploy / Update
ssh root@<VPS_IP>
cd ~/Logistic-Dokumen
git pull origin main
docker compose down --remove-orphans
docker compose up -d --build
```

### Nginx Configuration

Located at `/etc/nginx/conf.d/api-ocr.conf`:
- SSL termination (certs at `/etc/letsencrypt/live/api-ocr.xyz/`)
- OPTIONS preflight handled with CORS headers
- Proxy pass to `127.0.0.1:8000`

### SSL Renewal

```bash
certbot renew --dry-run   # Test
certbot renew             # Actual renewal
```

### Frontend Deployment

Frontend is deployed to **Vercel** (auto-deploy from `main` branch) or manually built:

```bash
cd fe && npm run build  # Output in fe/dist/
```

---

## Database Schema

### Supabase Tables (13 tables with RLS)

| Table | RLS Policy | Description |
|-------|-----------|-------------|
| `profiles` | `auth.uid() = id` | User profiles, credits |
| `documents` | `auth.uid() = user_id` | Scanned document records |
| `extracted_finance_data` | `auth.uid() = user_id` | Structured financial data |
| `fraud_scans` | `auth.uid() = user_id` | Fraud detection results |
| `chat_sessions` | `auth.uid() = user_id` | Chatbot conversation sessions |
| `chat_messages` | via session cascade | Individual chat messages |
| `activities` | `auth.uid() = user_id` | User activity log |
| `document_audits` | `auth.uid() = user_id` | Document audit trail |
| `invoices` | `auth.uid() = user_id` | Generated invoices |
| `reviews` | `auth.uid() = user_id` | App reviews |
| `imagekit_files` | `auth.uid() = user_id` | ImageKit file tracking |
| `credit_history` | `auth.uid() = user_id` | Credit usage log |
| `admin_audit_logs` | admin only | Admin action log |

> Backend uses `service_role` key → bypasses RLS automatically.
> Frontend uses `anon` key → RLS policies enforced.

### Local PostgreSQL Tables

| Table | Purpose |
|-------|---------|
| `users` | Local user records (synced with Supabase Auth) |
| `scans` | Scan records with OCR results |
| `invoices` | Invoice data |
| `credit_history` | Credit deduction log |

---

## Security

### Authentication
- **Supabase Auth** with Google OAuth 2.0
- JWT tokens validated on every API request
- Dual-token support: Supabase JWT + custom JWT fallback

### Data Protection
- **Row Level Security (RLS)** on all 13 Supabase tables
- **In-memory file processing** — uploaded files discarded after analysis
- **Zero data retention** for chatbot file uploads
- **SHA-256 hashing** for document integrity verification

### API Security
- **Rate Limiting**: Request throttling per IP
- **IP Blocking**: Automatic blocking of abusive IPs
- **Security Headers**: HSTS, X-Frame-Options, CSP
- **CORS Whitelist**: Only allowed domains (no wildcard)

### Admin Security
- **Email Guard**: Admin endpoints restricted to `ADMIN_EMAIL`
- **Audit Logging**: Every admin action logged with timestamp
- **Environment Variables**: Sensitive configs read from `.env`

---

## Scheduled Jobs

Configured via crontab on VPS:

| Job | Schedule | Endpoint |
|-----|----------|----------|
| **Daily Credit Reset** | Every day 00:00 WIB | `POST /api/cleanup/daily-credit-reset` |
| **Monthly Data Cleanup** | 1st of month 03:00 WIB | `POST /api/cleanup/monthly-cleanup` |

```bash
# Crontab entries
0 17 * * * curl -s -X POST https://api-ocr.xyz/api/cleanup/daily-credit-reset -H "Authorization: Bearer $CLEANUP_SECRET"
0 20 1 * * curl -s -X POST https://api-ocr.xyz/api/cleanup/monthly-cleanup -H "Authorization: Bearer $CLEANUP_SECRET"
```

> Admin user is automatically excluded from daily credit reset and maintains infinite credits.

---

## Environment Variables

See [`.env.example`](.env.example) for the complete template.

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (bypasses RLS) |
| `DATABASE_URL` | ✅ | Local PostgreSQL connection string |
| `OPENAI_API_KEY` | ✅ | OpenAI API key for OCR enhancement |
| `OPENAI_BASE_URL` | ❌ | Custom OpenAI-compatible endpoint |
| `GROQ_API_KEY_1..4` | ❌ | Groq API keys for AI fallback (rotation) |
| `IMAGEKIT_PUBLIC_KEY` | ✅ | ImageKit public key |
| `IMAGEKIT_PRIVATE_KEY` | ✅ | ImageKit private key |
| `IMAGEKIT_URL_ENDPOINT` | ✅ | ImageKit URL endpoint |
| `IMAGEKIT_*_QR` | ✅ | Separate ImageKit account for QR/signatures |
| `GOOGLE_API_KEY` | ❌ | Google Drive API key |
| `REDIS_URL` | ✅ | Redis connection string |
| `ADMIN_EMAIL` | ❌ | Admin email (default: `okitr52@gmail.com`) |
| `CLEANUP_SECRET` | ✅ | Secret key for cron job authentication |
| `JWT_SECRET` | ✅ | JWT signing secret |

---

## License

Proprietary software. All rights reserved. © 2025 OCR.WTF
