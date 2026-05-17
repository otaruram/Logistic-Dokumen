-- ============================================================
-- Phone Identity & Admin Access Migration
-- Otaru Unified Ecosystem
-- ============================================================

-- 1. Add mobile_number to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mobile_number TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_mobile_number 
  ON profiles (mobile_number) WHERE mobile_number IS NOT NULL;

-- 2. Add mobile_number link to api_keys
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS mobile_number TEXT;

-- 3. Authorized Admins table (dynamic whitelist)
CREATE TABLE IF NOT EXISTS authorized_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  approved_by TEXT NOT NULL DEFAULT 'system',
  approved_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the primary admin
INSERT INTO authorized_admins (email, approved_by) 
VALUES ('okitr52@gmail.com', 'system')
ON CONFLICT (email) DO NOTHING;

-- 4. Admin Access Requests table
CREATE TABLE IF NOT EXISTS admin_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  email TEXT NOT NULL,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
  requested_at TIMESTAMPTZ DEFAULT now(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_access_requests_status 
  ON admin_access_requests (status);

-- 5. Add stamped_image_url to loan_requests (for stamping engine)
ALTER TABLE loan_requests ADD COLUMN IF NOT EXISTS stamped_image_url TEXT;
