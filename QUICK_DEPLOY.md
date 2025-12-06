# ⚡ Quick Deploy Production

## 🚀 Deploy Backend ke Render

```bash
git add .
git commit -m "Update backend"
git push origin main
```

**Render akan otomatis deploy!** Monitor di: https://dashboard.render.com

---

## 🚀 Deploy Frontend ke Vercel

### Option 1: Auto Deploy (Recommended)
```bash
git add .
git commit -m "Update frontend"
git push origin main
```

**Vercel akan otomatis deploy!** Monitor di: https://vercel.com/dashboard

### Option 2: Manual Deploy dengan Vercel CLI

```bash
# Install Vercel CLI (sekali aja)
npm install -g vercel

# Login ke Vercel
vercel login

# Deploy production
cd fe
npm run build:prod
vercel --prod
```

---

## 🔄 Force Redeploy (Tanpa Changes)

### Backend (Render)
```bash
git commit --allow-empty -m "Trigger Render redeploy"
git push origin main
```

### Frontend (Vercel)
```bash
git commit --allow-empty -m "Trigger Vercel redeploy"  
git push origin main
```

---

## ✅ Verifikasi Deployment

### Test Backend
```bash
# Test API health
curl https://logistic-dokumen.onrender.com/

# Test history endpoint
curl https://logistic-dokumen.onrender.com/history
```

### Test Frontend
1. Buka https://ocrai.vercel.app
2. Hard refresh: `Ctrl+Shift+R` (Windows) atau `Cmd+Shift+R` (Mac)
3. Atau buka Incognito/Private window

---

## 🐛 Troubleshooting

### Backend Error "Gagal memproses dokumen"
**Cause:** Model EasyOCR belum di-load
**Fix:** 
1. Buka Render Logs
2. Tunggu sampai muncul "✅ Model AI Siap!"
3. Biasanya butuh 10-15 menit pertama kali

### Frontend Error ".map is not a function"
**Cause:** Browser cache pakai build lama
**Fix:**
1. Hard refresh browser: `Ctrl+Shift+R`
2. Clear browser cache
3. Atau buka Incognito window

### CORS Error
**Cause:** Environment variables belum di-set
**Fix:**
1. Render → Environment → Set `BASE_URL` dan `FRONTEND_URL`
2. Vercel → Settings → Environment Variables → Set `VITE_API_URL`

---

## 📋 Checklist Before Deploy

- [ ] Test di lokal dulu (`npm run dev` dan `python main.py`)
- [ ] Commit semua changes (`git status` harus clean)
- [ ] Push ke GitHub (`git push origin main`)
- [ ] Monitor Render Logs (tunggu "Model AI Siap!")
- [ ] Monitor Vercel Deployments (tunggu status Ready)
- [ ] Test production di browser (hard refresh!)

---

## 🎯 Current URLs

- **Backend**: https://logistic-dokumen.onrender.com
- **Frontend**: https://ocrai.vercel.app
- **GitHub Repo**: https://github.com/otaruram/Logistic-Dokumen

---

## 💡 Tips

1. **Backend sleep di free tier** → Request pertama bisa lambat (30-60 detik)
2. **Database reset saat redeploy** → Data hilang setiap Render redeploy
3. **Frontend build time** → 2-3 menit di Vercel
4. **Backend build time** → 10-15 menit pertama kali (download model EasyOCR)

---

**Happy Deploying!** 🚀
