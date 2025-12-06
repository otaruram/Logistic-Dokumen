# 🚀 Panduan Deploy Backend ke Render

## Langkah 1: Persiapan

Pastikan semua file sudah di-push ke GitHub:
```bash
git add .
git commit -m "Ready for production deployment"
git push origin main
```

---

## Langkah 2: Buat Akun Render

1. Buka https://render.com
2. Klik **Get Started for Free**
3. Sign up dengan GitHub (recommended)
4. Authorize Render untuk akses GitHub repo Anda

---

## Langkah 3: Deploy Web Service

### 3.1 Create New Web Service
1. Di dashboard Render, klik **New +** (pojok kanan atas)
2. Pilih **Web Service**
3. Connect repository: Pilih **Logistic-Dokumen**
4. Klik **Connect**

### 3.2 Konfigurasi Service

Isi form dengan detail berikut:

| Setting | Value |
|---------|-------|
| **Name** | `supply-chain-backend` (atau nama lain yang unik) |
| **Region** | `Singapore` (atau yang terdekat) |
| **Branch** | `main` |
| **Root Directory** | `be` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

### 3.3 Instance Type
- Pilih **Free** ($0/month)
- Free tier cukup untuk testing dan low traffic

### 3.4 Environment Variables

**WAJIB** tambahkan environment variables berikut:

Klik **Add Environment Variable**, lalu isi:

| Key | Value | Keterangan |
|-----|-------|------------|
| `PYTHON_VERSION` | `3.11.0` | Versi Python yang digunakan |
| `BASE_URL` | `https://supply-chain-backend.onrender.com` | **GANTI** dengan URL yang Render berikan nanti |
| `FRONTEND_URL` | `https://ocrai.vercel.app` | URL frontend Vercel Anda |

**Catatan untuk BASE_URL:** 
- Saat pertama kali deploy, pakai nilai sementara dulu
- Setelah deploy selesai, copy URL yang Render berikan
- Update environment variable `BASE_URL` dengan URL tersebut
- Redeploy service

---

## Langkah 4: Deploy!

1. Scroll ke bawah
2. Klik **Create Web Service**
3. Tunggu proses deployment (10-15 menit pertama kali)

### Proses yang Terjadi:
- ✅ Clone repository dari GitHub
- ✅ Install dependencies (EasyOCR, FastAPI, dll)
- ✅ Download model AI EasyOCR (~500MB, proses terlama)
- ✅ Start server dengan Uvicorn

### Monitor Deployment:
- Lihat **Logs** untuk progress
- Tunggu sampai muncul: `Uvicorn running on http://0.0.0.0:...`
- Status berubah menjadi **Live** (hijau)

---

## Langkah 5: Copy URL Backend

Setelah deployment berhasil:

1. Di dashboard service, copy URL di bagian atas
   - Contoh: `https://supply-chain-backend.onrender.com`
   
2. **Update Environment Variable:**
   - Klik **Environment** di sidebar kiri
   - Edit `BASE_URL`
   - Paste URL yang baru di-copy
   - Klik **Save Changes**
   - Render akan otomatis **redeploy**

---

## Langkah 6: Test Backend

Test apakah backend sudah jalan:

### Test di Browser:
```
https://supply-chain-backend.onrender.com/
```

Harus muncul response JSON:
```json
{
  "status": "Online",
  "role": "Supply Chain Automation System"
}
```

### Test API History:
```
https://supply-chain-backend.onrender.com/history
```

Harus return array kosong `[]` (karena belum ada data)

---

## Langkah 7: Update Frontend (Vercel)

### 7.1 Update Environment Variable di Vercel

1. Buka dashboard Vercel project **ocrai**
2. Klik **Settings**
3. Klik **Environment Variables**
4. Cari `VITE_API_URL`
5. Klik **Edit**
6. Ganti value dengan URL backend Render:
   ```
   https://supply-chain-backend.onrender.com
   ```
7. Klik **Save**

### 7.2 Redeploy Vercel

