# OtaruChain - Unified Ecosystem: Enabler Pemeringkat Kredit Alternatif

**Digdaya x Hackathon 2026 - Tahap III Submission**
**Team P0110: OtaruChain**

OtaruChain adalah solusi inovatif **Pemeringkat Kredit Alternatif (PKA)** berkonsep *blue-ocean* yang dirancang untuk mengamankan likuiditas Koperasi Karyawan (Kopkar) dan LJK di sektor industri/manufaktur. 

Kami mengubah **"Kejujuran Perilaku Operasional"** (integritas pelaporan logistik lapangan) menjadi **"Aset Kelayakan Finansial"** untuk membuka akses kredit bagi pekerja *blue-collar*, tanpa agunan fisik, sembari membasmi risiko *fraud* (moral hazard) dan menekan NPL (Non-Performing Loan).

---

## 🚀 Fitur Utama

1. **Input User (Telegram Bot):** Pekerja melaporkan nota/surat jalan logistik beserta input nominal via bot.
2. **AI Screening:** Asisten AI mengekstraksi teks OCR, mencocokkan nominal dengan gambar, dan memberikan analisis kewajaran dokumen.
3. **Verifikasi Admin:** Admin Koperasi dapat melihat seluruh indikator AI, kelengkapan data *user*, dan dokumen dalam *Approval Queue*.
4. **Finalisasi & Stamping:** Dokumen yang disetujui akan distempel digital sebagai *Immutable Ledger* yang tidak bisa disangkal di kemudian hari.

---

## 🛡️ Human-in-the-Loop & Keamanan

Inovasi kami menggabungkan kecepatan AI dengan kebijaksanaan manusia:
- **Admin Verification Queue**: Keputusan persetujuan tetap berada di tangan Admin Koperasi. AI hanya bertindak sebagai asisten penyaring.
- **Immutable Ledger**: Setiap dokumen yang disetujui diukir dan dikunci, menjamin dokumen operasional tidak akan pernah bisa diedit atau dipalsukan.

---

## 🧠 Machine Learning (Explainable AI)

Kami menolak penggunaan model *black-box* untuk sistem penilaian (scoring) pinjaman. OtaruChain memproses data historis melalui **Adaptive Logistic Regression** yang sepenuhnya transparan, di mana setiap variabel (seperti rasio persetujuan, konsistensi kehadiran, dan rata-rata nominal pengajuan) dapat dilacak persentase kontribusinya (*Explainable AI*).

👉 **[Lihat Model Output ML (scoring_model.pkl)](be/models/scoring_model.pkl)** 
👉 **[Lihat Script Training (train_scoring_model.py)](be/scripts/train_scoring_model.py)**

---

## 💼 Model Bisnis
Monetisasi menggunakan model B2B Hybrid SaaS Subscription + Usage-Based (Pay-per-Query), memungkinkan akses mudah bagi Koperasi menengah maupun Enterprise berskala nasional dengan sistem SLA yang terjamin.

---
*Proyek ini merupakan purwarupa tahap akhir (MVP Fully Functional) yang dikembangkan eksklusif untuk ajang Hackathon Digdaya 2026.*
