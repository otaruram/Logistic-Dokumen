-- DISABLE ALL RLS - For Development/Testing Only
-- Execute this in Supabase SQL Editor
-- WARNING: This removes all security - NOT for production!

-- Drop all policies from all tables
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop policies from imagekit_files
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'imagekit_files' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.imagekit_files';
    END LOOP;
    
    -- Drop policies from users
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.users';
    END LOOP;
    
    -- Drop policies from quizzes
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'quizzes' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.quizzes';
    END LOOP;
    
    -- Drop policies from scans
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'scans' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.scans';
    END LOOP;
    
    -- Drop policies from invoices
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'invoices' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.invoices';
    END LOOP;
    
    -- Drop policies from community_posts
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'community_posts' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.community_posts';
    END LOOP;
    
    -- Drop policies from teams
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'teams' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.teams';
    END LOOP;
END $$;

-- Disable RLS on all tables
ALTER TABLE IF EXISTS public.imagekit_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quizzes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scans DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.community_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_history DISABLE ROW LEVEL SECURITY;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '⚠️  ALL RLS DISABLED!';
  RAISE NOTICE '✅ All tables are now fully accessible without restrictions';
  RAISE NOTICE '❌ WARNING: This is NOT secure - only for development!';
END $$;
