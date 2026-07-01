# OtaruChain - Unified Ecosystem: Enabler Pemeringkat Kredit Alternatif

**Digdaya x Hackathon 2026 - Tahap III Submission**
**Team P0110: OtaruChain**

OtaruChain adalah solusi inovatif **Pemeringkat Kredit Alternatif (PKA)** berkonsep *blue-ocean* yang dirancang untuk mengamankan likuiditas Koperasi Karyawan (Kopkar) dan LJK di sektor industri/manufaktur. 

Kami mengubah **"Kejujuran Perilaku Operasional"** (integritas pelaporan logistik lapangan) menjadi **"Aset Kelayakan Finansial"** untuk membuka akses kredit bagi pekerja *blue-collar*, tanpa agunan fisik, sembari membasmi risiko *fraud* (moral hazard) dan menekan NPL (Non-Performing Loan) hingga 30%.

---

## 🚀 Progress Update & Refinement (Tahap 2 ➡️ Tahap 3)

Sesuai dengan *feedback* dan iterasi pengembangan menuju Tahap 3, kami melakukan pivot strategis untuk menajamkan *Product-Market Fit*:

### ✂️ Apa yang Di-CUT (Dihapus)?
1. **Otaru Financial & Konsep Kasbon Internal:** Kami menghapus total ekosistem *Otaru Financial Bot* (beserta fitur *Family Sharing* dan *Debt Service Ratio / DSR* domestik) dan menghilangkan terminologi "Kasbon" dari sisi *user*. 
   * **Alasan:** Fitur ini membuat platform tidak fokus. OtaruChain kini 100% menjadi **B2B API Pemeringkat Kredit murni (Enabler)** yang berfokus pada validasi *Logistics Document*. Penyaluran dana pinjaman sepenuhnya dikembalikan ke wewenang API *Core Banking* milik Koperasi.

### 🔄 Apa yang Di-UPDATE & DIPERTAJAM?
1. **Pricing Model B2B yang Realistis:** Skema harga dirombak agar *sustainable* namun tetap ramah untuk Koperasi mikro hingga Enterprise:
   * **Developer (Rp 0/bulan):** 10 Request (Sandbox).
   * **Launch (Rp 599.000/bulan):** 900 Request/bulan (Untuk Koperasi Mikro).
   * **Scale (Rp 1.499.000/bulan):** 2.000 Request/bulan (Prioritas SLA < 2 Jam).
   * **Enterprise (Rp 3.999.000/bulan):** 10.000 Request/bulan (SLA 99.9% & White-label).
2. **Nominal Gamifikasi (Consistency Mission):** *Reward plafon* dari *Consistency Mission* ditingkatkan menjadi lebih realistis dan relevan untuk standar industri:
   * **Silver (50+ dokumen):** Plafon Rp 5.500.000
   * **Gold (150+ dokumen):** Plafon Rp 10.000.000
   * **Platinum (250+ dokumen):** Plafon Rp 20.000.000
3. **Data Identitas Otentik (Nomor HP & Nama Asli Telegram):** Menghapus data *dummy* "John Doe", kini sistem menangkap langsung nama *real-time* yang diinput oleh *user* di Telegram serta menambahkan indikator **"Tanggal Bergabung"** (minimal 3 bulan untuk mendapatkan *Credit Scoring* akurat).

---

## 🌟 Nilai Utama & Inovasi (Value Proposition)

1. **Jangkar Identitas Nomor HP (Data Minimization)**: Menggantikan NIK atau SLIK dengan Nomor HP yang di-*whitelist* langsung oleh HR Perusahaan, memastikan kepatuhan penuh terhadap UU Pelindungan Data Pribadi (UU PDP).
2. **Zero-Friction Adoption via Telegram**: Tidak perlu instalasi aplikasi berat. Pekerja cukup berinteraksi dengan **OtaruChain Bot** untuk mengunggah dokumen logistik harian.
3. **Zero-Tolerance Gamification**: Ekosistem dilengkapi fitur *Consistency Mission*. Dokumen tervalidasi mendapat poin dan *badge*. Jika AI mendeteksi dokumen palsu/markup (TAMPERED), sistem akan me-reset seluruh *streak* skor secara instan dan membekukan fasilitas (Zero-Tolerance Policy).
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
- **Mekanisme**: Sistem mengumpulkan agregasi data perilaku historis (seperti jumlah *verified*, rasio *tampered*, histori *streak*) dari user yang sudah bergabung minimal 3 bulan. XGBoost digunakan karena kapabilitas *Explainability* yang transparan bagi institusi finansial (menjelaskan alasan di balik skor, misal: "Sering manipulasi harga di 2 bulan terakhir").
- **Output**: Skor kelayakan kredit akhir via JSON API (Endpoint `Unified Decision Gate`).

