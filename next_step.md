# Next Step Setelah Lolos Proposal (Target: Top 10)

Dokumen ini dibuat untuk eksekusi cepat, bukan teori. Fokus: bikin presentasi kuat, demo stabil, dan scoring juri maksimal.

## Real Talk Dulu: Bisa Top 10 Gak?

Bisa, **kalau eksekusimu rapi 7-10 hari ke depan**.

Kondisimu sekarang sudah bagus karena:
- Produk sudah jadi (bukan sekadar ide)
- Fitur inti sudah ada (OCR + fraud/confidence)
- Arsitektur sudah cukup matang untuk demo

Yang menentukan lolos top 10 biasanya bukan fitur paling banyak, tapi:
- Narasi masalah -> solusi -> dampak yang jelas
- Demo lancar tanpa drama
- Bukti metrik sederhana tapi meyakinkan
- Tim kelihatan ngerti risiko dan mitigasinya

## Prioritas Utama (Urutan Wajib)

1. Kunci 1 alur demo inti (jangan bercabang)
2. Stabilkan output fraud/confidence agar konsisten
3. Siapkan bukti dampak (waktu, error, produktivitas)
4. Bangun deck presentasi yang tajam
5. Latihan QnA yang biasanya menjatuhkan tim

---

## 1) Kunci Scope Demo (No Scope Creep)

Pakai alur ini doang saat pitch:
1. Upload dokumen
2. OCR + ekstraksi field penting
3. Fraud/confidence status keluar
4. Dashboard menampilkan hasil ringkas

Yang jadi pendukung saja (jangan dijadikan inti):
- Chatbot
- Admin panel
- Invoice generator
- Fitur nice-to-have lain

**Rule:** kalau bukan penguat nilai bisnis utama, jangan dibuka saat demo.

---

## 2) Demo Readiness Checklist (Wajib H-3 Selesai)

### A. Data Demo
- Siapkan 3 dokumen contoh:
  - Good case (verified)
  - Medium case (processing)
  - Bad case (tampered)
- Pastikan isi dokumen masuk akal dan mudah dijelaskan
- Nama file dibuat jelas agar tidak salah upload saat live

### B. Stabilitas Teknis
- Jalankan full flow minimal 10x
- Catat failure point dan siapkan fallback
- Pastikan service hidup:
  - backend
  - redis
  - scan-worker
- Pastikan semua env penting valid dan tidak kosong

### C. Backup
- Rekam video demo 2-3 menit (wajib)
- Siapkan screenshot hasil tiap tahap
- Simpan 1 script bicara darurat jika live demo gagal

---

## 3) Materi Presentasi yang Harus Jadi (Bukan Opsional)

1. Problem nyata di lapangan (pakai angka sederhana)
2. Solusi inti OCR.WTF (1 slide arsitektur ringkas)
3. Demo flow 4 langkah (langsung to the point)
4. Dampak terukur:
- Hemat waktu proses
- Turun human error
- Prioritas review jadi jelas via confidence
5. Risiko & mitigasi:
- Jika OCR ambigu -> status processing + review manual
- Jika AI timeout -> fallback + retry path
6. Roadmap realistis 3 bulan

---

## 4) Metrik Minimum Biar Dipercaya Juri

Minimal bawa metrik ini:
- Rata-rata waktu proses 1 dokumen
- Persentase dokumen yang langsung verified
- Persentase dokumen yang masuk manual review
- Perbandingan waktu proses: manual vs OCR.WTF

Kalau belum punya banyak data, pakai pilot sample yang jujur dan jelas metodenya.

---

## 5) QnA Trap yang Harus Kamu Hafal Jawabannya

1. Akurasi OCR kamu berapa dan diukur gimana?
2. Kalau dokumen blur/jelek, sistem ngapain?
3. Kenapa confidence ini bisa dipercaya?
4. Apa bedanya produkmu dibanding OCR biasa?
5. Kalau dipakai 10.000 user, bottleneck kamu di mana?
6. Cost per dokumen kira-kira berapa?
7. Data user aman gimana (security + privacy)?

Siapkan jawaban versi 20 detik dan 60 detik.

---

## 6) Rencana Eksekusi 7 Hari (Simple)

### Day 1
- Freeze fitur
- Pilih flow demo final
- Kunci data demo

### Day 2
- Hardening error handling
- Rapikan label status fraud/confidence

### Day 3
- Ambil metrik baseline
- Rapikan dashboard untuk tampilkan metrik inti

### Day 4
- Susun deck final (maks 10-12 slide)
- Tulis script presentasi 5 menit

### Day 5
- Simulasi presentasi 3 kali
- Rekam video backup

### Day 6
- Latihan QnA intensif
- Perbaiki bagian yang masih nyangkut

### Day 7
- Full dress rehearsal seperti hari-H
- Stop perubahan besar

---

## 7) Checklist Hari-H (30 Menit Sebelum Naik)

- Internet aman + hotspot backup ready
- Semua service running
- Dokumen demo siap di folder cepat akses
- Login akun sudah siap (jangan login saat mulai)
- Slide + demo + video backup sudah terbuka
- Buka dengan problem, tutup dengan dampak

---

## 8) Batasan Penting (Biar Tidak Bunuh Diri Teknis)

Jangan lakukan ini menjelang final:
- Refactor besar
- Ganti model utama
- Ubah database schema besar
- Nambah fitur baru yang belum diuji

Fokus menang = **reliability + clarity + proof**, bukan fitur terbanyak.

---

## 9) Definisi Menang Versi Top 10

Kalau 3 ini kejadian, peluangmu naik jauh:
1. Demo lancar dari awal sampai akhir
2. Juri paham value produkmu < 1 menit
3. Kamu jawab QnA dengan tenang, berbasis data

Kalau mau, setelah ini bikin file lanjutan:
- `pitch_5_minute.md` (script ngomong kata per kata)
- `qna_defense.md` (jawaban siap pakai untuk pertanyaan juri)
- `demo_runbook.md` (urutan klik dan fallback saat error)
