-- ============================================================================
-- OtaruChain — Reset All User Data (DANGER ZONE)
-- Run this migration in your Supabase SQL Editor to reset everything.
-- ============================================================================

-- 1. Hapus semua transaksi (fraud_scans, documents, extracted_finance_data)
TRUNCATE TABLE extracted_finance_data CASCADE;
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE fraud_scans CASCADE;

-- 2. Hapus semua API keys
TRUNCATE TABLE api_keys CASCADE;

-- 3. Reset data KYC di tabel profiles agar semua user kembali ke state awal
UPDATE profiles 
SET 
  nik = NULL,
  full_name = NULL,
  birth_place = NULL,
  birth_date = NULL,
  gender = NULL,
  address = NULL,
  rt_rw = NULL,
  kelurahan = NULL,
  kecamatan = NULL,
  religion = NULL,
  marital_status = NULL,
  occupation = NULL,
  nationality = 'WNI',
  ktp_photo_url = NULL,
  selfie_photo_url = NULL,
  kyc_verified = FALSE,
  kyc_submitted_at = NULL,
  credits = 10; -- Reset credit ke 10

-- JIKA INGIN MENGHAPUS SEMUA AKUN LOGIN (USER HARUS LOGIN ULANG DARI AWAL BIKIN AKUN)
-- Hapus tanda comment (--) pada baris di bawah ini:
-- DELETE FROM auth.users;
