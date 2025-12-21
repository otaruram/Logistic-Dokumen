-- Weekly Cleanup Cron Job for DGTNZ & ImageKit
-- Runs every Sunday at 00:00 UTC to delete old data

-- 1. Create cleanup function for DGTNZ scans (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_dgtnz_scans()
RETURNS void AS $$
BEGIN
    -- Delete old scans (DGTNZ)
    DELETE FROM scans
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    RAISE NOTICE 'Deleted old DGTNZ scans';
END;
$$ LANGUAGE plpgsql;

-- 2. Create cleanup function for ImageKit files (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_imagekit_files()
RETURNS void AS $$
BEGIN
    -- Delete old ImageKit tracking records
    DELETE FROM imagekit_files
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    RAISE NOTICE 'Deleted old ImageKit file records';
END;
$$ LANGUAGE plpgsql;

-- 3. Create cleanup function for activities (keep only last 30 days for analytics)
CREATE OR REPLACE FUNCTION cleanup_old_activities()
RETURNS void AS $$
BEGIN
    -- Delete activities older than 30 days
    DELETE FROM activities
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    RAISE NOTICE 'Deleted old activity records';
END;
$$ LANGUAGE plpgsql;

-- 4. Create master cleanup function
CREATE OR REPLACE FUNCTION weekly_cleanup_job()
RETURNS void AS $$
BEGIN
    -- Run all cleanup functions
    PERFORM cleanup_old_dgtnz_scans();
    PERFORM cleanup_old_imagekit_files();
    PERFORM cleanup_old_activities();
    
    RAISE NOTICE 'Weekly cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- 5. Enable pg_cron extension (run this first if not already enabled)
-- Note: This requires superuser privileges in Supabase
-- Go to Dashboard > Database > Extensions and enable "pg_cron"

-- 6. Schedule cron job using pg_cron
-- After enabling extension, run this in SQL Editor:
/*
SELECT cron.schedule(
    'weekly-cleanup-job',
    '0 0 * * 0',  -- Every Sunday at midnight UTC
    $$SELECT weekly_cleanup_job();$$
);
*/

-- Alternative: Use Supabase Database Webhooks
-- 1. Go to Supabase Dashboard > Database > Webhooks
-- 2. Create new webhook with:
--    - Name: Weekly Cleanup
--    - Table: any table (just for trigger)
--    - Events: INSERT (or any event)
--    - Type: Supabase Edge Function
--    - Schedule: Use external cron service (cron-job.org, etc)
-- 3. Call this function via HTTP endpoint

-- 7. For Supabase Free Tier: Manual execution or external cron
-- You can create an API endpoint and call it from external cron service

-- 8. Check scheduled jobs (only works if pg_cron is enabled)
-- SELECT * FROM cron.job;

-- 9. Manual execution (for testing)
SELECT weekly_cleanup_job();

-- 10. Unschedule job (if needed and pg_cron is enabled)
-- SELECT cron.unschedule('weekly-cleanup-job');

-- Notes:
-- - DGTNZ scans deleted after 7 days
-- - ImageKit file tracking deleted after 7 days (actual files need API cleanup)
-- - Activities kept for 30 days for analytics
-- - Cron runs every Sunday at midnight UTC
