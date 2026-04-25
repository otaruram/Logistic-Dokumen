# QnA Defense - Jawaban Siap Pakai untuk Juri

Tujuan dokumen: bantu kamu jawab cepat, tegas, dan konsisten.
Format tiap pertanyaan:
- Jawaban 20 detik (versi singkat)
- Jawaban 60 detik (versi mendalam)

## 1) Akurasi OCR kalian berapa?
### Jawaban 20 detik
"Akurasi bergantung kualitas dokumen, tapi pendekatan kami bukan sekadar akurasi teks. Kami fokus pada keterbacaan field kritikal dan confidence status untuk keputusan operasional."

### Jawaban 60 detik
"Kami evaluasi pada field penting seperti nominal, nama klien, nomor dokumen, dan tanggal. Jadi KPI kami bukan hanya character-level OCR, tapi decision-level usefulness: berapa dokumen yang bisa langsung verified, berapa yang perlu review. Ini lebih relevan untuk use case operasional dibanding hanya angka akurasi teks mentah."

## 2) Kalau dokumen blur atau kualitas jelek, sistem ngapain?
### Jawaban 20 detik
"Dokumen kualitas rendah tidak dipaksa lolos. Sistem memberi status processing atau tampered agar masuk jalur review manual."

### Jawaban 60 detik
"Desain kami risk-aware. Kalau field verifikasi minim atau ambigu, confidence turun sehingga dokumen tidak dianggap aman otomatis. Itu mencegah false trust. Jadi sistem tetap berguna meskipun input jelek, karena bisa memprioritaskan mana yang butuh intervensi manusia."

## 3) Kenapa confidence status kalian bisa dipercaya?
### Jawaban 20 detik
"Karena confidence diturunkan dari keterbacaan dan konsistensi field kritikal, bukan random scoring."

### Jawaban 60 detik
"Kami gunakan pendekatan berbasis field verifiable: semakin lengkap dan konsisten field penting, status naik ke verified. Jika parsial, status processing; jika sangat minim/inkonsisten, tampered. Ini membuat keputusan transparan, mudah diaudit, dan lebih bisa dipertanggungjawabkan ke tim operasional."

## 4) Bedanya dengan OCR tools biasa?
### Jawaban 20 detik
"OCR biasa berhenti di ekstraksi teks. Kami lanjut ke decision layer dengan fraud/confidence status."

### Jawaban 60 detik
"Perbedaan utama kami ada pada nilai bisnis: bukan cuma membaca dokumen, tapi membantu menentukan tindakan berikutnya. OCR standar menghasilkan teks; OtaruChain menghasilkan prioritas operasional: proses langsung, review manual, atau reject. Ini yang menghemat waktu tim dan menurunkan risiko salah proses."

## 5) Kalau user jadi 10.000, bottleneck ada di mana?
### Jawaban 20 detik
"Bottleneck utama biasanya OCR/AI processing. Karena itu kami pisahkan API dan worker queue agar skalanya bisa horizontal."

### Jawaban 60 detik
"Arsitektur kami sudah dipisah antara request handling dan background processing via queue worker. Ini memungkinkan scaling bertahap: tambah worker untuk throughput, optimasi caching, dan observability untuk antrian. Jadi saat trafik naik, kita tidak perlu redesign total, cukup scale komponen yang jadi bottleneck."

## 6) Cost per dokumen kira-kira berapa?
### Jawaban 20 detik
"Biaya utama ada di inferensi AI dan infrastruktur pemrosesan. Kami desain supaya bisa dioptimalkan bertahap sesuai volume."

### Jawaban 60 detik
"Komponen biaya terbesar biasanya API AI, storage, dan compute worker. Dengan arsitektur sekarang, kami bisa kontrol biaya lewat batching, fallback model, dan threshold pemrosesan. Jadi strategi kami bukan fixed cost mahal di depan, tapi cost-efficient scaling seiring pertumbuhan usage."

## 7) Gimana keamanan data user?
### Jawaban 20 detik
"Kami menerapkan auth, pembatasan akses, dan separation antara data operasional dan proses AI sesuai kebutuhan fitur."

### Jawaban 60 detik
"Prinsip kami least privilege: endpoint terproteksi auth, akses admin dibatasi, dan data diproses sesuai kebutuhan fitur. Kami juga menyiapkan alur review manual untuk kasus ambigu agar keputusan sensitif tidak sepenuhnya otomatis. Fokus kami menjaga keseimbangan antara automasi, keamanan, dan akuntabilitas operasional."

## 8) Kenapa proyek ini layak masuk top 10?
### Jawaban 20 detik
"Karena kami membawa solusi end-to-end yang langsung menyelesaikan pain point nyata: kecepatan, akurasi operasional, dan mitigasi risiko dokumen."

### Jawaban 60 detik
"Kami datang bukan hanya dengan ide, tapi produk yang sudah bisa didemokan end-to-end. Nilai utamanya jelas: percepat proses dokumen, kurangi human error, dan tambahkan confidence layer untuk keputusan. Secara eksekusi, kami punya roadmap realistis, risk mitigation, dan arsitektur yang bisa ditingkatkan bertahap."

---

## Teknik Jawab Saat Ditekan Juri
- Mulai dari jawaban singkat 1 kalimat.
- Lanjut 2-3 kalimat berbasis dampak bisnis.
- Tutup dengan mitigasi risiko atau rencana perbaikan.
- Hindari klaim absolut seperti "100% akurat".
