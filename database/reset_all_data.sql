-- ============================================================================
-- OtaruChain — Reset All User Data (DANGER ZONE)
-- Jalankan di Supabase SQL Editor. TIDAK BISA DIBATALKAN.
-- Update terakhir: mencakup kasbon, gamification, partner, finance, dll.
-- ============================================================================

-- ── 1. DATA DOKUMEN & SCAN ───────────────────────────────────────────────────
TRUNCATE TABLE extracted_finance_data CASCADE;
TRUNCATE TABLE documents         CASCADE;
TRUNCATE TABLE fraud_scans       CASCADE;

-- ── 2. KASBON / LOAN ─────────────────────────────────────────────────────────
TRUNCATE TABLE loan_requests CASCADE;

-- ── 3. GAMIFICATION ──────────────────────────────────────────────────────────
TRUNCATE TABLE gamification_badges CASCADE;

-- ── 4. PARTNER & API KEYS ────────────────────────────────────────────────────
TRUNCATE TABLE api_keys         CASCADE;
TRUNCATE TABLE partner_api_keys CASCADE;
TRUNCATE TABLE partner_api_usage CASCADE;

-- ── 5. PERSONAL FINANCE (Otaru Finance) ──────────────────────────────────────
TRUNCATE TABLE personal_finance_profiles CASCADE;
TRUNCATE TABLE personal_finance_docs     CASCADE;
TRUNCATE TABLE active_installments       CASCADE;
TRUNCATE TABLE otaru_score_history       CASCADE;

-- ── 6. FAMILY SHARING ────────────────────────────────────────────────────────
TRUNCATE TABLE family_sharing_invites CASCADE;
TRUNCATE TABLE family_sharing_access  CASCADE;

-- ── 7. TELEGRAM LINKS ────────────────────────────────────────────────────────
TRUNCATE TABLE telegram_links CASCADE;

-- ── 8. AUDIT & LEDGER ────────────────────────────────────────────────────────
TRUNCATE TABLE ledger_audit_log    CASCADE;
TRUNCATE TABLE credit_score_cycles CASCADE;

-- ── 9. CERTIFICATE VERIFICATIONS ─────────────────────────────────────────────
TRUNCATE TABLE certificate_verifications CASCADE;

-- ── 10. ADMIN ACCESS REQUESTS (bukan authorized_admins — admin tetap ada) ────
TRUNCATE TABLE admin_access_requests CASCADE;

-- ── 11. RESET PROFILES ke state awal ─────────────────────────────────────────
-- KYC dikosongkan, credits kembali ke 10, limit_pinjaman ke default
UPDATE profiles
SET
  nik               = NULL,
  full_name         = NULL,
  birth_place       = NULL,
  birth_date        = NULL,
  gender            = NULL,
  address           = NULL,
  rt_rw             = NULL,
  kelurahan         = NULL,
  kecamatan         = NULL,
  religion          = NULL,
  marital_status    = NULL,
  occupation        = NULL,
  nationality       = 'WNI',
  ktp_photo_url     = NULL,
  selfie_photo_url  = NULL,
  kyc_verified      = FALSE,
  kyc_submitted_at  = NULL,
  credits           = 10,
  limit_pinjaman    = 5000000,
  telegram_chat_id  = NULL,
  phone_number      = NULL;

-- ── 12. HAPUS SEMUA AKUN LOGIN (OPSIONAL) ────────────────────────────────────
-- Uncomment baris berikut jika ingin user harus daftar ulang dari awal:
-- DELETE FROM auth.users;

-- ── SELESAI ──────────────────────────────────────────────────────────────────
-- Frontend tidak perlu diubah — data kosong otomatis terefleksi di UI.
-- Jika ada sesi aktif, user cukup logout lalu login ulang.
