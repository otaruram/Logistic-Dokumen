-- Execute this in Supabase SQL Editor to refresh Postgrest schema cache
-- This will make the reviews table visible to the API

-- Method 1: Reload schema cache (recommended)
NOTIFY pgrst, 'reload schema';

-- Method 2: If above doesn't work, recreate RLS policies with service_role bypass
-- Uncomment and run these if Method 1 fails:

/*
-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can view their own reviews" ON public.reviews;

-- Recreate policies with service_role bypass
CREATE POLICY "Anyone can view approved reviews"
ON public.reviews
FOR SELECT
USING (is_approved = true OR auth.role() = 'service_role');

CREATE POLICY "Service role and authenticated users can insert"
ON public.reviews
FOR INSERT
WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "Users and service role can view reviews"
ON public.reviews
FOR SELECT
USING (
  auth.uid()::text = user_id 
  OR auth.role() = 'service_role'
  OR is_approved = true
);

-- Grant permissions
GRANT SELECT ON public.reviews TO anon, authenticated, service_role;
GRANT INSERT ON public.reviews TO authenticated, service_role;
GRANT ALL ON public.reviews TO service_role;
*/
