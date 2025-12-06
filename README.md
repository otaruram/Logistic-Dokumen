# 📦 LOGISTIC DOKUMEN - OCR AUTOMATION SYSTEM

> Sistem otomasi digitalisasi dokumen logistik menggunakan OCR (Optical Character Recognition)

---

## 🎯 OVERVIEW

Aplikasi web hybrid untuk mengotomasi proses digitalisasi dokumen kantor seperti:
- Permintaan Pembayaran (PB)
- Pengadaan Umum (PU)
- Permintaan Pembelian (PP)
- Surat Luar Negeri (LN)
- Nota Dinas (NF)
- Lembar Disposisi
- Perjalanan Dinas Luar Negeri (PDLN)

**Tujuan:** Mengurangi input data manual dan meningkatkan efisiensi operasional gudang.

---

## 🏗️ ARSITEKTUR

Aplikasi ini menggunakan **Headless / Decoupled Architecture**:

### Frontend (React + Vite)
- Framework: React 18 dengan Vite
- Language: TypeScript
- Styling: Tailwind CSS dengan Light Brutalism Design
- UI Components: shadcn/ui
- Features:
  - Upload & preview dokumen
  - Input nama penerima & tanda tangan digital
  - Tabel log harian dengan search & pagination
  - Export data ke Excel/CSV

### Backend (Python + FastAPI)
- Framework: FastAPI
- OCR Engine: EasyOCR (PyTorch based)
- Database: SQLite
- Image Processing: Pillow, NumPy, OpenCV
- Features:
  - Ekstraksi teks dari gambar dokumen
  - Deteksi otomatis tipe dokumen
  - Ekstraksi nomor surat dengan regex pattern
  - API REST untuk komunikasi dengan frontend

---

## 📂 STRUKTUR PROJECT

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

## 📝 FITUR UTAMA

### ✅ Upload & OCR
- Upload foto dokumen (JPG, PNG)
- Ekstraksi teks otomatis dengan AI
- Deteksi nomor surat dengan pattern matching

### ✅ Validasi
- Input nama penerima
- Tanda tangan digital

### ✅ Log Harian
- Tabel data dengan nomor urut otomatis
- Search multi-kolom (penerima, ringkasan, dll)
- Pagination
- Export ke Excel/CSV

### ✅ Deteksi Dokumen
Sistem dapat mengenali tipe dokumen berdasarkan:
- **PB** → Permintaan Pembayaran
- **PU** → Pengadaan Umum
- **PP** → Permintaan Pembelian
- **LN** → Surat Luar Negeri
- **NF** → Nota Dinas
- **PDLN** → Perjalanan Dinas Luar Negeri
- **DISPOSISI** → Lembar Disposisi

---

## 🛠️ TECH STACK

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
- SQLite
- Pandas
- Pillow (PIL)
- NumPy
- OpenCV

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
