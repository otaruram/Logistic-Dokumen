# OtaruChain - Unified Ecosystem: Enabler Pemeringkat Kredit Alternatif

**Digdaya x Hackathon 2026 - Tahap III Submission**
**Team P0110: OtaruChain**

OtaruChain adalah solusi inovatif **Pemeringkat Kredit Alternatif (PKA)** berkonsep *blue-ocean* yang dirancang untuk mengamankan likuiditas Koperasi Karyawan (Kopkar) dan LJK di sektor industri/manufaktur. 

Kami mengubah **"Kejujuran Perilaku Operasional"** (integritas pelaporan logistik lapangan) menjadi **"Aset Kelayakan Finansial"** untuk membuka akses kredit bagi pekerja *blue-collar*, tanpa agunan fisik, sembari membasmi risiko *fraud* (moral hazard) dan menekan NPL (Non-Performing Loan) hingga 30%.

---

## 🚀 Progress Update & Refinement (Proses Tahap 2 ➡️ Tahap 3)

Juri yang terhormat, kami percaya bahwa inovasi terbaik lahir dari iterasi tanpa henti. Berdasarkan pengujian lapangan dan *feedback* dari Tahap 2, kami melakukan proses *cutting the fat* dan penajaman agar sistem ini memiliki *Product-Market Fit* (PMF) yang absolut.

### ✂️ Apa yang Di-CUT (Dihapus) dan MENGAPA?
1. **PENGHAPUSAN Otaru Financial & Konsep "Kasbon" dari Sisi User:**
   * **Yang Terjadi:** Kami menghapus total ekosistem *Otaru Financial Bot* (beserta fitur *Family Sharing* dan *Debt Service Ratio / DSR* domestik) dan menghilangkan tombol/kata "Kasbon" saat pekerja menggunakan bot.
   * **Mengapa (The "Why"):** Pada Tahap 2, platform kami mencoba melakukan terlalu banyak hal (manajemen utang keluarga sekaligus validasi pabrik), yang berujung pada kebingungan *user experience*. Kami sadar bahwa *core value* OtaruChain adalah **B2B API Pemeringkat Kredit murni (Enabler)** berbasis data logistik. Koperasi tidak butuh aplikasi pengatur utang keluarga, mereka butuh alat untuk memvalidasi kejujuran nota. Pencairan kredit ("kasbon") biarlah tetap berada di wewenang API *Core Banking* Koperasi.

### 🔄 Apa yang Di-UPDATE & DIPERTAJAM dan MENGAPA?
1. **Penajaman Data Identitas (Dari NIK & Nama Dummy ke Nomor HP Terverifikasi):**
   * **Yang Terjadi:** Nama *dummy* "John Doe" dicabut, kini sistem menangkap nama asli saat *user* menginput data di Telegram (beserta input nominal). Jangkar identitas murni menggunakan **Nomor HP**. 
   * **Mengapa (The "Why"):** Pendekatan Nomor HP yang di-*whitelist* oleh HRD sangat sejalan dengan prinsip *Data Minimization* dalam UU PDP (Pelindungan Data Pribadi). Kami tidak menyimpan NIK atau data KTP sensitif di *server* kami, memangkas risiko kebocoran data (*data breach*) yang membayangi industri *fintech*.
2. **Peningkatan Syarat & Nominal Gamifikasi (Consistency Mission):**
   * **Yang Terjadi:** Batas *reward* plafon kredit dinaikkan secara drastis (Silver: Rp 5.5 Juta | Gold: Rp 10 Juta | Platinum: Rp 20 Juta). Kami juga menambahkan sistem pembacaan **Tanggal Bergabung (Tenur)** pada kartu dasbor.
   * **Mengapa (The "Why"):** Hasil wawancara kami dengan admin Kopkar menunjukkan batas plafon yang terlalu kecil (di Tahap 2) tidak menarik bagi pekerja pabrik berskala besar. Selain itu, model prediktif (XGBoost) kami membutuhkan data agregasi riwayat minimal 3 bulan agar tidak terjadi *bias* atau tebakan buta (*cold-start problem*). Fitur *Tanggal Bergabung* memastikan admin memiliki indikator visual apakah *user* sudah cukup lama bergabung untuk dihitung skornya.
