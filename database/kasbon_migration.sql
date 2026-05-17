-- ============================================================
-- OtaruChain — Kasbon (Digital Intake Gateway) Migration
-- Use Case: Anti-Fraud OCR untuk Koperasi Internal Perusahaan
-- ============================================================

-- 1. Extend profiles table to add limit_pinjaman & telegram_chat_id
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS limit_pinjaman  BIGINT  NOT NULL DEFAULT 5000000,
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;

-- Index for telegram lookups
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id
  ON profiles (telegram_chat_id);

-- 2. Loan status and AI indicator enums
DO $$ BEGIN
  CREATE TYPE loan_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_indicator AS ENUM ('PROCESSING', 'VERIFIED', 'TAMPERED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. loan_requests table
CREATE TABLE IF NOT EXISTS loan_requests (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nik             VARCHAR(16)   NOT NULL
                    REFERENCES profiles (nik)
                    ON DELETE RESTRICT,
  nominal_pengajuan BIGINT      NOT NULL CHECK (nominal_pengajuan > 0),
  image_url       TEXT          NOT NULL,
  status          loan_status   NOT NULL DEFAULT 'PENDING',
  ai_indicator    ai_indicator  NOT NULL DEFAULT 'PROCESSING',
  sha256_hash     TEXT,                          -- set on APPROVED only
  ocr_raw         JSONB,                         -- raw OCR payload
  submitted_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     UUID          REFERENCES auth.users (id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loan_requests_nik
  ON loan_requests (nik);
CREATE INDEX IF NOT EXISTS idx_loan_requests_status
  ON loan_requests (status);
CREATE INDEX IF NOT EXISTS idx_loan_requests_submitted_at
  ON loan_requests (submitted_at DESC);

-- 4. Row-Level Security
ALTER TABLE loan_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests
CREATE POLICY "users_read_own_loans"
  ON loan_requests FOR SELECT
  USING (
    nik = (SELECT nik FROM profiles WHERE id = auth.uid())
  );

-- Service role has full access (backend uses service key)
CREATE POLICY "service_role_all"
  ON loan_requests FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
