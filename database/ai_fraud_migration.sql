-- =============================================================================
-- AI Fraud Indicator Migration (Gemini 2.5 Flash Integration)
-- Run in Supabase SQL Editor
-- =============================================================================

-- 1. Add AI Fraud Detection columns to loan_requests
ALTER TABLE loan_requests
  ADD COLUMN IF NOT EXISTS ai_fraud_status  VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_fraud_reason  TEXT DEFAULT NULL;

-- 2. Index for fast filtering by AI fraud status
CREATE INDEX IF NOT EXISTS idx_loan_requests_ai_fraud_status
  ON loan_requests(ai_fraud_status);

-- 3. Backfill existing PENDING rows as NULL (not yet analyzed)
-- No backfill needed — NULL means "not analyzed yet"

-- 4. Add CHECK constraint for allowed values
ALTER TABLE loan_requests
  DROP CONSTRAINT IF EXISTS chk_ai_fraud_status;

ALTER TABLE loan_requests
  ADD CONSTRAINT chk_ai_fraud_status
  CHECK (ai_fraud_status IS NULL OR ai_fraud_status IN ('TRUSTED', 'NEEDS_REVIEW', 'FRAUD'));

-- 5. Add NEED_REVISION to loan_status enum for the Revision feature
ALTER TYPE loan_status ADD VALUE IF NOT EXISTS 'NEED_REVISION';
