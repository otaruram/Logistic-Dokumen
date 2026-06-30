# CORS Troubleshooting & Fix Guide

Tujuan: panduan singkat untuk menemukan dan memperbaiki masalah "CORS request did not succeed" pada `https://api-ocr.xyz`.

**Gejala biasa**
- Browser: "CORS request did not succeed" atau "TypeError: NetworkError when attempting to fetch resource".
- Tidak ada entri `OPTIONS` pada DevTools Network → kemungkinan request gagal di level jaringan/CDN.
- `OPTIONS` ada tapi respon tidak punya header `Access-Control-Allow-*` → perlu enable CORS di server/proxy.

## 1) Cek cepat dari mesin dev

Jalankan ini di terminal untuk cek konektivitas dan preflight:

```bash
curl -I https://api-ocr.xyz/api/kyc/status
curl -i -X OPTIONS https://api-ocr.xyz/api/kyc/status \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET"
```

- Jika `curl` timeout atau gagal → perbaiki DNS/TLS/firewall/VPS/CDN.
- Jika `OPTIONS` kembali tanpa `Access-Control-Allow-Origin` → server/proxy perlu dikonfigurasi.

## 2) Periksa CDN / Cloudflare

- Pastikan tidak ada firewall rule, WAF, atau Worker yang memblok `OPTIONS` atau menghapus header CORS.
- Jika ada Cloudflare, cek Page Rules / Transform Rules / Firewall Events.
- Hapus rule yang memodifikasi respons CORS atau buat exception untuk origin frontend.

## 3) Konfigurasi server / reverse proxy

Contoh Nginx (pada blok `server` atau `location`):

```nginx
if ($request_method = 'OPTIONS') {
  add_header 'Access-Control-Allow-Origin' "$http_origin" always;
  add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
  add_header 'Access-Control-Allow-Headers' 'Authorization,Content-Type' always;
  add_header 'Access-Control-Allow-Credentials' 'true' always;
  return 204;
}
add_header 'Access-Control-Allow-Origin' "$http_origin" always;
add_header 'Access-Control-Allow-Credentials' 'true' always;
```

Pastikan `proxy_pass` atau backend tidak menimpa header ini.

## 4) Contoh per-framework

FastAPI (Python):

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend.com"],
    allow_credentials=True,
    allow_methods=["GET","POST","OPTIONS"],
    allow_headers=["*"],
)
```

Express (Node):

```js
const cors = require('cors');
app.use(cors({ origin: 'https://your-frontend.com', credentials: true }));
```

Flask (Python):

```py
from flask_cors import CORS
CORS(app, origins=["https://your-frontend.com"], supports_credentials=True)
```

## 5) Jika backend mengembalikan cookie / butuh credentials

- Jangan gunakan `Access-Control-Allow-Origin: *`.
- Harus pasang `Access-Control-Allow-Credentials: true` dan mengatur origin spesifik.
- Pastikan frontend memanggil `fetch(..., { credentials: 'include' })` jika perlu.

## 6) Workarounds untuk development

- Gunakan proxy dev (Vite/webpack) untuk forward `/api` ke `https://api-ocr.xyz`.
- Gunakan extension CORS hanya untuk debugging lokal (tidak direkomendasikan produksi).

## 7) Verifikasi setelah perubahan

- Jalankan perintah `curl` di atas lagi.
- Di browser DevTools, lihat request `OPTIONS` punya header `Access-Control-Allow-Origin`.

## 8) Next steps yang saya bisa bantu

- Cek file konfigurasi di `be/` (FastAPI/Flask/Express) dan contoh Nginx di VPS.
- Bantu membuat patch konfigurasi untuk `be/` atau `nginx`.
- Bantu tes `curl` output (minta Anda jalankan dan paste hasilnya).

---
File ini dibuat untuk membantu perbaikan cepat masalah CORS pada `https://api-ocr.xyz`.
