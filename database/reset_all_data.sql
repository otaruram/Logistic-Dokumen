-- ============================================================================
-- OtaruChain — Reset All Data Script
-- WARNING: THIS SCRIPT WILL PERMANENTLY DELETE ALL USER AND TRANSACTION DATA.
-- Use this only for development, testing, or complete system reset.
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- Disable triggers temporarily to speed up truncation (optional but recommended)
-- Note: Requires superuser or table owner permissions
-- SET session_replication_role = 'replica';

-- 1. Truncate all application tables using CASCADE to handle foreign keys
TRUNCATE TABLE 
    supa_ledger,
    assessments,
    gamification_profiles,
    loan_history,
    worker_profiles,
    profiles,
    employee_whitelist,
    audit_log
CASCADE;

-- 2. Optional: Delete all authenticated users from Supabase Auth
-- Uncomment the line below if you want to completely wipe all registered users.
-- This will force everyone to sign up/login again via Google.
-- DELETE FROM auth.users;

-- Re-enable triggers
-- SET session_replication_role = 'origin';

-- ============================================================================
-- Note on Seed Data:
-- After running this script, you may want to re-run portions of `schema.sql` 
-- or `whitelist_auth_migration.sql` to insert the default/demo seed data back 
-- into the system.
-- ============================================================================