---

## 🏦 Arsitektur Layer Analisis Kredit (Credit Analyst Layer)

Berdasarkan kapabilitas AI & ML di atas, alur keputusan analis kredit di OtaruChain dirancang secara *end-to-end* ke dalam 3 *layer* utama:

1. **Layer Verifikasi (Verification Layer)**: Sistem memeriksa setiap nota logistik yang diunggah secara *real-time* untuk memastikan keasliannya menggunakan teknologi AI (Gemini 2.5 Flash), sehingga potensi manipulasi atau *mark-up* harga langsung terdeteksi.
2. **Layer Machine Learning (Scoring Layer)**: Data jejak dokumen historis dan profil pengguna dianalisis oleh model (*XGBoost*) untuk memberikan penilaian risiko secara otomatis dan tanpa bias.
3. **Layer Akomodasi Data (Data Accommodation Layer)**: Sebelum keputusan final (*underwriting*) diambil, sistem akan menarik data tambahan (komplemen) dari pangkalan data *core banking* Koperasi, seperti **slip gaji** dan **riwayat pinjaman internal**, untuk merajut profil keuangan yang komprehensif.

---

## 🛡️ Human-in-the-Loop & Immutable Ledger (SupaLedger)

OtaruChain tidak sepenuhnya menyerahkan keputusan akhir pada AI. Kami menggunakan pendekatan hibrida untuk memastikan akuntabilitas manajerial dan keamanan kriptografis:

1. **Admin Verification Queue (Human-in-the-Loop)**: AI Gemini 2.5 Flash bertindak sebagai *co-pilot* yang mendeteksi anomali (misal: harga tidak wajar pada nota). Namun, keputusan final tetap berada di tangan Admin Koperasi. Admin meninjau rekomendasi AI melalui dasbor antrean (*Logistics Verification Queue*) dan melakukan klik persetujuan final.
2. **SupaLedger & SHA-256 Stamping**: Segera setelah Admin menyetujui dokumen, sistem memicu pembentukan jejak audit tak terubahkan (*Immutable Ledger*). Metadata dokumen, stempel waktu, dan tanda tangan digital Admin di- *hash* menggunakan algoritma **SHA-256**. *Hash* unik ini kemudian diukir secara visual ke atas gambar (via transformasi dinamis ImageKit) dan dicatat ke dalam *database* (SupaLedger). Hal ini menjamin dokumen valid tidak akan pernah bisa diubah, dipalsukan ulang, atau disangkal (*non-repudiation*) di masa depan.

---

## ⚙️ Validasi Teknis & Arsitektur Sistem

Platform dibangun dengan prinsip **API-First** dan arsitektur *Serverless Cloud*:
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS (Sistem Portal Admin & Partner).
- **Backend**: FastAPI (Python) untuk *webhook* Telegram asinkron & Partner API.
- **Database**: Supabase Pro Tier (PostgreSQL + Auth).
- **Object Storage / CDN**: ImageKit.io (Transformasi gambar instan & manipulasi URL *stamping*).
- **Payment Gateway**: Louvin Dev API terintegrasi penuh untuk penagihan *subscription* Koperasi.

### Endpoint API Utama
- `POST /api/v1/partner/decision`: Unified Decision Gate (XGBoost Scoring Engine)
- `GET /api/v1/gamification/progress`: Penarikan data *Consistency Mission*
- `POST /api/fraud/...`: Analisis Dokumen Logistik via Gemini 2.5 Flash
- `GET /api/kasbon/queue`: Antrean validasi admin (*Logistics Verification Queue*)

---

## 🛠️ Panduan Menjalankan Sistem Lokal (Development)

### Prasyarat
- Node.js >= 18
- Python 3.10+
- Supabase Project, ImageKit API Keys, & Louvin API Keys

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

### 3. Setup Worker (Asynchronous Tasks)
Dari folder `be/` jalankan worker:
```bash
python -m workers.telegram_bot_worker
python -m workers.scan_worker
```

### 4. Menjalankan via Docker Compose
```bash
docker compose up -d --build
```
*(Gunakan `docker builder prune -a -f` jika terjadi error caching snapshot saat build).*

---
*Proyek ini merupakan purwarupa tahap akhir (MVP Fully Functional) yang dikembangkan eksklusif untuk ajang Hackathon Digdaya 2026.*