3. **Pembaruan Harga (Pricing) yang Logis & Berkelanjutan:**
   * **Yang Terjadi:** Model langganan B2B dirombak (Detail di bab Model Bisnis).
   * **Mengapa (The "Why"):** Model lama kami tidak menutupi biaya operasional (Token API Gemini, *storage* ImageKit, server). Kami beralih ke skema *Hybrid SaaS + Usage-Based* agar Koperasi kecil tetap bisa bergabung (barrier to entry rendah), namun OtaruChain tetap meraup profit besar dari Koperasi Enterprise berskala nasional melalui volume transaksi harian (Skema B2B Louvin).

---

## 🔄 Alur Sistem (End-to-End User Flow)

Proses operasional dirancang agar sangat minim gesekan (*Zero-Friction*):

1. **Input User (Telegram Bot):** Pekerja memfoto nota/surat jalan logistik ➡️ Bot meminta *user* mengetikkan Nama & Nominal ➡️ Data dikirim secara asinkron.
2. **AI Screening (Pre-Analysis):** Asisten AI (Gemini 2.5 Flash) mengekstraksi teks OCR, mencocokkan nominal dengan gambar, dan memberikan analisis/indikator apakah dokumen wajar atau terindikasi manipulasi (*mark-up*).
3. **Verifikasi Admin (Dashboard & Card System):** Dokumen masuk ke *Approval Queue*. Saat kartu dokumen diklik, Admin Koperasi dapat melihat seluruh indikator AI, kelengkapan data *user* (Tanggal Bergabung, Status Tier Platinum/Gold, Sisa Kuota Sistem), dan gambar nota.
4. **Finalisasi & Stamping:** Admin melakukan pengecekan visual akhir dan menekan tombol *Approve*. Sistem akan mencetak tanda tangan Admin dan membubuhkan stempel digital (*Immutable Ledger*) pada gambar tersebut. 

---

## 🏦 Arsitektur Layer Analisis Kredit (Credit Analyst Layer)

Alur keputusan analis kredit di OtaruChain terbagi dalam 3 *layer* utama:

1. **Layer Verifikasi (Verification Layer)**: Sistem memeriksa setiap nota logistik yang diunggah secara *real-time* menggunakan Gemini 2.5 Flash. Potensi manipulasi foto/digital langsung terdeteksi.
2. **Layer Machine Learning (Scoring Layer)**: Data historis pengguna (*Verified vs Tampered*) selama minimal 3 bulan terakhir dianalisis oleh algoritma XGBoost untuk memberikan penilaian risiko secara objektif, instan, dan *explainable* (dapat dijelaskan alasan naik-turunnya skor).
3. **Layer Akomodasi Data (Data Accommodation Layer)**: Sistem berpadu melalui API ke *core banking* Koperasi untuk menarik komplementer seperti **slip gaji** dan **riwayat pinjaman internal**, menyatukan gambaran profil kelayakan final *user*.

---

## 🛡️ Human-in-the-Loop & Immutable Ledger (SupaLedger)

Inovasi kami tidak menyerahkan kendali finansial 100% pada AI, karena halusinasi AI dalam sektor keuangan adalah hal fatal:

1. **Admin Verification Queue (Human-in-the-Loop)**: Keputusan akhir tetap berada di tangan akal manusia (Admin Koperasi). AI Gemini hanya bertindak sebagai asisten spesialis penyaring *fraud*. 
2. **SupaLedger (Non-Decentralized Immutable Ledger)**: 
   * Segera setelah Admin menyetujui, metadata dokumen, waktu, dan TTD di-*hash* dengan **SHA-256** dan diukir *hardcoded* ke atas gambar melalui ImageKit. 
   * **Catatan Penting:** SupaLedger **BUKAN** jaringan *blockchain decentralized* (seperti Ethereum) yang boros energi. Ini adalah *Centralized Immutable Ledger* berbasis *hash chaining* di dalam Supabase (PostgreSQL). Metode ini sangat hemat biaya, latensi milidetik, namun menjamin dokumen operasional tidak akan pernah bisa diedit atau disangkal oleh pihak manapun di kemudian hari (*non-repudiation*).

---

## 💼 Model Bisnis & Skema Harga (Pricing)

Monetisasi menggunakan model **B2B Hybrid SaaS Subscription + Usage-Based (Pay-per-Query)** melalui *Payment Gateway* Louvin. Model ini dipilih karena biaya *overhead* (seperti token Gemini dan bandwidth CDN) meningkat sejalan dengan penggunaan *user*.

