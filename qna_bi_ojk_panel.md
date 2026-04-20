# QnA Panel BI OJK - Final Defense Pack

Dokumen ini merapikan daftar pertanyaan kamu menjadi format siap tempur.
Setiap pertanyaan punya:
- Jawaban 20 detik (ringkas)
- Jawaban 60 detik (mendalam)
- Batas klaim (agar tidak overclaim)

## A. Kategori Teknis dan Logika AI

### 1) Akurasi OCR kalian sebenarnya berapa persen, dan bagaimana cara kalian mengukurnya?
Jawaban 20 detik:
Kami mengukur bukan hanya akurasi karakter, tapi akurasi field bisnis kritikal seperti nominal, nama klien, nomor dokumen, dan tanggal. KPI utama kami adalah decision usefulness: berapa dokumen yang bisa diproses aman, berapa yang harus review manual.

Jawaban 60 detik:
Untuk use case perbankan, metrik yang relevan adalah ketepatan data yang dipakai untuk keputusan, bukan sekadar character-level OCR. Karena itu kami evaluasi per field kritikal, lalu lihat performa klasifikasi status Verified, Processing, dan Tampered. Dengan pendekatan ini, tim operasional mendapat sinyal yang lebih dapat dipakai untuk tindakan, bukan hanya teks mentah.

Batas klaim:
Jangan bilang 100 persen akurat.

### 2) Kalau dokumen kualitasnya jelek, blur, lecek, atau ketumpahan air, sistem melakukan apa?
Jawaban 20 detik:
Dokumen seperti ini tidak dipaksa lolos. Sistem menurunkan confidence, lalu diarahkan ke status Processing untuk review manual.

Jawaban 60 detik:
Kami desain sistem risk-aware. Jika kualitas input buruk atau field verifikasi tidak cukup kuat, sistem tidak memberi lampu hijau otomatis. Dokumen akan masuk jalur Processing agar ada human check. Ini menurunkan risiko false trust dan menjaga kualitas keputusan kredit.

Batas klaim:
Jangan janji semua dokumen jelek tetap bisa dibaca sempurna.

### 3) Kenapa confidence status layak dipercaya tim operasional atau bank?
Jawaban 20 detik:
Karena status diturunkan dari keterbacaan dan konsistensi field kritikal, lalu dipetakan ke tindakan operasional yang jelas.

Jawaban 60 detik:
Kami tidak memakai label confidence sebagai kosmetik. Kami menghubungkan kelengkapan dan konsistensi field ke keputusan operasional: Verified untuk jalur lanjut, Processing untuk verifikasi manual, dan Tampered untuk indikasi risiko tinggi. Model ini transparan, bisa diaudit, dan lebih relevan untuk kebutuhan kontrol risiko.

Batas klaim:
Jangan bilang status ini menggantikan keputusan final analis kredit.

### 4) Bedanya produk kalian dengan OCR tools biasa?
Jawaban 20 detik:
OCR biasa berhenti di ekstraksi teks. Kami lanjut ke decision support dengan status risiko dan jalur tindak lanjut.

Jawaban 60 detik:
Produk OCR umum menghasilkan output teks, sedangkan kami membangun alur operasional end-to-end: ekstraksi field, scoring confidence, pemetaan ke keputusan awal, dan mekanisme review manual. Jadi nilai kami bukan sekadar membaca dokumen, tapi mempercepat keputusan sambil menjaga kontrol risiko.

Batas klaim:
Jangan menjelekkan vendor OCR lain, fokus ke perbedaan use case.

### 5) Kalau API AI eksternal timeout atau down, apa dampaknya?
Jawaban 20 detik:
Kami siapkan fallback model, retry strategy, dan jalur manual review agar operasional tidak berhenti total.

Jawaban 60 detik:
Ketergantungan layanan AI eksternal sudah kami mitigasi dengan multi-layer fallback: retry terbatas, model cadangan, dan eskalasi ke review manual untuk kasus kritikal. Prinsipnya adalah graceful degradation, jadi saat satu komponen terganggu, layanan tetap berjalan dengan mode aman.

Batas klaim:
Jangan bilang sistem kebal downtime, bilang ada mitigasi dan mode aman.

## B. Kategori Skalabilitas dan Infrastruktur

### 6) Kalau dipakai 10.000 user bersamaan, bottleneck ada di mana?
Jawaban 20 detik:
Bottleneck utama ada di layer OCR AI inference dan throughput worker queue, bukan di layer UI.

Jawaban 60 detik:
Pada skenario lonjakan trafik, komponen terberat adalah pemrosesan dokumen asinkron. Karena itu arsitektur kami memisahkan API handling dan background processing lewat Redis plus worker. Dengan pendekatan ini, kapasitas bisa dinaikkan bertahap secara horizontal pada komponen yang memang bottleneck.

Batas klaim:
Jangan bilang sudah siap 10.000 concurrent tanpa load test nyata.

### 7) Kenapa pakai Redis dan worker queue, kenapa tidak real-time langsung?
Jawaban 20 detik:
Karena pemrosesan dokumen bersifat berat dan variatif. Queue menjaga API tetap responsif dan mencegah request timeout.

Jawaban 60 detik:
Jika semua diproses sinkron real-time, risiko timeout dan kegagalan request meningkat saat beban naik. Queue memungkinkan backpressure, retry terkontrol, dan observability antrian. Ini pola standar enterprise untuk workload berat agar SLA layanan front tetap stabil.

Batas klaim:
Jangan janji semua proses instan.

## C. Kategori Keamanan Data dan Regulasi

### 8) Bagaimana menjamin keamanan privasi data user UMKM?
Jawaban 20 detik:
Kami menerapkan autentikasi, kontrol akses berbasis peran, dan prinsip least privilege untuk data operasional.

