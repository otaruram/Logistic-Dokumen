# 📚 OCR.WTF - Comprehensive Learning Documentation

Selamat datang di panduan teknis mendalam untuk **OCR.WTF (Logistic-Dokumen)**. Dokumen ini dirancang untuk membantu developer memahami setiap inci dari sistem ini, dari arsitektur level tinggi hingga detail implementasi baris kode.

---

## 🏗️ 1. Architecture & Tech Stack

Project ini menggunakan arsitektur **Modern Monolithic** yang dioptimalkan untuk performa AI dan kemudahan deployment.

### 🌐 Frontend (`/fe`)
Frontend dibangun untuk kecepatan dan estetika "Premium Dark Mode".
- **Core**: React 18 + Vite (TypeScript).
- **Styling**: TailwindCSS + Shadcn/UI (Radix Primitives).
- **State**: React Hooks standard (`useState`, `useEffect`) + TanStack Query.
- **Animations**: Framer Motion (untuk transisi halaman dan efek visual).
- **Icons**: Lucide React.
- **Build Tool**: Vite (Ultra-fast HMR).

### ⚙️ Backend (`/be`)
Backend adalah otak dari operasi AI dan manajemen data.
- **Framework**: FastAPI (Python 3.10+) - Asynchronous, Type-safe.
- **Database**: Supabase (PostgreSQL) via `supabase-py` client & SQLAlchemy ORM (Hybrid approach).
- **AI Processing**:
  - **Tesseract OCR**: Engine OCR open-source untuk ekstraksi teks dasar.
  - **OpenAI GPT-4o-mini**: "Brain" utama untuk cleaning data, formatting JSON, dan generate konten PPT.
  - **Groq (Llama3)**: Fallback engine super-cepat jika OpenAI down/lambat.
- **Storage**:
  - **ImageKit**: Hosting gambar dan tanda tangan (CDN optimization).
  - **Google Drive**: Export hasil laporan scan (Excel Premium).

---

## 📂 2. Directory Structure Map

Memahami struktur folder adalah kunci navigasi cepat.

```
Logistic-Dokumen-main/
├── be/ (Backend)
│   ├── api/                # API Route controllers (Endpoints)
│   │   ├── scans.py        # Logic scanning DGTNZ
│   │   ├── reviews.py      # Logic review landing page
│   │   ├── ppt.py          # Logic generate PowerPoint
│   │   └── ...
│   ├── config/             # Configuration & Env Vars
│   ├── models/             # SQLAlchemy Database Models
│   ├── schemas/            # Pydantic Schemas (Validation)
│   ├── services/           # Business Logic terpisah (The "Brain")
│   │   ├── ocr_service.py  # Handle Tesseract + OpenAI/Groq
│   │   ├── imagekit_service.py # Upload handling
│   │   └── drive_service.py # Google Drive Integration
│   ├── utils/              # Helper functions (Auth, File handling)
│   └── main.py             # Entry point FastAPI
│
├── fe/ (Frontend)
│   ├── src/
│   │   ├── components/
│   │   │   ├── dgtnz/      # Komponen khusus DGTNZ (ScanHistory, Upload)
│   │   │   ├── tabs/       # Halaman utama per tab (Profile, Dashboard)
│   │   │   ├── ui/         # Shadcn Reusable Components (Button, Dialog)
│   │   │   └── LandingPage.tsx # Halaman muka public
│   │   ├── lib/            # Utilities (Supabase Client, utils)
│   │   ├── pages/          # Full page routes (Login, Terms)
│   │   ├── App.tsx         # Main Router
│   │   └── index.css       # Global Styles (Tailwind imports)
│   └── vite.config.ts      # Build configuration
└── ...
```

---

## 🌟 3. Feature Deep Dive

### A. DGTNZ (Digitization Engine)
Fitur inti untuk mengubah dokumen fisik menjadi data digital.
1.  **Flow**: User Upload -> Backend Save Temp -> ImageKit Upload -> Tesseract OCR -> LLM Cleaning -> Database.
2.  **Key File**: `be/api/scans.py` & `be/services/ocr_service.py`.
3.  **UI Components**: `DgtnzTab.tsx`, `ScanUpload.tsx`, `ValidationZone.tsx`.
4.  **Highlights**:
    - **Smart Fallback**: Jika OpenAI error, otomatis switch ke Groq.
    - **Signature Handling**: Tanda tangan di-upload terpisah ke ImageKit QR folder dan di-link ke record.
    - **Edit & Dialogs**: Menggunakan komponen Dialog Shadcn untuk UX yang smooth.