**Option 1: Redeploy Otomatis (Recommended)**
```bash
git add .
git commit -m "Update backend URL to Render production"
git push origin main
```
Vercel akan otomatis redeploy dalam 2-3 menit.

**Option 2: Redeploy Manual**
1. Di dashboard Vercel
2. Klik **Deployments**
3. Klik titik tiga di deployment terakhir
4. Klik **Redeploy**

---

## Langkah 8: Test dari Device Berbeda

Setelah Vercel selesai redeploy:

1. Buka di HP atau device lain: `https://ocrai.vercel.app`
2. Test upload foto/file
3. Test ambil foto dengan kamera
4. Cek apakah data muncul di tabel

**Harusnya sudah bisa diakses dari device mana saja dengan internet!** 🎉

---

## Troubleshooting

### ❌ Build Failed di Render

**Problem:** Error saat install dependencies

**Solution:**
1. Cek **Logs** di Render
2. Pastikan `requirements.txt` ada di folder `be/`
3. Pastikan tidak ada typo di `requirements.txt`
4. Redeploy manual: klik **Manual Deploy** → **Deploy latest commit**

### ❌ Failed to Fetch di Frontend

**Problem:** Frontend tidak bisa connect ke backend

**Solution:**
1. Cek URL backend di Vercel Environment Variable
2. Pastikan backend status **Live** (hijau) di Render
3. Test backend URL di browser, harus return JSON
4. Cek CORS di `be/main.py`, pastikan URL Vercel ada di `allow_origins`

### ❌ Internal Server Error (500)

**Problem:** Backend error saat process OCR

**Solution:**
1. Cek **Logs** di Render dashboard
2. Biasanya karena model EasyOCR belum selesai di-download
3. Tunggu beberapa menit, model besar (~500MB)
4. Restart service jika perlu

### ⚠️ Service Sleep (Free Tier)

**Problem:** Backend jadi lambat atau "sleep" setelah 15 menit tidak dipakai

**Behavior:**
- Free tier Render akan **sleep** setelah 15 menit inactivity
- Request pertama setelah sleep butuh **30-60 detik** untuk wake up
- Request selanjutnya normal

**Solution:**
- Untuk production serius, upgrade ke **Starter Plan** ($7/bulan)
- Atau pakai service ping seperti **UptimeRobot** untuk keep-alive

### 📦 File Upload Hilang

**Problem:** Foto yang di-upload hilang setelah redeploy

**Reason:**
- Render menggunakan **ephemeral filesystem**
- File lokal akan hilang setiap redeploy
- Database SQLite juga akan **reset**

**Solution untuk Production:**
1. **Upload Foto:** Pakai cloud storage
   - Cloudinary (free 25GB)
   - AWS S3
   - Google Cloud Storage

2. **Database:** Pakai persistent database
   - PostgreSQL (Render menyediakan free tier)
   - Nanti saya bisa bantu migrate ke PostgreSQL

---

## Next Steps untuk Production

Setelah berhasil deploy, untuk production serius:

### 1. ✅ Upgrade Database ke PostgreSQL
- Free tier: 1GB storage
- Data persistent (tidak hilang saat redeploy)
- Saya bisa bantu setup

### 2. ✅ Integrate Cloud Storage
- Upload foto ke Cloudinary/S3
- URL foto dari cloud, bukan lokal server

### 3. ✅ Custom Domain (Optional)
- Beli domain di Namecheap/GoDaddy
- Connect ke Vercel dan Render
- Contoh: `app.yourdomain.com` dan `api.yourdomain.com`

### 4. ✅ Monitoring & Analytics
- Setup Sentry untuk error tracking
- Google Analytics untuk traffic
- Render menyediakan metrics basic

---

## Summary

✅ **Backend di Render**: `https://supply-chain-backend.onrender.com`
✅ **Frontend di Vercel**: `https://ocrai.vercel.app`
✅ **Database**: SQLite (auto-created di server)
✅ **Akses**: Global dari device mana saja

**Selamat! Aplikasi Anda sudah PRODUCTION READY!** 🚀

Butuh bantuan deploy atau ada error? Tanya aja!