Mengapa harga ini sangat masuk akal bagi Koperasi?
- **Tier Developer (Rp 0/bulan):** 10 Request/bulan. Digunakan khusus oleh *Engineer* Koperasi untuk *testing* integrasi API ke *Core Banking* lokal mereka.
- **Tier Launch (Rp 599.000/bulan):** 900 Request/bulan. Cocok untuk Kopkar pabrik kelas menengah. Biaya Rp 599k jauh lebih murah dibanding merekrut satu analis logistik manusia (UMP Rp 3-5 Juta) dan mampu mencegah kebocoran kas akibat *fraud* nota (yang sering bernilai belasan juta per bulan).
- **Tier Scale (Rp 1.499.000/bulan):** 2.000 Request/bulan (Prioritas SLA < 2 Jam).
- **Tier Enterprise (Custom Pricing):** Volume 10.000+ Request/bulan (SLA 99.9% & White-label), dirancang untuk jaringan ritel atau pabrik berskala nasional. Harga disesuaikan berdasarkan arsitektur (On-Premise vs Cloud) dan SLA.
*(Setiap kelebihan kuota di luar Tier Enterprise dikenakan Overage Fee sebesar Rp 3.000 - Rp 5.000 / request, mengamankan margin profit OtaruChain saat terjadi lonjakan traffic jam pergantian shift).*

### 🗺️ Roadmap Fase Ekpansi (Teknologi & Monetisasi)
Kami sangat menyadari bahwa sebagai entitas baru (Day-1), menjual prospek kredit langsung ke Bank adalah bentuk *overclaiming*. Oleh karena itu, skema **Credit Lead-Gen (Take Rate)** kami posisikan sebagai *Roadmap Fase 2* setelah OtaruChain mencapai *critical mass*.

Ketika data historis sudah matang, OtaruChain bertindak sebagai **Lead Generator** untuk Bank/P2P eksternal dengan *Syarat & Ketentuan (Risk Mitigation)* yang sangat ketat:
- **Eligibilitas Super Ketat:** Hanya pengguna dengan **Usia Akun Minimal 3 Bulan** (memiliki rekam jejak konsisten) DAN telah mencapai **Tier Gold atau Platinum** yang berhak diproyeksikan ke pemberi pinjaman eksternal.
- **Model Monetisasi (Backbone):** OtaruChain memungut **Success Fee (Take Rate) sebesar 1% - 2%** dari setiap pinjaman eksternal yang berhasil dicairkan. Pendekatan berbasis *meritokrasi* ini mengamankan Bank dari kredit macet sekaligus membuka potensi profit eksponensial (di luar batas pendapatan langganan API) bagi OtaruChain.

Selain monetisasi, kami juga memiliki *Roadmap Teknologi* untuk 6 bulan ke depan demi memperkuat akuisisi dan akurasi sistem:
1. **Integrasi WhatsApp Business API (Official):** Migrasi dari Telegram ke WhatsApp untuk penetrasi massal, khususnya bagi pekerja/pengemudi senior (usia 45+) yang kurang terbiasa dengan Telegram namun menggunakan WA sebagai aplikasi harian.
2. **In-House AI Localized Receipt Engine:** Saat ini kami bergantung penuh pada Gemini 2.5 Flash. Ke depan, kami akan melatih (*fine-tuning*) API model AI kami sendiri (In-House OCR & Anomaly Detection) khusus untuk mengenali tekstur, format, dan *hash dataset* "Bon/Nota Warung Tradisional Indonesia" yang lecek dan tulisan tangan. Ini akan menekan *False Positives* secara drastis dibandingkan mengandalkan LLM generalis asal Amerika Serikat.

---

## ⚙️ Validasi Teknis & Arsitektur Sistem

Platform dibangun dengan prinsip **API-First** dan arsitektur *Serverless Cloud*:
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS.
- **Backend**: FastAPI (Python) untuk *webhook* Telegram asinkron & Partner API.
- **Database**: Supabase Pro Tier (PostgreSQL + Auth).
- **Object Storage / CDN**: ImageKit.io (Transformasi gambar instan & manipulasi URL *stamping*).
- **Keamanan (OJK & PDP Compliant)**: Enkripsi AES-256 (At-rest) & TLS 1.3 (In-transit), Strict RBAC.

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
