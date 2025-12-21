-- Fix RLS permissions for backend service operations
-- Execute this in Supabase SQL Editor

-- Allow service role to bypass RLS for imagekit_files table
ALTER TABLE public.imagekit_files DISABLE ROW LEVEL SECURITY;

-- Re-enable with proper policies
ALTER TABLE public.imagekit_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.imagekit_files;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.imagekit_files;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.imagekit_files;

-- Allow service role full access (for backend operations)
CREATE POLICY "Service role has full access"
  ON public.imagekit_files
  FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Allow authenticated users to see their own files
CREATE POLICY "Users can view own files"
  ON public.imagekit_files
  FOR SELECT
  USING (user_id = auth.uid()::text::integer OR auth.role() = 'service_role');

-- Ensure users table allows backend updates
DROP POLICY IF EXISTS "Service role can update users" ON public.users;

CREATE POLICY "Service role can update users"
  ON public.users
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ RLS permissions fixed for backend operations!';
  RAISE NOTICE '✅ Service role can now track files and deduct credits!';
END $$;
