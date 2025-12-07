# 🚀 DEPLOYMENT GUIDE - LOGISTIC.AI

## Production URLs
- **Frontend:** https://ocrai.vercel.app
- **Backend:** https://logistic-dokumen.onrender.com

---

## ✅ Environment Variables Setup

### Backend (Render)
Pastikan environment variables berikut sudah diset di Render Dashboard:

```env
DATABASE_URL=postgresql://postgres.lieqcpwlsduyzyhhnlcc:Hadir321@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.lieqcpwlsduyzyhhnlcc:Hadir321@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
OCR_API_KEY=K87256153888957
BASE_URL=https://logistic-dokumen.onrender.com
FRONTEND_URL=https://ocrai.vercel.app
SUMOPOD_API_KEY=sk-LawsP46MSv3redMWmkF9dQ
SUMOPOD_BASE_URL=https://ai.sumopod.com/v1
GOOGLE_DRIVE_FOLDER_NAME=LOGISTIC.AI Reports
```

### Frontend (Vercel)
Set di Vercel Dashboard → Settings → Environment Variables:

```env
VITE_API_URL=https://logistic-dokumen.onrender.com
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

---

## 📋 Deployment Checklist

### 1. Backend (Render)
- [x] Environment variables configured
- [x] Build command: `pip install -r requirements.txt`
- [x] Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- [x] Python version: 3.12
- [x] Auto-deploy from GitHub enabled

### 2. Frontend (Vercel)
- [x] Environment variables configured
- [x] Build command: `npm run build`
- [x] Output directory: `dist`
- [x] Install command: `npm install`
- [x] Auto-deploy from GitHub enabled

### 3. Database (Supabase)
- [x] PostgreSQL database active
- [x] Connection strings configured
- [x] Prisma migrations applied

---

## 🔧 Post-Deployment Setup

### Google Drive Integration
Untuk mengaktifkan fitur Google Drive di production:

1. **Login dengan Google Drive Scope**
   - User harus login dengan tombol "MASUK DENGAN GOOGLE" (yang besar)
   - Akan meminta izin akses Google Drive
   - Token akan tersimpan di localStorage

2. **Test Upload**
   - Setelah login, scan beberapa dokumen
   - Klik tombol "GDRIVE" di dashboard
   - File akan otomatis upload ke Google Drive user

---

## 🐛 Troubleshooting

### Issue: Preview foto kosong
**Fix:** Sudah diperbaiki dengan BASE_URL environment variable

### Issue: OCR error "cannot write mode RGBA as JPEG"
**Fix:** Sudah diperbaiki dengan konversi RGBA → RGB otomatis

### Issue: Google Drive error 401
**Cause:** User belum login dengan Drive scope
**Fix:** Logout dan login ulang dengan tombol "MASUK DENGAN GOOGLE"

### Issue: Token expired
**Cause:** Access token Google kadaluwarsa (1 jam)
**Fix:** Logout dan login ulang (otomatis akan refresh)

---

## 📝 Notes

- **Render Free Tier:** Server sleep setelah 15 menit tidak aktif
- **Upload Folder:** File di `/uploads` akan hilang setelah redeploy di Render (ephemeral storage)
- **Database:** Supabase menyimpan metadata dokumen permanent
- **Google Drive:** Backup jangka panjang untuk laporan Excel

---

## 🔄 Update Production

```bash
# Push ke GitHub
git add .
git commit -m "Update features"
git push origin main

# Vercel dan Render akan auto-deploy
```

---

**Last Updated:** December 7, 2025
