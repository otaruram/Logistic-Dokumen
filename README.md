# OtaruChain

Platform verifikasi dokumen, anti-fraud, kasbon approval, dan decision API untuk koperasi/institusi.

OtaruChain menggabungkan:
- Verifikasi dokumen operasional (OCR + anti-tamper)
- Approval kasbon dengan stempel digital + TTD admin
- Partner API (B2B) untuk lookup keputusan berbasis profil terverifikasi
- Integrasi bot Telegram untuk jalur adopsi yang ringan

## Ringkasan Fitur

### 1) Document Intelligence
- Upload dokumen (receipt/nota/slip) dari web atau Telegram.
- OCR ekstraksi field penting (nominal, tanggal, merchant, dll).
- Review status dokumen (verified/processing/tampered).

### 2) Anti-Fraud dan Integritas Data
- Dokumen disegel dengan hash SHA-256.
- Jejak audit approval dan perubahan data.
- Validasi berlapis sebelum data bisa dipakai untuk keputusan kredit.

### 3) Kasbon Approval Workflow
- Admin queue untuk approve/reject pengajuan.
- Stempel digital dapat dikustom:
  - warna stempel
  - nama stempel (editable)
- Signature pad admin:
  - garis lebih tebal (lebih terbaca)
  - pilihan warna tanda tangan

### 4) Partner API (B2B)
- API key per partner.
- Scopes akses per key.
- Endpoint decision/lookup untuk integrasi koperasi internal atau mitra.

### 5) Security dan Compliance-Oriented
- Data transit via HTTPS/TLS.
- API key disimpan dalam bentuk hash.
- Consent-driven access untuk data sensitif.
- RBAC untuk pembatasan akses admin/partner.

## Arsitektur Singkat

- Frontend: React 18 + Vite + TypeScript + Tailwind
- Backend: FastAPI (Python)
- Database/Auth: Supabase (PostgreSQL + Auth)
- Queue/Cache: Redis
- Storage Media: ImageKit
- Worker:
  - scan worker
  - telegram worker
  - finance bot worker

## Struktur Proyek

- fe/: aplikasi frontend (portal user/admin/partner)
- be/: backend FastAPI, API routes, service layer, workers
- database/: SQL schema dan migration utama
- docker-compose.yml: orkestrasi backend + redis + workers

## Endpoint Utama (Ringkas)

- Kasbon:
  - /api/kasbon/... (approval queue, preview stamping, approve)
- Partner:
  - /api/v1/partner/... (api key, unified decision, usage)
- Scan/Fraud:
  - /api/scans/..., /api/fraud/...
- KYC/Profile/Admin:
  - /api/kyc/..., /api/users/..., /api/admin/...

## Local Development

## Prasyarat
- Node.js >= 18
- Python 3.10+ (direkomendasikan 3.11+)
- Redis
- Supabase project (URL + keys)

## 1) Setup Backend

```bash
cd be
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Buat file be/.env (minimal):

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
JWT_SECRET=your_secret
```

Jalankan backend:

```bash
uvicorn main:app --reload --port 8000
```

## 2) Setup Frontend

```bash
cd fe
npm install
npm run dev
```

Buat file fe/.env.local (contoh):

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Frontend default berjalan di http://localhost:5173.

## 3) Jalankan Worker (opsional saat development)

Dari folder be/ dengan environment aktif:

```bash
python -m workers.scan_worker
python -m workers.telegram_bot_worker
python -m workers.finance_bot_worker
```

## Menjalankan via Docker Compose

```bash
docker compose up -d --build
```

Service utama:
- backend: port 8000
- redis: port 6379
- scan-worker
- telegram-worker
- finance-bot-worker

## Branding

Brand utama untuk landing page dan produk adalah OtaruChain.

Jika ingin update branding lain:
- UI landing utama: fe/src/components/LandingPage.tsx
- Landing alternatif: fe/src/pages/Landing.tsx
- Konstanta app: fe/src/constants/index.ts

## Catatan Operasional

- Dokumen proposal sensitif tidak disimpan di repo publik.
- File lokal/non-relevan disarankan masuk .gitignore.
- Jangan commit credential, token, atau private key.

## Troubleshooting Singkat

- API error 401/403:
  - cek token Supabase dan header Authorization
- Koneksi Redis gagal:
  - cek REDIS_HOST/REDIS_PORT dan service redis aktif
- Stamping preview tidak muncul:
  - pastikan URL dokumen valid dan body request mengirim field stamp/sig yang benar
- Partner insert gagal plan constraint:
  - pastikan schema/migration plan terbaru sudah diterapkan

## Lisensi dan Kepemilikan

Proyek ini dimiliki oleh tim OtaruChain.
Gunakan akses repository sesuai kebijakan internal tim.
