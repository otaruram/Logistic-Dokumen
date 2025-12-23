-- SQL Migration: Automate Credits and Cleanup
-- Run this in Supabase SQL Editor

-- ==========================================
-- 1. Enable pg_cron extension
-- ==========================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ==========================================
-- 2. Daily Credit Reset Function
-- ==========================================
CREATE OR REPLACE FUNCTION public.reset_daily_credits()
RETURNS void AS $$
BEGIN
  -- Reset credits to 10 for all active users
  UPDATE public.users 
  SET credits = 10, updated_at = NOW()
  WHERE is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 3. Monthly Cleanup Function (DGTNZ)
-- ==========================================
CREATE OR REPLACE FUNCTION public.cleanup_old_scans()
RETURNS void AS $$
BEGIN
  -- Delete scans older than 1 month
  DELETE FROM public.scans 
  WHERE created_at < NOW() - INTERVAL '1 month';
  
  -- Record the cleanup (optional, uses activities if exists, otherwise redundant)
  -- Assuming simple delete is enough.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 4. Schedule Jobs using pg_cron
-- ==========================================

-- Schedule Daily Credit Reset at 00:00 (Midnight)
-- Cron format: min hour day month day_of_week
SELECT cron.schedule(
  'reset-daily-credits', -- unique job name
  '0 0 * * *',           -- everyday at 00:00
  'SELECT public.reset_daily_credits()'
);

-- Schedule Monthly Cleanup at 00:00 on the 1st of every month
SELECT cron.schedule(
  'cleanup-old-scans',   -- unique job name
  '0 0 1 * *',           -- 1st of every month at 00:00
  'SELECT public.cleanup_old_scans()'
);

-- ==========================================
-- Verify Schedules
-- ==========================================
SELECT * FROM cron.job;
