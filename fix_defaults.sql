-- Comprehensive fix for missing default values
-- Run this in Supabase SQL Editor

BEGIN;

-- Fix scans.updated_at
ALTER TABLE scans ALTER COLUMN updated_at SET DEFAULT NOW();

-- Fix reviews.id (UUID default)
ALTER TABLE reviews ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Fix activities.id (UUID default)
ALTER TABLE activities ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Fix document_audits.id (UUID default) - just to be safe
ALTER TABLE document_audits ALTER COLUMN id SET DEFAULT gen_random_uuid();

COMMIT;

SELECT 'All default values fixed successfully!' as status;
