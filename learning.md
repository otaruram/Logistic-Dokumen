# 📚 OCR.WTF - Learning Guide

Panduan lengkap untuk memahami, mengembangkan, dan memelihara project OCR.WTF (Logistic-Dokumen).

---

## 🏗️ Architecture Overview

Project ini menggunakan arsitektur **Modern Monolith** yang terpisah antara Frontend dan Backend, namun dikelola dalam satu repository (Monorepo-style).

### 1. Frontend (`/fe`)
- **Framework**: React + Vite (TypeScript)
- **UI Library**: Shadcn/UI + TailwindCSS
- **State Management**: React Query (TanStack Query) + Context API
- **Routing**: React Router DOM v6
- **Icons**: Lucide React
- **Animation**: Framer Motion

### 2. Backend (`/be`)
- **Framework**: FastAPI (Python) - High performance async framework
- **Database**: Supabase (PostgreSQL)
- **ORM**: Raw SQL via Supabase Client (untuk performa & simplicity)
- **AI Engines**:
  - **OCR**: Tesseract (Local)
  - **Enhancement**: OpenAI GPT-4o-mini (Primary) + Groq Llama 3 (Backup)
- **Storage**: ImageKit (Images) + Google Drive API (Results)

---

## 🔧 Key Features Implementation

### 1. DGTNZ (Digitization) Pipeline
Proses konversi dokumen fisik ke digital:

1.  **Direct Upload**: User upload foto/PDF -> Frontend.
2.  **Preprocessing**: Frontend resize/compress gambar sebelum kirim (hemat bandwidth).
3.  **OCR Processing (Backend)**:
    - Image diterima -> Tesseract melakukan ekstraksi teks mentah.
    - Teks mentah sering berantakan (typo, format salah).
4.  **AI Enhancement**:
    - Teks mentah dikirim ke OpenAI (`ocr_service.py`).
    - Prompt khusus meminta AI memperbaiki typo & format JSON.
    - **Fallback System**: Jika OpenAI mati/timeout -> Otomatis switch ke **Groq** (4 API keys rotasi).
5.  **Result**: JSON bersih dikembalikan ke Frontend -> Disimpan ke Supabase.

### 2. Dashboard System
Statistik real-time dengan caching:

- **Weekly Activity**: Query Supabase dengan filter tanggal 7 hari terakhir.
- **Cleanup Logic**: 
  - Sistem menghitung 30 hari dari `user.created_at`.
  - Notifikasi muncul jika mendekati hari pembersihan.
  - *Note*: Saat ini cleanup dilakukan manual atau via cron job (perlu di-setup di VPS).

---

## 🛠️ Setup & Development

### Prasyarat
- Node.js 18+
- Python 3.10+
- Tesseract OCR (`sudo apt install tesseract-ocr`)
- Docker (Optional, recommended for production)

### Environment Variables (.env)
File `.env` adalah kunci segalanya. Jangan pernah commit file ini!

**Frontend (.env)**:
```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

**Backend (.env)**:
```env
DATABASE_URL=...
OPENAI_API_KEY=...
GROQ_API_KEY_1=... (Backup)
IMAGEKIT_PUBLIC_KEY=...
```

---

## 🚀 Deployment (VPS)

### Mengapa VPS?
Kita menggunakan VPS (Ubuntu) memberikan kontrol penuh dibanding Vercel/Render untuk kasus ini karena:
1.  **Tesseract OCR**: Butuh instalasi binary OS level.
2.  **Long Running Process**: OCR bisa memakan waktu >10-60 detik (Serverless sering timeout).
3.  **Cost**: VPS fixed cost lebih murah untuk compute heavy tasks.

### Cara Deploy
Lihat `VPS_DEPLOYMENT_GUIDE.md` untuk detailnya. Intinya:
1.  Clone repo.
2.  Setup Python Venv & Install requirements.
3.  Setup Node.js & Build Frontend.
4.  Gunakan `systemd` (Linux service) atau `Docker` untuk menjalankan backend 24/7.
5.  Gunakan Nginx sebagai Reverse Proxy (Port 80 -> 8000).

---

## 🐛 Troubleshooting Umum

**Masalah**: *Upload Gagal / Timeout*
- **Sebab**: File terlalu besar atau koneksi lambat.
- **Solusi**: Cek Nginx config `client_max_body_size 10M;`. Cek timeout setting.

**Masalah**: *AI Error / Fallback Active*
- **Sebab**: OpenAI limit habis atau down.
- **Solusi**: Cek logs backend. Pastikan Groq API keys valid.

**Masalah**: *Preview PDF Kosong*
- **Sebab**: Browser memblokir mixed content (HTTP vs HTTPS) atau CORS.
- **Solusi**: Pastikan backend mengizinkan origin frontend di `CORS_ORIGINS`.

---

## 📚 Best Practices Code ini

1.  **Type Safety**: Selalu gunakan Interface di TypeScript (`fe/src/types/`).
2.  **Service Layer**: Logic backend dipisah ke `services/` (contoh: `ocr_service.py`), bukan numpuk di `main.py`.
3.  **Component Reusability**: UI komponen kecil ada di `fe/src/components/ui` (Shadcn pattern).
4.  **Error Handling**: Backend selalu return JSON standardize (`{"status": "error", "message": "..."}`).

---

## 🔮 Future Improvements (Ide Pengembangan)

1.  **Queue System (Redis)**: Untuk handle ratusan upload bersamaan tanpa bikin server hang.
2.  **Webhooks**: Kirim notifikasi ke WhatsApp/Email setelah scan selesai.
3.  **Multi-page PDF**: Support scan buku tebal (saat ini optimized untuk 1-5 halaman).
