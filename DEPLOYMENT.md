# 🚀 Panduan Deployment Supply Chain OCR

## Backend (Render)

### 1. Push ke GitHub
```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2. Deploy ke Render
1. Buka [render.com](https://render.com) dan login
2. Klik **New +** → **Web Service**
3. Connect GitHub repository: `Logistic-Dokumen`
4. Pilih branch `main`
5. Isi konfigurasi:
   - **Name**: `supply-chain-backend` (atau nama lain)
   - **Region**: Singapore (atau terdekat)
   - **Branch**: `main`
   - **Root Directory**: `be`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

6. Tambahkan **Environment Variables**:
   - `PYTHON_VERSION`: `3.11.0`
   - `BASE_URL`: `https://supply-chain-backend.onrender.com` (sesuaikan dengan URL Render Anda)

7. Klik **Create Web Service**

8. Tunggu deploy selesai (5-10 menit pertama kali karena download model EasyOCR)

9. **PENTING**: Salin URL backend (contoh: `https://supply-chain-backend.onrender.com`)

---

## Frontend (Vercel)

### 1. Update Environment Variable
Di file `fe/.env`, ganti dengan URL backend Render:
```
VITE_API_URL=https://supply-chain-backend.onrender.com
```

### 2. Push ke GitHub
```bash
git add .
git commit -m "Update backend URL for production"
git push origin main
```

### 3. Deploy ke Vercel
1. Buka [vercel.com](https://vercel.com) dan login
2. Klik **Add New** → **Project**
3. Import GitHub repository: `Logistic-Dokumen`
4. Isi konfigurasi:
   - **Project Name**: `supply-chain-frontend`
   - **Framework Preset**: `Vite`
   - **Root Directory**: `fe`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. Tambahkan **Environment Variables**:
   - `VITE_API_URL`: `https://supply-chain-backend.onrender.com` (URL dari Render)

6. Klik **Deploy**

7. Tunggu deploy selesai (2-3 menit)

8. Buka URL Vercel (contoh: `https://supply-chain-frontend.vercel.app`)

---

## Update CORS di Backend

Setelah dapat URL Vercel, update `be/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:8080",
        "https://supply-chain-frontend.vercel.app"  # Tambahkan URL Vercel
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Kemudian push ulang:
```bash
git add be/main.py
git commit -m "Add Vercel URL to CORS"
git push origin main
```

Render akan otomatis redeploy.

---

## Catatan Penting

### Render (Backend)
- ⚠️ **Free tier** akan sleep setelah 15 menit tidak ada aktivitas
- 🕐 Startup pertama kali lambat (30-60 detik) karena load model EasyOCR
- 📦 File upload akan hilang jika redeploy (gunakan cloud storage seperti Cloudinary untuk produksi)

### Vercel (Frontend)
- ✅ Free tier tanpa sleep
- 🚀 Deploy otomatis setiap push ke GitHub
- 📱 Support custom domain

### Environment Variables
**Backend (.env atau Render Environment Variables)**
- `BASE_URL`: URL backend lengkap
- `PYTHON_VERSION`: 3.11.0

**Frontend (.env atau Vercel Environment Variables)**
- `VITE_API_URL`: URL backend lengkap

---

## Troubleshooting

### Backend tidak bisa diakses
1. Cek logs di Render Dashboard
2. Pastikan `BASE_URL` sudah benar
3. Pastikan requirements.txt lengkap

### CORS Error
1. Pastikan URL frontend sudah ditambahkan di `allow_origins`
2. Redeploy backend setelah update CORS

### Upload foto tidak muncul
1. Cek `BASE_URL` di environment variables Render
2. Untuk produksi, gunakan cloud storage (Cloudinary/AWS S3)

---

## Commands Cheat Sheet

### Local Development
```bash
# Backend
cd be
python main.py

# Frontend
cd fe
npm run dev
```

### Git Push
```bash
git add .
git commit -m "Your message"
git push origin main
```

### Update Environment Variables
1. **Render**: Dashboard → Service → Environment → Edit
2. **Vercel**: Dashboard → Project → Settings → Environment Variables

Setelah update, redeploy manual atau push code baru.
