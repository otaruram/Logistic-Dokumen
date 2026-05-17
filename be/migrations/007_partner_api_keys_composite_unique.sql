-- ============================================================
-- Migration 007: Allow separate Finance + Decision keys per user
-- 
-- Problem: partner_api_keys has UNIQUE(email), which means
-- generating a Finance key overwrites the Decision key and
-- vice versa. Both use upsert on_conflict="email".
--
-- Fix: Replace UNIQUE(email) with UNIQUE(email, partner_name)
-- so each user can have one key per service type.
-- ============================================================

-- Step 1: Drop existing unique constraint on email
ALTER TABLE partner_api_keys DROP CONSTRAINT IF EXISTS partner_api_keys_email_key;

-- Also drop unique index if it was created as an index instead
DROP INDEX IF EXISTS partner_api_keys_email_key;
DROP INDEX IF EXISTS partner_api_keys_email_idx;

-- Step 2: Create composite unique index (email + partner_name)
CREATE UNIQUE INDEX IF NOT EXISTS partner_api_keys_email_partner_name_idx 
  ON partner_api_keys (email, partner_name);
