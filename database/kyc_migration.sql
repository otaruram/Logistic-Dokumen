-- ============================================================================
-- OtaruChain KYC — Add identity verification columns to profiles table
-- Run this migration in your Supabase SQL Editor
-- ============================================================================

-- Add KYC columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS nik VARCHAR(16) UNIQUE,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS birth_place TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS rt_rw VARCHAR(10),
  ADD COLUMN IF NOT EXISTS kelurahan VARCHAR(100),
  ADD COLUMN IF NOT EXISTS kecamatan VARCHAR(100),
  ADD COLUMN IF NOT EXISTS religion VARCHAR(20),
  ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS occupation VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nationality VARCHAR(20) DEFAULT 'WNI',
  ADD COLUMN IF NOT EXISTS ktp_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS selfie_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ;

-- Create index for NIK lookups (used by partner search)
CREATE INDEX IF NOT EXISTS idx_profiles_nik ON profiles(nik);

-- Create index for KYC status checks
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_verified ON profiles(kyc_verified);

-- ============================================================================
-- RLS Policy: Allow users to read/update their own KYC data
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid()::text = id::text);

-- Users can update their own profile (including KYC submission)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid()::text = id::text);

-- Service role can do anything (for backend operations)
DROP POLICY IF EXISTS "Service role full access" ON profiles;
CREATE POLICY "Service role full access"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role');
