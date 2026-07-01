# OtaruChain - Unified Ecosystem: Enabler Pemeringkat Kredit Alternatif

**Digdaya x Hackathon 2026 - Tahap III Submission**
**Team P0110: OtaruChain**

OtaruChain adalah solusi inovatif **Pemeringkat Kredit Alternatif (PKA)** berkonsep *blue-ocean* yang dirancang untuk mengamankan likuiditas Koperasi Karyawan (Kopkar) dan LJK di sektor industri/manufaktur. 

Kami mengubah **"Kejujuran Perilaku Operasional"** (integritas pelaporan logistik lapangan) menjadi **"Aset Kelayakan Finansial"** untuk membuka akses kredit (inklusi finansial) bagi pekerja *blue-collar*, tanpa agunan fisik, sembari membasmi risiko *fraud* (moral hazard) dan menekan NPL (Non-Performing Loan) hingga 30%.

---

## 🌟 Nilai Utama & Inovasi (Value Proposition)

1. **Jangkar Identitas Nomor HP (Data Minimization)**: Menggantikan NIK atau SLIK dengan Nomor HP yang di-*whitelist* langsung oleh HR Perusahaan, memastikan kepatuhan penuh terhadap UU Pelindungan Data Pribadi (UU PDP).
2. **Zero-Friction Adoption via Telegram**: Tidak perlu instalasi aplikasi berat. Pekerja berinteraksi dengan **OtaruChain Bot** (unggah nota operasional) dan **Otaru Financial Bot** (transparansi *Family Sharing*).
3. **Zero-Tolerance Gamification**: Ekosistem dilengkapi fitur *Consistency Mission*. Dokumen tervalidasi mendapat poin dan *badge* (Silver, Gold, Platinum). Jika terdeteksi dokumen palsu (TAMPERED), sistem akan mereset skor menjadi 0 dan membekukan fasilitas (Zero-Tolerance Policy).
4. **Consent-Driven API**: Rekam jejak kelayakan kredit hanya bisa ditarik oleh Koperasi/LJK melalui API setelah ada persetujuan eksplisit dari *user*.

---

## 🧠 Dual-Engine Machine Learning Architecture

OtaruChain menggunakan pendekatan **Dual-Engine ML** untuk memastikan keamanan dan akurasi skor kredit:

### Engine 1: Fraud Detection & Verification (OtaruChain Layer)
- **Tujuan**: Memverifikasi dokumen secara *real-time* dan mendeteksi anomali/pemalsuan.
- **Model**: Ekstraksi OCR Multimodal menggunakan **Gemini 2.5 Flash** dipadukan dengan **Isolation Forest** (Anomaly Detection).
- **Mekanisme**: Gambar yang diunggah ke CDN ImageKit langsung diproses. Dokumen dimanipulasi secara kriptografis (SHA-256) untuk *immutable audit trail*.
- **Output**: Klasifikasi status dokumen (*Verified, Processing, Tampered*).

### Engine 2: Credit Scoring & Forecasting (OtaruDecision Layer)
- **Tujuan**: Memprediksi *Probability of Default* (PD) dan kelayakan bayar pengguna.
- **Model**: Algoritma **XGBoost (Extreme Gradient Boosting)**.
- **Mekanisme**: Sistem mengumpulkan agregasi data perilaku historis (seperti jumlah *verified*, rasio *tampered*, histori *streak*) dari user yang sudah bergabung minimal 3 bulan. XGBoost digunakan karena tingkat akurasinya yang tinggi pada data tabular dan kapabilitas *Explainability* (memberikan alasan mengapa skor diturunkan, misal: "Sering manipulasi harga (Markup) di 2 bulan terakhir").
- **Output**: Skor kelayakan kredit akhir via JSON API (Endpoint `Unified Decision Gate`).

---

## 💼 Model Bisnis & Skema Harga (Pricing)

Monetisasi menggunakan model **B2B Hybrid SaaS Subscription + Usage-Based (Pay-per-Query)** untuk Koperasi Mitra melalui *Payment Gateway* Louvin, sementara pengguna akhir (pekerja) menikmati akses **100% GRATIS**.

Terdapat 3 Tier Skema Harga:
- **Tier Developer (Rp 0/bulan)**: Akses *Sandbox* & PoC (Proof of Concept) Internal.
- **Tier Launch (Rp 199.000/bulan)**: Cocok untuk Kopkar mikro. Kuota hingga 75 *request* / bulan.
- **Tier Scale (Rp 899.000/bulan)**: Akses SLA prioritas dengan kuota 150 *request* / hari.
*(Kelebihan kuota dikenakan Overage Fee sebesar Rp 3.000 - Rp 5.000 / request via deposit prabayar).*

---

## ⚙️ Validasi Teknis & Arsitektur Sistem

Platform dibangun dengan prinsip **API-First** dan arsitektur *Serverless Cloud*:
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS (Sistem Portal Admin & Partner).
- **Backend**: FastAPI (Python) untuk *webhook* Telegram asinkron & Partner API.
- **Database**: Supabase Pro Tier (PostgreSQL + Auth).
- **Object Storage / CDN**: ImageKit.io (Transformasi gambar instan & manipulasi URL *stamping*).
- **Keamanan (OJK & PDP Compliant)**: Enkripsi AES-256 (At-rest) & TLS 1.3 (In-transit), Strict RBAC.

### Endpoint API Utama (Unified Ecosystem)
- `POST /api/v1/partner/decision`: Unified Decision Gate (XGBoost Scoring Engine)
- `GET /api/v1/gamification/progress`: Penarikan data *Consistency Mission*
- `POST /api/fraud/...`: Analisis Dokumen Gemini 2.5 Flash
- `GET /api/kasbon/queue`: Antrean validasi admin (*Logistics Verification Queue*)

---

## 🛠️ Panduan Menjalankan Sistem Lokal (Development)

### Prasyarat
- Node.js >= 18
- Python 3.10+ (Direkomendasikan 3.11+)
- Supabase Project & ImageKit API Keys
- Louvin API Keys

### 1. Setup Backend (FastAPI)
```bash
cd be
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```
Buat file `be/.env` sesuai `.env.example`.
Jalankan server:
```bash
uvicorn main:app --reload --port 8000
```

### 2. Setup Frontend (React)
```bash
cd fe
npm install
npm run dev
```
Buka `http://localhost:5173` di browser Anda.

### 3. Setup Worker (Asynchronous Tasks)
Dari folder `be/` jalankan worker berikut (bisa via tmux/supervisor atau CMD terpisah):
```bash
python -m workers.telegram_bot_worker
python -m workers.finance_bot_worker
python -m workers.scan_worker
```

### 4. Menjalankan via Docker Compose
```bash
docker compose up -d --build
```
*(Gunakan `docker builder prune -a` jika terjadi error caching saat build)*

---
*Proyek ini merupakan purwarupa tahap akhir (MVP Fully Functional) yang dikembangkan eksklusif untuk ajang Hackathon Digdaya 2026.*
