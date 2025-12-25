# 📖 Manual Guide: Git Push & VPS Update

Saya sudah membantu membersihkan file "sampah" (Laporan Excel, database SQLite, dan dokumen duplikat) agar repository Anda lebih rapi sesuai permintaan.

---

## 🚀 1. Panduan Push ke GitHub (Manual)

Jika Anda mendapatkan error `repository rule violations`, itu biasanya karena GitHub mendeteksi **file `.env`** atau **API Key** yang di-push. Saya sudah menghapus file sensitif tersebut dari index Git (tapi tetap ada di laptop Anda).

Jalankan perintah ini di laptop Anda:

```bash
# 1. Pastikan Anda di branch main
git checkout main

# 2. Ambil perubahan cleanup yang saya buat
git add .
git commit -m "chore: cleanup junk files and untrack sensitive env"

# 3. Push ke GitHub
# Jika masih ditolak karena 'rule violations', coba push ke branch baru untuk testing
git push origin main
```

**Tips jika push masih gagal:**
- Jika GitHub menyebutkan "Secret detected", periksa file `.env` Anda. Pastikan nama file `.env` sudah masuk ke `.gitignore` (sudah saya tambahkan).
- Jika `main` diproteksi, coba push ke branch lain: `git push origin main:development`.

---

## ☁️ 2. Panduan Update Backend di VPS

Setelah Anda berhasil melakukan `git push` di atas, ikuti langkah ini di VPS Anda untuk menerapkan perubahan:

```bash
# 1. Masuk ke folder project di VPS
cd /path/to/your/project/ocr-app

# 2. Ambil kode terbaru dari GitHub
git pull origin main

# 3. Rebuild container backend (tanpa menghentikan database jika terpisah)
# --no-cache memastikan file baru (api/ppt.py dll) terupdate
docker compose build --no-cache backend

# 4. Restart service backend agar perubahan aktif
docker compose up -d backend

# 5. Cek log untuk memastikan tidak ada error
docker compose logs -f backend
```

---

## 🛠️ Perubahan Penting yang Sudah Diterapkan:
1.  **PPT Preview Fixed**: Menggunakan CDN `unpkg.com` untuk PDF worker (Aman di Prod).
2.  **Device Mode Support**: Preview PPT sekarang mengikuti lebar layar (Mobile/Tablet/Desktop).
3.  **Quiz Relaxed Validation**: Tidak akan error 500 jika AI hanya menghasilkan sedikit soal.
4.  **New Pages**: Halaman Privacy Policy dan Help Center sudah siap di tab Settings.

Jika ada kendala saat `git push` (misal minta username/password/token), pastikan Anda sudah login ke GitHub di browser atau menggunakan [GitHub CLI](https://cli.github.com/).
