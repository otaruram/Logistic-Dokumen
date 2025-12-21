-- Daily Credit Reset Cron Job
-- Runs every day at 00:00 UTC to reset all user credits to 10

-- 1. Create daily credit reset function
CREATE OR REPLACE FUNCTION daily_credit_reset()
RETURNS void AS $$
BEGIN
    -- Reset all users' credits to 10
    UPDATE users
    SET credits = 10
    WHERE credits < 10;  -- Only update users who used credits
    
    RAISE NOTICE 'Daily credit reset completed - all users now have 10 credits';
END;
$$ LANGUAGE plpgsql;

-- 2. For Supabase Free Tier: Use external cron service
-- Call this endpoint daily at 00:00 UTC:
-- POST https://api-ocr.xyz/api/cleanup/daily-credit-reset
-- Header: Authorization: Bearer your-secret-cleanup-key-here

-- 3. Manual execution (for testing)
SELECT daily_credit_reset();

-- 4. Set default credits for new users
ALTER TABLE users 
ALTER COLUMN credits SET DEFAULT 10;

-- Notes:
-- - All users get 10 credits reset daily at 00:00 UTC
-- - Credits never permanently run out
-- - New users start with 10 credits
-- - Free forever model with daily refresh
