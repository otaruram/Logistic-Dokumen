# 🚀 OCR.WTF - All-in-One Document Management Platform

![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)

> Professional document scanning, invoice generation, PDF tools, and AI-powered quiz creation - all in one platform.

## 🌟 Features

### 🔍 DGTNZ.WTF - OCR Document Scanner
- Real-time document scanning with Tesseract OCR
- Multi-language support (English & Indonesian)
- ImageKit integration for cloud storage
- Activity tracking and analytics

### 📄 Invoice.WTF - Invoice Generator
- Professional invoice creation
- Customizable templates
- PDF export with password protection
- Invoice history and management

### 📝 PDF.WTF - PDF Tools Suite
- **Compress PDF** - Reduce file size before sending
- **Merge Images** - Combine 2-4 images into one PDF
- **Split PDF** - Extract specific pages
- **PDF to Images** - Convert PDF pages to JPG
- **Unlock PDF** - Remove password protection
- **Watermark** - Add text overlay to PDFs

### 🎯 Quiz.WTF - AI Quiz Generator
- GPT-4 powered quiz creation
- PDF-based context extraction
- Multiple choice questions
- PDF report download with jsPDF
- Quiz history and results tracking

### 👥 Community Features
- User reviews and ratings
- Activity feed
- Profile management
- Credit system (10 credits per user)

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **Supabase** - PostgreSQL database with real-time subscriptions
- **Redis** - Caching and rate limiting
- **Docker** - Containerization
- **Uvicorn** - ASGI server with 2 workers

### PDF Processing
- **pypdf** - PDF manipulation
- **pdf2image** - PDF to image conversion (Poppler)
- **reportlab** - PDF generation
- **pikepdf** - PDF encryption/decryption
- **pytesseract** - OCR engine

### AI & ML
- **OpenAI GPT-4** - Quiz generation via Sumopod proxy
- **Tesseract OCR** - Document text extraction

### Frontend
- **React** - UI library
- **TypeScript** - Type safety
- **TailwindCSS** - Utility-first CSS
- **Vite** - Build tool
- **Vercel** - Frontend hosting

### Security
- **JWT Authentication** - Secure user sessions
- **Rate Limiting** - DDoS protection (100 req/min per IP)
- **IP Blocking** - Malicious IP blocking
- **Security Headers** - XSS, CSRF protection

## 📁 Project Structure

```
omni-scan-suite-main/
├── fe/                     # Frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── constants/     # Configuration & static data
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities
│   │   ├── pages/         # Page components
│   │   └── types/         # TypeScript types
│   └── package.json
│
├── be/                     # Backend application
│   ├── api/               # API routes
│   │   ├── auth.py       # Authentication endpoints
│   │   ├── scans.py      # OCR/Scan endpoints
│   │   ├── invoices.py   # Invoice endpoints
│   │   └── users.py      # User endpoints
│   ├── config/            # Configuration
│   │   ├── settings.py   # App settings
│   │   └── database.py   # Database config
│   ├── models/            # SQLAlchemy models
│   │   └── models.py
│   ├── schemas/           # Pydantic schemas
│   │   └── schemas.py
│   ├── services/          # Business logic
│   │   └── ocr_service.py # OCR processing
│   ├── utils/             # Utilities
│   │   ├── auth.py       # JWT & password utils
│   │   └── file_handler.py # File operations
│   ├── main.py            # FastAPI app
│   └── requirements.txt
│
├── .env                    # Environment variables (DO NOT COMMIT)
└── .env.example           # Environment template

```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for frontend development)
- Git

### 1. Clone Repository
```bash
git clone https://github.com/otaruram/Logistic-Dokumen.git
cd Logistic-Dokumen
```

### 2. Setup Environment
```bash
# Copy example env file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Required environment variables:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
JWT_SECRET=your_jwt_secret_min_32_chars
API_URL=https://your-domain.com
```

### 3. Run with Docker
```bash
# Build and start all services (backend + Redis)
docker compose build
docker compose up -d

# View logs
docker compose logs -f backend
```

### 4. Verify Installation
```bash
# Check backend health
curl http://localhost:8000/

# Check Redis
docker exec omni-redis redis-cli ping

# Expected: PONG
```

## 📁 Project Structure