### B. PPT.WTF (AI Presentation)
Generator PowerPoint instan dari topik sederhana.
1.  **Flow**: User Topic -> LLM Generate Content (JSON) -> Python `python-pptx` build slide -> Convert to PDF -> Return URL.
2.  **Key File**: `be/api/ppt.py`.
3.  **Highlights**:
    - **History System**: Menyimpan hasil generate selama 7 hari (`PPTHistory` model).
    - **PDF Preview**: Konversi PPT ke PDF di server agar bisa di-preview di browser tanpa download.

### C. Reviews System (Public Trust)
Sistem review "expiry" unik di Landing Page.
1.  **Logic**: Hanya menampilkan review yang dibuat dalam **7 hari terakhir**.
2.  **Implementation**: Filter `created_at > now - 7 days` di endpoint `GET /api/reviews/recent`.
3.  **Security**: Menggunakan `supabase_admin` untuk bypass RLS saat submit/read public data.

---

## 🗄️ 4. Database Schema (Supabase)

Kita menggunakan PostgreSQL via Supabase.

### Tables:
1.  **`users`**:
    - `id` (UUID), `email`, `credits` (Quota scanning).
2.  **`scans`** (DGTNZ Records):
    - `id`, `user_id`, `imagekit_url`, `extracted_text` (Hasil OCR), `recipient_name`, `signature_url`.
3.  **`reviews`**:
    - `id`, `user_name`, `rating` (1-5), `feedback`, `is_approved`, `created_at`.
4.  **`ppt_history`**:
    - `id`, `pptx_url`, `pdf_url`, `expires_at`.

---

## 🎨 5. Frontend & UI Philosophy

Design language project ini adalah **"Professional Dark Mode"**.
- **Colors**: Dominasi `#0a0a0a` (Vantablack-ish) dengan aksen White/#111.
- **Glassmorphism**: Penggunaan `backdrop-blur` dan `bg-white/5` untuk layer di atas background.
- **Interactivity**: Semua tombol dan card memiliki state `hover` dan transisi `framer-motion` untuk feel yang "hidup".
- **Responsive**: Grid system (`grid-cols-1 lg:grid-cols-2`) memastikan tampilan bagus di HP dan Laptop.

---

## 🛠️ 6. Maintenance & Troubleshooting

### Common Issues:
1.  **"Upload Failed"**:
    - Cek koneksi internet (ImageKit butuh upload stabil).
    - Cek size file (Max 10MB di Nginx/FastAPI limit).
2.  **"AI Error" / Hasil Kosong**:
    - Cek API Key OpenAI/Groq di `.env` backend.
    - Cek kuota API provider.
3.  **Edit Button "Coming Soon"**:
    - Pastikan endpoint `PATCH` di backend sudah di-deploy.
    - Refresh halaman browser (cache JS lama).

### Cara Menambah Fitur Baru:
1.  **Backend**: Buat endpoint baru di `be/api/`, tambahkan Schema Pydantic di `be/schemas/`.
2.  **Frontend**: Buat komponen baru atau update Tab yang relevan. Jangan lupa update `Interface` TypeScript.
3.  **Database**: Jika butuh kolom baru, update Migration (atau add manual di Dashboard Supabase jika prototype).

---

## 🚀 7. Deployment Checklist

Saat deploy ke VPS/Production:
1.  [ ] Setup **SSL/HTTPS** (Wajib untuk akses Camera/Mic di browser).
2.  [ ] Set **CORS** `allow_origins` ke domain production (`https://ocr.wtf`).
3.  [ ] Gunakan **Docker** atau **PM2/Systemd** agar backend auto-restart jika crash.
4.  [ ] Pastikan **Tesseract OCR** terinstall di server (`apt install tesseract-ocr`).

---

*Dokumen ini dibuat otomatis dan diperbarui terakhir pada Desember 2025.*
