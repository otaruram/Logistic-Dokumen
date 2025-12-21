-- Fix reviews table permissions (UUID type cast fixed)
-- Run this in Supabase SQL Editor

-- 1. Drop ALL existing policies first
DROP POLICY IF EXISTS "Users can insert their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can view all reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON reviews;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON reviews;
DROP POLICY IF EXISTS "Enable read access for all users" ON reviews;

-- 2. Disable RLS temporarily
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;

-- 3. Grant full access to authenticated and service role
GRANT ALL ON reviews TO authenticated;
GRANT ALL ON reviews TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 4. Re-enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 5. Create new policies with proper UUID casting
CREATE POLICY "Users can insert their own reviews" ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view all reviews" ON reviews
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can update their own reviews" ON reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own reviews" ON reviews
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- 6. Verify policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'reviews';

-- Expected output: 4 policies for reviews table
-- If successful, you should see message: "Reviews table permissions fixed!"
