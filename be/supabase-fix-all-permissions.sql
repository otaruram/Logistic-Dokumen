-- COMPREHENSIVE FIX: Reset and Rebuild All RLS Permissions
-- Execute this in Supabase SQL Editor
-- This fixes: imagekit_files, users, quizzes permissions

-- ====================================
-- STEP 1: RESET - Drop ALL existing policies
-- ====================================

-- Drop all imagekit_files policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'imagekit_files' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.imagekit_files';
    END LOOP;
END $$;

-- Drop all users policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.users';
    END LOOP;
END $$;

-- Drop all quizzes policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'quizzes' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.quizzes';
    END LOOP;
END $$;

-- ====================================
-- STEP 2: REBUILD - Create new policies
-- ====================================

-- 1. imagekit_files table
ALTER TABLE public.imagekit_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imagekit_backend_full_access"
  ON public.imagekit_files FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "imagekit_user_access"
  ON public.imagekit_files FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. users table  
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_backend_full_access"
  ON public.users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "users_read_own"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid()::text::integer = id);

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid()::text::integer = id)
  WITH CHECK (auth.uid()::text::integer = id);

-- 3. quizzes table
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quizzes_backend_full_access"
  ON public.quizzes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "quizzes_user_view_own"
  ON public.quizzes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text::integer);

CREATE POLICY "quizzes_user_create"
  ON public.quizzes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text::integer);

-- ====================================
-- Success message
-- ====================================
DO $$ 
BEGIN 
  RAISE NOTICE '✅ All policies reset and rebuilt successfully!';
  RAISE NOTICE '✅ Backend can now: track files, deduct credits, create quizzes';
  RAISE NOTICE '✅ Users can: read/update own data, create quizzes';
END $$;
