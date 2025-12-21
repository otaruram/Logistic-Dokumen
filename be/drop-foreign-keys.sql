-- =====================================================
-- Drop Foreign Key Constraints Before Prisma Push
-- Run this in Supabase SQL Editor BEFORE prisma db push
-- =====================================================

-- Drop foreign key from quizzes if it exists
ALTER TABLE IF EXISTS public.quizzes 
DROP CONSTRAINT IF EXISTS quizzes_user_id_fkey;

-- Drop foreign key from imagekit_files if it exists
ALTER TABLE IF EXISTS public.imagekit_files 
DROP CONSTRAINT IF EXISTS imagekit_files_user_id_fkey;

-- Note: Prisma will manage foreign keys to the users table
-- These constraints pointed to auth.users which causes cross-schema issues
