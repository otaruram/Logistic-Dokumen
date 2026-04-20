# Demo Runbook - Urutan Klik dan Fallback

Tujuan: memastikan live demo aman, cepat, dan minim risiko.

## A. Pre-Flight (H-1)
1. Pastikan flow demo final tidak berubah.
2. Siapkan 3 dokumen:
- good_case.pdf
- medium_case.pdf
- bad_case.pdf
3. Pastikan akun login demo siap.
4. Pastikan backup video demo sudah jadi.
5. Simpan screenshot hasil untuk tiap skenario.

## B. Pre-Flight (30 Menit Sebelum Naik)
1. Jalankan service penting.
2. Verifikasi API backend bisa diakses.
3. Verifikasi queue worker hidup.
4. Verifikasi Redis sehat.
5. Buka tab:
- Slide presentasi
- Aplikasi utama
- Video backup (pause di frame awal)
- Catatan script singkat

## C. Urutan Demo Live (Klik per Klik)
1. Masuk aplikasi (sudah login).
2. Buka halaman fitur utama scan/OCR.
3. Upload good_case.
4. Tunjukkan field hasil ekstraksi + status verified.
5. Upload medium_case.
6. Tunjukkan status processing + alasan perlu review manual.
7. Upload bad_case.
8. Tunjukkan status tampered + kenapa tidak auto-approve.
9. Buka dashboard ringkas.
10. Tunjukkan dampak: prioritas review jadi jelas.
11. Tutup dengan 1 kalimat value bisnis.

## D. Narasi Singkat per Tahap
- Tahap upload: "Dokumen masuk dari operasional."
- Tahap ekstraksi: "Sistem baca field kritikal otomatis."
- Tahap status: "Sistem kasih confidence untuk keputusan cepat."
- Tahap dashboard: "Tim bisa prioritas dokumen secara efisien."

## E. Fallback Matrix (Jika Error Saat Live)

### 1) Upload gagal
Langkah:
1. Coba ulang 1 kali dengan file lain.
2. Jika masih gagal, pindah ke screenshot hasil yang sudah disiapkan.
Narasi:
"Saya lanjutkan dengan hasil yang sudah diproses sebelumnya untuk tunjukkan logic penilaiannya."

### 2) OCR lama/timeout
Langkah:
1. Tunggu 5-10 detik sambil jelaskan proses.
2. Jika tetap lambat, buka hasil sample yang sudah jadi.
Narasi:
"Agar efisien waktu, saya lanjut ke hasil yang sudah selesai diproses."

### 3) Worker queue bermasalah
Langkah:
1. Skip batch flow.
2. Tunjukkan single-flow result dari data siap pakai.
Narasi:
"Batch processing tetap ada di arsitektur, tapi untuk waktu presentasi saya fokus ke core decision flow."

### 4) Internet tidak stabil
Langkah:
1. Langsung putar video backup.
2. Lanjut penjelasan tanpa berhenti.
Narasi:
"Saya lanjut via backup recording agar alur tetap terlihat utuh."

### 5) UI glitch minor
Langkah:
1. Jangan panik.
2. Reload 1 kali jika aman.
3. Kalau masih glitch, lanjut pakai screenshot.
Narasi:
"Saya fokuskan ke output intinya karena ini yang menentukan keputusan operasional."

## F. Batasan Saat Demo
- Jangan buka fitur sampingan yang bukan inti.
- Jangan debugging live terlalu lama.
- Jangan mengubah config saat sesi berlangsung.
- Jangan klaim angka yang tidak bisa dibuktikan.

## G. Definition of Done untuk Demo
Demo dianggap sukses jika:
1. 3 skenario terlihat jelas (verified, processing, tampered).
2. Juri paham perbedaan tindakan di tiap status.
3. Penutupan mengikat ke dampak bisnis, bukan sekadar teknologi.

## H. Script Penutup 15 Detik
"Intinya, OCR.WTF bukan hanya membaca dokumen, tapi membantu tim menentukan tindakan yang tepat dengan cepat. Ini yang menurunkan beban manual sekaligus mengurangi risiko salah proses."
