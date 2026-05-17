-- =============================================================================
-- Queue Separation & Admin Review Tracking Migration
-- Run in Supabase SQL Editor
-- =============================================================================

-- 1. Add source tag to loan_requests for queue separation
ALTER TABLE loan_requests ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'CHAIN';
ALTER TABLE loan_requests ADD COLUMN IF NOT EXISTS doc_type TEXT;

-- Backfill existing rows
UPDATE loan_requests SET source = 'CHAIN' WHERE source IS NULL;

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_loan_requests_source ON loan_requests(source);

-- 2. Add admin review tracking to fraud_scans
ALTER TABLE fraud_scans ADD COLUMN IF NOT EXISTS admin_reviewed BOOLEAN DEFAULT FALSE;
ALTER TABLE fraud_scans ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE fraud_scans ADD COLUMN IF NOT EXISTS admin_reviewed_by TEXT;

-- Backfill: treat all existing verified/tampered rows as admin-reviewed
UPDATE fraud_scans
  SET admin_reviewed = TRUE, reviewed_at = updated_at
  WHERE status IN ('verified', 'tampered') AND admin_reviewed IS NULL;

-- 3. Add admin review tracking to personal_finance_docs
ALTER TABLE personal_finance_docs ADD COLUMN IF NOT EXISTS admin_reviewed BOOLEAN DEFAULT FALSE;
ALTER TABLE personal_finance_docs ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending';
