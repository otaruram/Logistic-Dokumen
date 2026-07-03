-- ============================================================================
-- OtaruChain — Whitelist Auth Migration
-- Google Login + Phone Whitelist Authentication System
-- Run this migration in your Supabase SQL Editor
-- ============================================================================
-- Replaces the old KYC-based auth (NIK + KTP photo) with a Data Minimization
-- approach: Admin uploads employee phone numbers → User logs in with Google →
-- Verifies phone against whitelist → Access granted.
-- ============================================================================


-- ============================================================================
-- 1. Employee Whitelist Table
-- ============================================================================
-- Stores phone numbers approved by HR/Koperasi admin.
-- This is the SINGLE source of truth for "who is allowed to use the platform".
-- Deliberately minimal: no sensitive data (NIK, income, etc.) per UU PDP.

CREATE TABLE IF NOT EXISTS employee_whitelist (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number    VARCHAR(20) NOT NULL,           -- Normalized E.164: +6281234567890
    company_id      TEXT NOT NULL DEFAULT 'default', -- Koperasi/company identifier
    employee_name   TEXT,                            -- Optional display name (from HR data)
    is_active       BOOLEAN DEFAULT TRUE,            -- Soft delete / deactivate
    created_by      TEXT,                            -- Admin email who added this entry
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    -- One phone number per company (prevents duplicate entries)
    CONSTRAINT uq_whitelist_phone_company UNIQUE (phone_number, company_id)
);

COMMENT ON TABLE employee_whitelist IS 'Phone whitelist for employee access control. Admin-managed, used during onboarding verification.';
COMMENT ON COLUMN employee_whitelist.phone_number IS 'Normalized to E.164 format (+62XXXXXXXXXX). Primary lookup key during verification.';
COMMENT ON COLUMN employee_whitelist.company_id IS 'Identifier for the Koperasi or company. Allows multi-tenant whitelist management.';
COMMENT ON COLUMN employee_whitelist.employee_name IS 'Optional employee name from HR data. For admin display only, not used in auth logic.';


-- ============================================================================
-- 2. Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_whitelist_phone
    ON employee_whitelist (phone_number);

CREATE INDEX IF NOT EXISTS idx_whitelist_company
    ON employee_whitelist (company_id);

CREATE INDEX IF NOT EXISTS idx_whitelist_active
    ON employee_whitelist (is_active)
    WHERE is_active = TRUE;


-- ============================================================================
-- 3. Augment Profiles Table for New Auth Flow
-- ============================================================================
-- Add columns to support Google OAuth + phone verification flow.
-- These columns are additive — existing KYC columns remain untouched.

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS google_id TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS whitelist_company_id TEXT;

-- Index for quick Google ID lookups
CREATE INDEX IF NOT EXISTS idx_profiles_google_id
    ON profiles (google_id)
    WHERE google_id IS NOT NULL;

-- Index for active status filtering
CREATE INDEX IF NOT EXISTS idx_profiles_is_active
    ON profiles (is_active)
    WHERE is_active = TRUE;

-- Backfill: Mark existing KYC-verified users as active (backward compat)
UPDATE profiles
SET is_active = TRUE, onboarding_completed = TRUE
WHERE kyc_verified = TRUE AND is_active IS NOT TRUE;


-- ============================================================================
-- 4. Row Level Security for employee_whitelist
-- ============================================================================

ALTER TABLE employee_whitelist ENABLE ROW LEVEL SECURITY;

-- Service role (backend) has full access
CREATE POLICY "service_access_whitelist" ON employee_whitelist
    FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- Authenticated users can only read (to check their own number)
CREATE POLICY "authenticated_read_whitelist" ON employee_whitelist
    FOR SELECT TO authenticated
    USING (TRUE);


-- ============================================================================
-- 5. Auto-update updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_whitelist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_whitelist_updated_at ON employee_whitelist;
CREATE TRIGGER trg_whitelist_updated_at
    BEFORE UPDATE ON employee_whitelist
    FOR EACH ROW
    EXECUTE FUNCTION update_whitelist_updated_at();


-- ============================================================================
-- 6. Seed Data (Demo)
-- ============================================================================
-- Sample whitelist entries matching existing worker_profiles phone numbers.

INSERT INTO employee_whitelist (phone_number, company_id, employee_name, created_by)
VALUES
    ('+6281234567890', 'koperasi-maju-bersama', 'Ahmad Suparman', 'admin@otaruchain.id'),
    ('+6281234567891', 'koperasi-maju-bersama', 'Siti Rahayu', 'admin@otaruchain.id'),
    ('+6281234567892', 'koperasi-maju-bersama', 'Budi Santoso', 'admin@otaruchain.id')
ON CONFLICT (phone_number, company_id) DO NOTHING;
