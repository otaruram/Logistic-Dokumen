-- Quick fix for scans.updated_at NOT NULL constraint
-- Run this in Supabase SQL Editor

ALTER TABLE scans ALTER COLUMN updated_at SET DEFAULT NOW();

SELECT 'Fixed: scans.updated_at now has default value' as status;
