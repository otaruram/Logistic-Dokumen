-- ========================================
-- SQL Script untuk Sinkronisasi Database
-- Run di Supabase SQL Editor
-- ========================================

-- ==========================================
-- PART 1: FIX TEAMS TABLE (INTEGER ID Fix)
-- ==========================================
-- Problem: teams.created_by receives Integer (7) but expects UUID
-- Solution: Change to BIGINT to match local users.id

-- Drop existing foreign key constraint
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_created_by_fkey;

-- Change column type to BIGINT (Integer) to match local users table
-- If data exists and can't convert, we set to NULL temporarily
ALTER TABLE public.teams ALTER COLUMN created_by TYPE bigint USING created_by::bigint;

-- Re-link it to public.users (Local users table, not auth.users)
ALTER TABLE public.teams ADD CONSTRAINT teams_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Enable RLS for teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage teams" ON public.teams;
CREATE POLICY "Authenticated users can manage teams"
ON public.teams
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert teams" ON public.teams;
CREATE POLICY "Authenticated users can insert teams"
ON public.teams
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');


-- ==========================================
-- PART 2: FIX USERS TABLE (Enable Read Access)
-- ==========================================
-- Problem: "permission denied for table users" (42501)
-- Solution: Enable RLS and allow authenticated users to read

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.users;
CREATE POLICY "Enable read access for authenticated users"
ON public.users
FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING (auth.uid()::text = id::text OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));


-- ==========================================
-- PART 3: FIX COMMUNITY_POSTS TABLE (Enable Posting)
-- ==========================================
-- Problem: Cannot insert/read posts
-- Solution: Enable RLS with proper policies

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert posts" ON public.community_posts;
CREATE POLICY "Authenticated users can insert posts"
ON public.community_posts
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can view posts" ON public.community_posts;
CREATE POLICY "Authenticated users can view posts"
ON public.community_posts
FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own posts" ON public.community_posts;
CREATE POLICY "Users can delete own posts"
ON public.community_posts
FOR DELETE
USING (user_id = (SELECT id::text FROM public.users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())));


-- ==========================================
-- PART 4: FIX REVIEWS TABLE
-- ==========================================
-- Problem: Missing 'is_approved' column (PGRST204)

-- Add is_approved column
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- Ensure feedback column exists
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS feedback TEXT;

-- Add user_id if not exists (as TEXT to match Supabase UUID from auth)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reviews' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.reviews ADD COLUMN user_id TEXT;
        RAISE NOTICE '✅ reviews.user_id added as TEXT';
    END IF;
END $$;

-- Enable RLS for reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;
CREATE POLICY "Authenticated users can insert reviews"
ON public.reviews
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can view reviews" ON public.reviews;
CREATE POLICY "Authenticated users can view reviews"
ON public.reviews
FOR SELECT
USING (auth.role() = 'authenticated');


-- ==========================================
-- PART 3: FIX SCANS TABLE
-- ==========================================
-- Problem: "null value in column updated_at violates not-null constraint"

ALTER TABLE public.scans ALTER COLUMN updated_at DROP NOT NULL;
ALTER TABLE public.scans ALTER COLUMN updated_at SET DEFAULT now();

-- Add missing columns
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS file_type VARCHAR(50);

-- Update existing NULL data
UPDATE public.scans SET file_size = 0 WHERE file_size IS NULL;
UPDATE public.scans SET file_type = 'image/jpeg' WHERE file_type IS NULL;


-- ==========================================
-- PART 4: FIX INVOICES TABLE
-- ==========================================
-- Problem: "column invoices.issue_date does not exist"

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_address TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS items TEXT; -- JSON String
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal FLOAT DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax FLOAT DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total FLOAT DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS issue_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Izinkan NULL untuk updated_at
ALTER TABLE public.invoices ALTER COLUMN updated_at DROP NOT NULL;


-- ==========================================
-- PART 5: ENABLE RLS FOR INVOICES
-- ==========================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User can manage own invoices" ON public.invoices;
CREATE POLICY "User can manage own invoices"
ON public.invoices
USING (
    auth.uid()::text = user_id::text 
    OR user_id::text = (
        SELECT id::text FROM public.users 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
);


-- ==========================================
-- PART 6: VERIFICATION
-- ==========================================
SELECT 
    'teams' AS table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'teams' AND column_name = 'created_by'
UNION ALL
SELECT 
    'reviews' AS table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'reviews' AND column_name IN ('user_id', 'feedback', 'is_approved')
UNION ALL
SELECT 
    'scans' AS table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'scans' AND column_name IN ('updated_at', 'file_size', 'file_type')
UNION ALL
SELECT 
    'invoices' AS table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoices' AND column_name IN ('issue_date', 'invoice_number', 'status')
ORDER BY table_name, column_name;

-- ✅ Script selesai! Cek hasil query di atas untuk verifikasi.


