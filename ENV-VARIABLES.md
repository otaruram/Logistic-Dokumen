# 🔐 Environment Variables Reference

## Frontend (Vercel Dashboard)

Tambahkan di **Vercel Dashboard** → **Project Settings** → **Environment Variables**

### Required Variables

| Variable Name | Description | Example Value | Where to Get |
|--------------|-------------|---------------|--------------|
| `VITE_API_URL` | Backend API URL | `https://api-ocr.xyz` | Your VPS domain |
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://xxxxx.supabase.co` | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anonymous Key | `eyJhbGc...` | Supabase Dashboard → Settings → API |

### Environment Scope
Centang semua untuk setiap variable:
- ✅ Production
- ✅ Preview  
- ✅ Development

---

## Backend (.env file on VPS)

Create file: `/var/www/api-ocr/be/.env`

```env
# Supabase Database
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# OpenAI for OCR (DGTNZ)
OPENAI_API_KEY=sk-Dt5TIqP0JwDYf9cVOVtChg
BASE_URL=https://ai.sumopod.com/v1

# OpenAI for Quiz
QUIZ_OPENAI_API_KEY=sk-XqL5lIHedRqyA9GV4XL5HQ
QUIZ_BASE_URL=https://ai.sumopod.com/v1

# ImageKit Main Account
IMAGEKIT_PUBLIC_KEY=public_4h3oc4wci
IMAGEKIT_PRIVATE_KEY=private_xxxxx
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/4h3oc4wci

# ImageKit QR Account
IMAGEKIT_PUBLIC_KEY_QR=public_PnWMb/dJLV6ciEmQDsPZkbRkNVg=
IMAGEKIT_PRIVATE_KEY_QR=private_xxxxx
IMAGEKIT_URL_ENDPOINT_QR=https://ik.imagekit.io/ocrwtf

# Cleanup/Cron Secret
CLEANUP_SECRET=your-random-secret-key-here
```

---

## 🔍 How to Get Credentials

### Supabase
1. Login ke [Supabase Dashboard](https://app.supabase.com)
2. Pilih project Anda
3. Klik **Settings** → **API**
4. Copy:
   - Project URL
   - `anon` `public` key
   - `service_role` `secret` key

### OpenAI Compatible API
Jika menggunakan custom endpoint (contoh: SumoPod):
- Dapatkan API key dari provider Anda
- Set `BASE_URL` ke endpoint custom

### ImageKit
1. Login ke [ImageKit Dashboard](https://imagekit.io/dashboard)
2. Klik **Settings** → **API Keys**
3. Copy:
   - Public Key
   - Private Key
   - URL Endpoint

---

## ⚠️ Security Notes

1. **JANGAN commit `.env` ke Git**
   - Sudah di `.gitignore`
   - File `.env` hanya untuk development lokal

2. **JANGAN hardcode credentials di code**
   - Selalu gunakan `process.env` atau `import.meta.env`

3. **Rotate keys secara berkala**
   - Ganti API keys setiap 3-6 bulan
   - Update di Vercel & VPS

4. **Frontend vs Backend Variables**
   - Frontend (Vite): Harus prefix `VITE_`
   - Backend (FastAPI): Tidak perlu prefix

5. **Public vs Private Keys**
   - `VITE_*` = Terekspos di browser (jangan taruh secret!)
   - Backend `.env` = Tidak terekspos (aman untuk secrets)

---

## 🧪 Validate Configuration

### Test Frontend Variables (Browser Console)
```javascript
console.log('API URL:', import.meta.env.VITE_API_URL)
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
// Jangan log anon key di production!
```

### Test Backend Variables (VPS Terminal)
```bash
cd /var/www/api-ocr/be
source venv/bin/activate
python -c "from config.settings import settings; print('Supabase URL:', settings.SUPABASE_URL)"
```

### Test API Connection
```bash
# From local machine
curl https://api-ocr.xyz/api/docs

# From Vercel deployment
# Open: https://your-app.vercel.app
# Try login/register
```

---

## 🔄 Update Variables

### On Vercel (Frontend)
1. Go to Project Settings → Environment Variables
2. Edit or add new variables
3. Click **Save**
4. Trigger new deployment (or wait for next git push)

### On VPS (Backend)
```bash
ssh ubuntu@43.157.227.192
cd /var/www/api-ocr/be
nano .env
# Edit variables
# Save: Ctrl+O, Enter, Ctrl+X

# Restart service
sudo systemctl restart api-ocr
```

---

## 📋 Checklist

Frontend (Vercel):
- [ ] `VITE_API_URL` set
- [ ] `VITE_SUPABASE_URL` set
- [ ] `VITE_SUPABASE_ANON_KEY` set
- [ ] All environments selected (Production, Preview, Development)
- [ ] Deployment successful
- [ ] API connection works

Backend (VPS):
- [ ] `.env` file created
- [ ] All Supabase variables set
- [ ] OpenAI keys set
- [ ] ImageKit keys set
- [ ] Cleanup secret set
- [ ] Service restarted
- [ ] API docs accessible
- [ ] CORS configured for Vercel domain
