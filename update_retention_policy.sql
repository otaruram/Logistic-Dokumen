-- Update Retention Policy
-- Run this in Supabase SQL Editor to update the cleanup function

CREATE OR REPLACE FUNCTION public.cleanup_old_scans()
RETURNS void AS $$
BEGIN
  -- Delete scans for users whose account is older than 1 month
  -- This means data is retained for 1 month after user registration
  DELETE FROM public.scans 
  WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE created_at < NOW() - INTERVAL '1 month'
  );
  
  RAISE NOTICE 'Cleanup completed: Deleted scans for users with accounts older than 1 month';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Retention policy updated successfully!' as status;
