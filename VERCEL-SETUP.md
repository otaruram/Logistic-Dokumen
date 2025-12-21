## 🚀 Vercel Deployment Setup Guide

## Persiapan

### 1. Push Repository ke GitHub
```bash
git add .
git commit -m "Rebranding to OCR.WTF"
git push origin main
```

---

## 🔧 Setup di Vercel Dashboard

### Langkah 1: Import Project
1. Buka [Vercel Dashboard](https://vercel.com/new)
2. Klik **"Add New Project"**
3. Pilih **"Import Git Repository"**
4. Cari repository: `otaruram/Logistic-Dokumen` (atau nama repo Anda)
5. Klik **"Import"**

### Langkah 2: Configure Project Settings

#### **Root Directory** ⚠️ PENTING!
- Pilih: **`fe`** (folder frontend)
- Jangan biarkan kosong!

#### **Framework Preset**
- Pilih: **Vite**

#### **Build & Output Settings**
Biarkan default (Vercel akan auto-detect dari `package.json`):
- Build Command: `npm run build` ✅ (otomatis)
- Output Directory: `dist` ✅ (otomatis)
- Install Command: `npm install` ✅ (otomatis)

### Langkah 3: Environment Variables

Tambahkan environment variables berikut di Vercel Dashboard:

| Key | Value | Example |
|-----|-------|---------|
| `VITE_API_URL` | `https://api-ocr.xyz` | URL backend API Anda |
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` | Supabase anon key |

**Cara menambahkan:**
1. Di project settings, klik tab **"Environment Variables"**
2. Tambahkan satu per satu variable di atas
3. Pilih environment: **Production**, **Preview**, dan **Development**

### Langkah 4: Deploy
1. Klik **"Deploy"**
2. Tunggu proses build (sekitar 2-5 menit)
3. Setelah selesai, Anda akan mendapat URL: `https://your-project.vercel.app`

---

## 🔄 Auto Deploy (CI/CD)

Setelah setup awal, setiap kali Anda push ke GitHub, Vercel akan otomatis:
1. Detect perubahan
2. Build ulang project
3. Deploy versi baru

### Branch-based Deployment:
- `main` branch → Production deployment
- Feature branches → Preview deployment (URL temporary)
- Pull requests → Preview deployment dengan komentar otomatis

---

## 🎯 Custom Domain (Opsional)

### Menambahkan Domain Sendiri:
1. Di Vercel Dashboard, buka project Anda
2. Klik tab **"Settings"** → **"Domains"**
3. Tambahkan domain Anda, contoh: `ocr.wtf`
4. Vercel akan berikan DNS records yang harus ditambahkan:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21
   
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```
5. Tambahkan records tersebut di domain registrar Anda
6. Tunggu DNS propagation (5-30 menit)
7. SSL certificate akan otomatis di-setup oleh Vercel

---

## 🧪 Testing Deployment

### Setelah Deploy Berhasil:

1. **Buka Frontend:**
   ```
   https://your-project.vercel.app
   ```

2. **Test API Connection:**
   - Coba login/register
   - Upload file
   - Check browser console untuk errors

3. **Check Environment Variables:**
   ```javascript
   // Di browser console:
   console.log(import.meta.env.VITE_API_URL)
   console.log(import.meta.env.VITE_SUPABASE_URL)
   ```

---

## 📋 Troubleshooting

### Build Failed?
**Check build logs di Vercel:**
1. Buka deployment yang gagal
2. Klik **"View Build Logs"**
3. Cari error message

**Common issues:**
- Missing dependencies → Check `package.json`
- Wrong node version → Tambahkan di `package.json`:
  ```json
  "engines": {
    "node": "18.x"
  }
  ```

### Environment Variables Tidak Terdeteksi?
1. Pastikan prefix `VITE_` untuk variabel yang diakses di frontend
2. Rebuild deployment setelah menambah env vars
3. Clear cache: Settings → General → Clear Cache

### 404 on Page Refresh?
Sudah ditangani di `vercel.json` dengan rewrites ke `index.html`

### CORS Error?
Pastikan backend API (`api-ocr.xyz`) sudah setup CORS dengan benar:
```python
# main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-project.vercel.app", "https://ocr.wtf"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🔐 Security Best Practices

1. **Jangan commit `.env` ke GitHub**
   - Sudah ditambahkan di `.gitignore`

2. **Gunakan Environment Variables di Vercel**
   - Semua secrets harus di Vercel Dashboard

3. **Rotate API Keys secara berkala**
   - Ganti Supabase anon key setiap 3-6 bulan
   - Update di Vercel Environment Variables

4. **Enable Vercel Password Protection** (Opsional)
   - Settings → Deployment Protection
   - Cocok untuk staging/preview deployments

---

## 📊 Monitoring

### Vercel Analytics (Built-in):
1. Buka tab **"Analytics"** di Vercel Dashboard
2. Lihat:
   - Page views
   - Unique visitors
   - Performance metrics (Web Vitals)
   - Top pages

### Custom Monitoring:
Tambahkan Google Analytics atau Plausible di `index.html`

---

## 🚀 Workflow Lengkap

### Development → Production:
```bash
# 1. Develop di local
git checkout -b feature/new-feature
# ... coding ...

# 2. Test di local
cd fe
npm run dev

# 3. Push ke GitHub
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# 4. Vercel otomatis buat preview deployment
# Check preview URL di PR comments

# 5. Merge ke main
git checkout main
git merge feature/new-feature
git push origin main

# 6. Vercel otomatis deploy ke production
```

---

## ✅ Checklist Deployment

- [ ] Repository sudah di GitHub
- [ ] `vercel.json` sudah ada di root
- [ ] `.env.production` sudah dibuat (tapi jangan di-commit)
- [ ] Project di-import ke Vercel
- [ ] Environment variables sudah ditambahkan
- [ ] Build berhasil
- [ ] Frontend bisa diakses
- [ ] API connection berfungsi
- [ ] Login/Register works
- [ ] Upload file works
- [ ] Custom domain (opsional) sudah dikonfigurasi

---

## 🎉 Selesai!

Frontend Anda sekarang otomatis deploy setiap kali push ke GitHub!

**URLs:**
- 🌐 Production: `https://your-project.vercel.app`
- 🔗 Backend API: `https://api-ocr.xyz`
- 📚 API Docs: `https://api-ocr.xyz/docs`

**Next Steps:**
- Setup custom domain
- Enable Vercel Analytics
- Configure deployment notifications (Slack/Discord)
- Setup branch protection rules di GitHub
