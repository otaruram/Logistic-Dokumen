-- =====================================================
-- FIX: Change user_id from UUID to TEXT
-- Run this ONLY if you already created the quizzes table
-- and getting "invalid input syntax for type uuid" error
-- =====================================================

-- Drop existing foreign key constraint if exists
ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_user_id_fkey;

-- Change column type to INTEGER (to match Prisma User.id)
ALTER TABLE public.quizzes ALTER COLUMN user_id TYPE INTEGER USING user_id::integer;

-- Update RLS policy to work with INTEGER user_id
DROP POLICY IF EXISTS "Users can view own quizzes" ON public.quizzes;
CREATE POLICY "Users can view own quizzes" 
ON public.quizzes 
FOR SELECT 
USING (user_id = (SELECT id FROM users WHERE id::text = auth.uid()::text));

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'quizzes' AND column_name = 'user_id';
