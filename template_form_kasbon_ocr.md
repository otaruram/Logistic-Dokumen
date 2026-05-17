# Template Form Pengajuan Kasbon (OCR-Compatible)

Gunakan format ini agar dokumen mudah diproses oleh sistem pada endpoint `POST /api/kasbon/process-document`.

## Form

KOPERASI / PERUSAHAAN: ________________________________

FORM PENGAJUAN KASBON KARYAWAN

Tanggal Pengajuan: ____ / ____ / ______

Nama Lengkap: ________________________________________

NIK: 3276012345678901

Divisi / Jabatan: _____________________________________

Nominal Pengajuan: Rp 1.500.000

Keperluan Pengajuan: __________________________________

Nomor HP: ____________________________________________

Pernyataan:
Saya menyatakan data di atas benar dan dapat dipertanggungjawabkan.

Tanda Tangan Pemohon: _________________________________

## Contoh Isian Valid

- NIK: 3276012345678901
- Nominal Pengajuan: Rp 1500000

## Aturan Agar Diterima Sistem

1. NIK wajib 16 digit angka (tanpa spasi/tanda baca).
2. Nominal wajib ada awalan `Rp` (contoh: `Rp 1.500.000` atau `Rp 1500000`).
3. Foto harus fokus, terang, dan tidak blur.
4. Hindari teks seperti: `edited`, `photoshop`, `modified`, `copy paste`.
5. Pastikan baris NIK dan Nominal terlihat utuh (tidak terpotong).

## Payload API yang Dikirim Bot/Web

```json
{
  "image_url": "https://.../form-kasbon.jpg",
  "telegram_chat_id": 123456789
}
```

Catatan:
- `telegram_chat_id` opsional untuk mode non-Telegram.
- Sistem mengambil data NIK + nominal dari teks pada gambar (OCR).