```
├── be/                          # Backend (FastAPI)
│   ├── api/                     # API endpoints
│   │   ├── auth.py             # Authentication
│   │   ├── scans.py            # OCR scanning
│   │   ├── invoices.py         # Invoice generation
│   │   ├── quiz.py             # Quiz creation
│   │   ├── tools.py            # PDF tools
│   │   ├── reviews.py          # User reviews
│   │   └── dashboard.py        # Analytics
│   ├── config/                  # Configuration
│   │   ├── settings.py         # App settings
│   │   ├── database.py         # Supabase client
│   │   └── redis_client.py     # Redis client
│   ├── middleware/              # Custom middlewares
│   │   └── security.py         # Rate limiting & DDoS protection
│   ├── models/                  # Database models
│   ├── services/                # Business logic
│   │   ├── ocr_service.py      # OCR processing
│   │   └── imagekit_service.py # Image upload
│   ├── utils/                   # Utilities
│   ├── Dockerfile              # Backend container
│   └── requirements.txt         # Python dependencies
├── fe/                          # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── components/         # UI components
│   │   ├── pages/              # Page components
│   │   ├── constants/          # App constants
│   │   └── lib/                # Utilities
│   └── package.json
├── docker-compose.yml           # Docker orchestration
├── .env.example                 # Environment template
└── README.md                    # This file
```

## 🐳 Docker Services

### Backend (omni-backend)
- **Port**: 8000
- **Image**: Python 3.12-slim + Poppler + Tesseract
- **Workers**: 2 Uvicorn workers
- **Health Check**: Every 30s

### Redis (omni-redis)
- **Port**: 6379
- **Image**: Redis 7 Alpine
- **Memory**: 256MB with LRU eviction
- **Persistence**: AOF enabled

## 🔒 Security Features

### Rate Limiting (per minute)
- **Global**: 100 requests/IP
- **OCR**: 10 requests
- **Quiz**: 5 requests
- **Invoice**: 20 requests
- **PDF Tools**: 10 requests
- **Reviews**: 3 requests
- **Register**: 5 requests
- **Login**: 10 requests

### Security Headers
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000
- Referrer-Policy: strict-origin-when-cross-origin

### IP Blocking
- Auto-block IPs with suspicious activity
- Manual blocklist support
- Redis-based tracking

## 📊 Database Schema

### Users
- id, email, password_hash
- credits (daily reset to 10)
- created_at, updated_at

### Activities
- user_id, feature, action
- metadata (JSON)
- created_at

### Reviews
- user_id, rating, review_text
- created_at

### Quizzes
- user_id, title, topic
- questions (JSON)
- score, created_at

## 🔄 Update Deployment

### Update Code
```bash
cd /path/to/project
git pull origin main
```

### Restart Services
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### View Logs
```bash
docker compose logs -f backend
docker compose logs -f redis
```

## 📝 API Documentation

API docs available at: `http://localhost:8000/api/docs`

### Key Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

#### OCR
- `POST /api/scans/upload` - Upload document for OCR

#### Invoice
- `POST /api/invoices/create` - Create invoice

#### PDF Tools
- `POST /api/tools/compress-pdf` - Compress PDF
- `POST /api/tools/pdf/merge-images` - Merge images to PDF
- `POST /api/tools/pdf/split` - Split PDF pages
- `POST /api/tools/pdf/to-images` - Convert PDF to images
- `POST /api/tools/pdf/unlock` - Remove PDF password
- `POST /api/tools/pdf/watermark` - Add watermark

#### Quiz
- `POST /api/quiz/generate` - Generate quiz with AI

#### Reviews
- `POST /api/reviews/submit` - Submit user review
- `GET /api/reviews/list` - Get all reviews

## 🌐 Production Deployment

### Frontend (Vercel)
```bash
cd fe
vercel --prod
```

### Backend (VPS with Docker)
See [DOCKER-DEPLOYMENT-GUIDE.md](DOCKER-DEPLOYMENT-GUIDE.md) for detailed instructions.

Quick deploy:
```bash
ssh user@your-vps
cd /var/www/api-ocr
git pull origin main
docker compose down
docker compose build
docker compose up -d
```

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check logs
docker compose logs backend

# Rebuild without cache
docker compose build --no-cache
```

### PDF conversion fails
```bash
# Check Poppler installation
docker exec omni-backend pdfinfo -v
```

### Redis connection fails
```bash
# Check Redis status
docker exec omni-redis redis-cli ping

# Restart Redis
docker compose restart redis
```

## 📄 License

This project is proprietary software. All rights reserved.

## 🤝 Contributing

This is a private project. For bugs or feature requests, please contact the maintainer.

## 📧 Contact

- **Website**: https://ocr.wtf
- **API**: https://api-ocr.xyz
- **Frontend**: https://logistic-dokumen.vercel.app

---

Made with ❤️ by OCR.WTF Team