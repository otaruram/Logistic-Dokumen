-- compliance_migration.sql
-- Run this in Supabase SQL Editor to apply compliance and gamification schema updates

-- 1A: Consent flag (UU PDP compliance)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS data_consent_given BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS data_consent_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS data_consent_version TEXT DEFAULT 'v1.0';

-- 1A: Gamification Tampered tracking
ALTER TABLE gamification_badges 
  ADD COLUMN IF NOT EXISTS tampered_count INTEGER DEFAULT 0;

-- 3B: Certificate Verifications table
CREATE TABLE IF NOT EXISTS certificate_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    verification_hash TEXT NOT NULL UNIQUE,
    badge_tier TEXT NOT NULL,
    month_year TEXT NOT NULL,
    otaru_index INTEGER,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    verified_count INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cert_verify_hash ON certificate_verifications(verification_hash);
