-- ==========================================
-- DISABLE RLS COMPLETELY FOR COMMUNITY TABLES
-- ==========================================
-- Run this in Supabase SQL Editor to allow backend access

-- Disable RLS for community_posts (allow read/write)
ALTER TABLE public.community_posts DISABLE ROW LEVEL SECURITY;

-- Disable RLS for users table (allow backend to check team_id)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Disable RLS for teams table
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;

-- Disable RLS for reviews table
ALTER TABLE public.reviews DISABLE ROW LEVEL SECURITY;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ RLS completely disabled for all community tables!';
  RAISE NOTICE '✅ Backend can now read/write without authentication checks!';
END $$;
