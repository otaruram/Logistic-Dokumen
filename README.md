# 🚀 OCR.WTF - AI-POWERED OCR AUTOMATION

> Scan dokumen otomatis dengan kecerdasan buatan - Cepat, Akurat, Tanpa Ribet!

[![Live Demo](https://img.shields.io/badge/Demo-Live-brightgreen)](https://www.ocr.wtf)
[![Backend API](https://img.shields.io/badge/API-Render-blue)](https://logistic-dokumen.onrender.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🎯 OVERVIEW

**OCR.WTF** adalah aplikasi web modern yang mengubah cara Anda mengelola dokumen. Dengan teknologi **OCR berbasis AI**, aplikasi ini mampu mengekstrak data dari dokumen fisik secara otomatis, mengurangi input manual hingga 90%, dan dilengkapi dengan **AI Chatbot (OKi)** untuk membantu analisis dokumen.

### 🚀 Fitur Utama:
- ✅ **Scan & OCR Otomatis** - Upload foto dokumen, ekstrak data otomatis
- ✅ **Multi-Document Support** - PB, PU, PP, LN, NF, Disposisi, PDLN
- ✅ **AI Chatbot (OKi)** - Tanya jawab tentang isi dokumen dengan AI
- ✅ **Digital Signature** - Tanda tangan digital dengan canvas/kamera
- ✅ **Camera Capture** - Ambil foto langsung dari kamera (front/back)
- ✅ **Export Excel/CSV** - Download data dalam format spreadsheet
- ✅ **Google Drive Integration** - Upload otomatis laporan ke Google Drive
- ✅ **Real-time Search** - Pencarian data dengan filter tanggal
- ✅ **Responsive Design** - Light Brutalism aesthetic, mobile-friendly

**Problem Solved:** Menghilangkan proses input data manual yang memakan waktu 2-3 jam/hari menjadi hanya 5-10 menit dengan scan otomatis.

---

## 🏗️ TECH STACK

### Frontend
- **React 18** + **Vite** - Modern UI development
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling with brutalist design
- **shadcn/ui** - High-quality UI components
- **Google OAuth** - Secure authentication
- **React Router** - Client-side routing
- **Lucide Icons** - Beautiful icon library

### Backend
- **OCR API** - API for scan
- **Prisma** - ORM
- **OpenAI API** - AI chatbot integration
- **Pillow & OpenCV** - Image preprocessing
- **SQLite** - Lightweight database
- **Python 3.11+** - Modern Python features

### Deployment
- **Frontend:** Vercel (auto-deploy from GitHub)
- **Backend:** Render.com (with Aptfile for system dependencies)
- **Database:** SQLite (file-based, auto-created)

---

## 📂 PROJECT STRUCTURE

```
Supply-Chain/
├── fe/                      # Frontend (React + Vite + TypeScript)
│   ├── src/
│   │   ├── components/      # UI Components
│   │   ├── pages/           # Pages
│   │   ├── lib/             # Utilities
│   │   └── hooks/           # Custom Hooks
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── be/                      # Backend (Python + FastAPI)
│   ├── main.py              # FastAPI server
│   ├── requirements.txt     # Python dependencies
│   ├── supply_chain.db      # SQLite database (auto-generated)
│   └── logs/                # Export files folder
└── README.md
```

---

## 🚀 CARA MENJALANKAN

### Prerequisites
- Node.js 18+ & npm
- Python 3.9+
- Git

### 1. Clone Repository
```bash
git clone https://github.com/otaruram/Logistic-Dokumen.git
cd Logistic-Dokumen
```

### 2. Setup Frontend
```bash
cd fe
npm install
npm run dev
```
Frontend akan berjalan di **http://localhost:8080**

### 3. Setup Backend
```bash
cd be
pip install -r requirements.txt
python main.py
```
Backend akan berjalan di **http://localhost:8000**

API Documentation (Swagger): **http://localhost:8000/docs**

---

## 🎨 DESIGN SYSTEM

Aplikasi menggunakan **Light Brutalism Design** dengan karakteristik:
- ⬛ **Bold Black Borders** - Garis tegas 2-4px untuk struktur visual
- 🟥 **Hard Shadows** - Shadow offset untuk depth tanpa blur
- 🔤 **Monospace Typography** - Font mono untuk aesthetic industrial
- 🎯 **Flat Colors** - No gradients, solid colors only
- ⚡ **Tactile Interactions** - Button press effects dengan transform
- 📱 **Responsive Grid** - Mobile-first approach

---

## 📝 FITUR LENGKAP

### 1. 📸 Document Scanning
- **Upload File** - Drag & drop atau browse untuk upload
- **Camera Capture** - Ambil foto langsung dari browser
- **Front/Back Camera** - Switch camera untuk mobile devices
- **Auto OCR** - Ekstraksi teks otomatis dengan AI
- **Image Preview** - Preview dokumen sebelum diproses

### 2. 🤖 AI Chatbot (OKi)
- **Document Analysis** - Tanya jawab tentang isi dokumen
- **Smart Context** - AI memahami konteks dokumen yang di-scan
- **Conversational** - Natural language interface
- **Powered by OpenAI** - GPT-4 powered responses

### 3. ✍️ Digital Signature
- **Canvas Drawing** - Tanda tangan dengan mouse/touchscreen
- **Camera Capture** - Foto tanda tangan fisik
- **Save & Edit** - Simpan dan edit signature
- **Transparent Background** - PNG export untuk overlay

### 4. 📊 Data Management
- **Real-time Table** - Update otomatis setelah scan
- **Multi-column Search** - Filter berdasarkan penerima, ringkasan, tanggal
- **Pagination** - Navigate data dengan smooth
- **Export Excel/CSV** - Download data untuk reporting
- **Google Drive Upload** - Upload otomatis laporan ke Google Drive dengan konversi ke Google Sheets
- **Date Filtering** - Filter data berdasarkan range tanggal

### 5. 🔐 Authentication
- **Google OAuth 2.0** - Login dengan akun Google
- **JWT Decode** - Secure token handling
- **Session Management** - Persistent login state
- **Profile Display** - Show user info di header


---

## 🚀 DEPLOYMENT

### Production URLs
- **Frontend:** https://ocrai.vercel.app/

### Environment Variables Required

**Frontend (.env.local):**
```env
VITE_API_URL=https://logistic-dokumen.onrender.com
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

**Backend (Render Environment Variables):**
```env
SUMOPOD_API_KEY=your_openai_api_key
SUMOPOD_BASE_URL=https://ai.sumopod.com/v1
OCR_API_KEY=your_ocr_space_api_key
DATABASE_URL=your_supabase_postgres_url
GOOGLE_DRIVE_API_KEY=your_google_drive_api_key
GOOGLE_DRIVE_FOLDER_NAME=LOGISTIC.AI Reports
BASE_URL=your_backend_url
FRONTEND_URL=your_frontend_url
```

### Deployment Steps
1. **Fork this repository** ke GitHub Anda
2. **Deploy Frontend** di Vercel (auto-detect Vite)
3. **Deploy Backend** di Render dengan Python runtime
4. **Set Environment Variables** di dashboard masing-masing platform
5. **Test Live Demo** untuk memastikan integrasi

---

## 🛠️ TECH STACK DETAIL

**Frontend:**
- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Lucide Icons
- XLSX (export Excel)

**Backend:**
- Python 3.13
- FastAPI
- EasyOCR
- Pandas
- Pillow (PIL)
- NumPy
- OpenCV
- Prisma

---

## 📊 DATABASE SCHEMA

```sql
CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    filename TEXT,
    kategori TEXT,
    nomor_dokumen TEXT,
    receiver TEXT,
    summary TEXT,
    full_text TEXT
)
```

---

## 🔌 API ENDPOINTS

### GET `/`
Health check

### POST `/scan`
Upload dan proses dokumen
- **Input:** 
  - `file`: Image file (multipart/form-data)
  - `receiver`: Nama penerima (form field)
- **Output:** JSON dengan hasil OCR

### GET `/history`
Ambil semua riwayat scan

### GET `/export`
Download data dalam format Excel

---

## 👤 DEVELOPER

**Made by Someone**

---

## 📄 LICENSE

MIT License

---

## 🙏 ACKNOWLEDGMENTS

- EasyOCR for OCR engine
- shadcn/ui for UI components
- FastAPI for backend framework (UPDATED)

```text
Supply-Chain/
├── README.md               <-- This file
├── fe/                     <-- Frontend (React + Vite + TypeScript)
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── ...                 <-- All frontend files
├── be/                     <-- Backend (Python + FastAPI) - To be implemented
│   └── README.md
└── .gitignore

### Original Structure (Before Reorganization):
root/
├── README.md               <-- This file
├── backend/                <-- Python Server
│   ├── venv/               <-- Virtual Environment
│   ├── main.py             <-- FastAPI Entry Point
│   └── requirements.txt    <-- Python Dependencies
└── frontend/               <-- React App
    ├── src/
    │   ├── App.tsx         <-- Main UI Logic
    │   ├── api.ts          <-- API Integration Logic
    │   └── index.css       <-- Tailwind / Global Styles
    ├── package.json
    └── vite.config.ts
```

---

## 🤖 DESIGN SYSTEM: "LIGHT BRUTALISM" (INSTRUCTIONS FOR AI)

When generating UI code, adhere to these strict design rules:

* **Vibe:** Industrial, Raw, High-Contrast, Functional.
* **Colors:**
  * Background: `#FFFFFF` (Stark White)
  * Text/Borders: `#000000` (Pitch Black)
  * Accent: `#FF5F1F` (Safety Orange - for primary actions)
* **Shapes:** No rounded corners (`rounded-none`).
* **Borders:** Thick solid borders (`border-2` or `border-4 black`).
* **Shadows:** Hard shadows (no blur), e.g., `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`.
* **Typography:** Monospace fonts (Courier, JetBrains Mono).

---

## 🔌 API CONTRACT (Backend <-> Frontend)

**Endpoint:** `POST /scan`

* **Request:** `multipart/form-data`
  * Key: `file` (The image file)

* **Response (JSON):**
```json
{
  "status": "success",
  "data": {
    "text": "FULL RAW TEXT EXTRACTED...",
    "summary": "First 150 characters...",
    "category": "INVOICE" | "SURAT JALAN" | "UNKNOWN"
  }
}
```

---

## 🚀 SETUP INSTRUCTIONS

### 1. Setup Backend (Terminal 1)

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
python main.py
# Server will run at: http://localhost:8000
```

### 2. Setup Frontend (Terminal 2)

```bash
cd frontend
npm install
npm run dev
# App will run at: http://localhost:5173
```

### 3. Setup Google Drive API (Optional)

Untuk mengaktifkan fitur upload otomatis ke Google Drive:

1. **Buat Project di Google Cloud Console**
   - Kunjungi https://console.cloud.google.com/
   - Buat project baru atau gunakan yang sudah ada

2. **Aktifkan Google Drive API**
   - Di menu APIs & Services, klik "Enable APIs and Services"
   - Cari "Google Drive API" dan aktifkan

3. **Buat API Key**
   - Di menu "Credentials", klik "Create Credentials" → "API Key"
   - Copy API Key yang dihasilkan

4. **Tambahkan ke Environment Variables**
   ```env
   GOOGLE_DRIVE_API_KEY=your_api_key_here
   GOOGLE_DRIVE_FOLDER_NAME=LOGISTIC.AI Reports
   ```

5. **Test Upload**
   - Jalankan aplikasi dan klik tombol "GDRIVE" di dashboard
   - File akan otomatis di-upload dan dikonversi ke Google Sheets

---

## 📈 FUTURE ROADMAP (SUPPLY CHAIN ANALYTICS)

- [ ] Implement specific Regex for "PO Number" extraction.
- [ ] Add a Dashboard chart for "Daily Items Received".
- [ ] Integrate with SQL Database for historical tracking.

---

## 📝 WHY THIS README IS AI-FRIENDLY

1. **Context Injection:** The "PROJECT OVERVIEW FOR AI ASSISTANTS" section tells AI assistants what role to take (Supply Chain Developer).
2. **Design System Rules:** Light Brutalism rules are explicit (color codes, border thickness) so AI generates consistent UI.
3. **API Contract:** Clear JSON structure ensures AI generates correct axios/fetch code.
#   D e p l o y   t r i g g e r   -   1 2 / 1 3 / 2 0 2 5   1 6 : 2 0 : 2 5  
 