Jawaban 60 detik:
Kami menerapkan security by design: akses endpoint terautentikasi, pemisahan hak akses, audit trail aktivitas penting, dan pembatasan akses admin sesuai kebutuhan tugas. Prinsipnya minimisasi akses dan akuntabilitas setiap tindakan, agar risiko kebocoran dan penyalahgunaan dapat ditekan.

Batas klaim:
Jangan bilang zero risk.

### 9) Saat data sensitif dikirim ke engine AI eksternal, apakah tidak menyalahi compliance?
Jawaban 20 detik:
Kami posisikan ini sebagai decision support dengan kontrol governance, data minimization, dan jalur manual review untuk kasus sensitif.

Jawaban 60 detik:
Kami menyadari sensitivitas data finansial. Karena itu kami menerapkan prinsip data minimization, batasan penggunaan sesuai kebutuhan proses, dan human oversight pada keputusan penting. Untuk implementasi institusional, kami siap mengikuti kebijakan internal bank terkait klasifikasi data, masking, dan persetujuan pemrosesan sebelum go-live produksi.

Batas klaim:
Jangan mengklaim sudah pasti compliant semua regulasi tanpa audit formal.

### 10) Bagaimana SHA-256 mencegah manipulasi nominal di nota?
Jawaban 20 detik:
SHA-256 tidak mencegah orang mengedit file, tapi membuat perubahan bisa terdeteksi karena hash berubah.

Jawaban 60 detik:
Hash kriptografi berfungsi sebagai tamper-evidence. Ketika dokumen diubah, sidik digitalnya berubah total, sehingga bisa dibandingkan dengan hash referensi untuk mendeteksi perubahan integritas. Jadi fungsi utamanya bukan anti-edit mutlak, tetapi deteksi modifikasi yang kuat untuk audit.

Batas klaim:
Jangan bilang hash membuat dokumen mustahil dipalsukan.

### 11) Jika dokumen dilabeli Verified tapi ternyata fiktif, siapa bertanggung jawab?
Jawaban 20 detik:
Verified adalah rekomendasi sistem, bukan keputusan kredit final. Keputusan final tetap pada institusi melalui governance manusia.

Jawaban 60 detik:
Kami menempatkan sistem sebagai decision support, bukan pengganti otoritas keputusan kredit. Tanggung jawab final berada pada proses governance lembaga yang mencakup verifikasi lanjutan dan persetujuan berjenjang. Karena itu kami menekankan human-in-the-loop untuk kasus bernilai tinggi atau ambigu.

Batas klaim:
Jangan framing seolah AI mengambil keputusan legal final.

## D. Kategori Bisnis dan Adopsi Pengguna

### 12) Berapa cost per document, apakah masuk akal untuk bank?
Jawaban 20 detik:
Biaya utama ada di inferensi AI dan infrastruktur worker, namun desain kami memungkinkan optimasi bertahap sesuai volume.

Jawaban 60 detik:
Kami menghitung biaya per dokumen dari komponen AI processing, storage, dan compute. Efisiensi dicapai lewat batching, fallback model, dan aturan pemrosesan berbasis prioritas. Secara bisnis, nilai yang dicari bank bukan biaya mentah saja, tetapi penghematan waktu verifikasi, pengurangan error, dan mitigasi risiko fraud.

Batas klaim:
Jangan sebut angka pasti jika belum ada perhitungan aktual.

### 13) Target user UMKM atau sopir, yakin mereka mau pakai?
Jawaban 20 detik:
Kami desain alur sesingkat mungkin, dengan input sederhana dan output keputusan yang jelas.

Jawaban 60 detik:
Hambatan adopsi selalu ada, jadi strategi kami adalah minim friction: alur upload cepat, bahasa sederhana, dan output yang langsung actionable. Untuk tahap implementasi, kami sarankan onboarding ringan dan pendampingan awal agar user lapangan nyaman. Fokus kami adalah mengurangi beban pengguna, bukan menambah langkah.

Batas klaim:
Jangan mengklaim adopsi pasti tinggi tanpa pilot.

### 14) Kenapa proyek ini layak Top 10 dibanding tim lain?
Jawaban 20 detik:
Karena kami membawa solusi yang sudah berjalan end-to-end, menyelesaikan pain point nyata, dan punya pendekatan risiko yang matang.

Jawaban 60 detik:
Kekuatan kami ada pada kombinasi tiga hal: masalah yang jelas dan relevan, produk yang bisa didemokan langsung, serta governance yang sadar risiko. Kami tidak berhenti di demo teknologi, tapi mengarahkan output ke keputusan operasional yang terukur. Itu yang membuat solusi ini layak dipertimbangkan kuat untuk Top 10.

Batas klaim:
Jangan merendahkan kompetitor.

---

## Catatan Evaluasi Teks Kamu

Status: valid dan kuat sebagai bank pertanyaan panel.

Yang sudah bagus:
- Pembagian kategori tepat dan realistis untuk panel BI OJK IT.
- Pertanyaannya menyentuh risiko inti: akurasi, compliance, tanggung jawab, dan biaya.

Yang perlu dijaga saat jawab:
- Hindari klaim absolut.
- Tekankan posisi produk sebagai decision support.
- Tunjukkan governance manusia tetap ada.
- Bila belum ada angka final, jawab dengan metodologi dan rencana validasi.

## Checklist Latihan 1 Jam

1. Latihan jawaban 20 detik untuk semua pertanyaan.
2. Latihan jawaban 60 detik untuk 5 pertanyaan tersulit.
3. Pilih 3 kalimat anti panik jika ditekan juri.
4. Simulasi panel dengan teman sebagai juri keras.
