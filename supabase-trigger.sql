-- Script untuk auto-populate tabel users dari auth.users
-- Jalankan di Supabase SQL Editor

-- ==========================================
-- STEP 0: Check current schema
-- ==========================================

SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'scans', 'invoices', 'scan_records')
  AND column_name LIKE '%id%'
ORDER BY table_name, ordinal_position;

-- ==========================================
-- STEP 1: Fix users.id to be UUID (compatible with auth.users.id)
-- ==========================================

BEGIN;

-- DROP POLICIES FIRST (Cannot alter columns used in policies)
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
-- Also drop policies on other tables if they exist to be safe
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['scans', 'invoices', 'quizzes', 'reviews', 'credit_history', 'document_audits', 'imagekit_files', 'activities']
    LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
           EXECUTE format('DROP POLICY IF EXISTS "Users can view own %I" ON %I', t, t);
           EXECUTE format('DROP POLICY IF EXISTS "Users can insert own %I" ON %I', t, t);
           EXECUTE format('DROP POLICY IF EXISTS "Users can update own %I" ON %I', t, t);
           EXECUTE format('DROP POLICY IF EXISTS "Users can delete own %I" ON %I', t, t);
        END IF;
    END LOOP;
END $$;

-- Drop all foreign keys that reference users.id
ALTER TABLE IF EXISTS scans DROP CONSTRAINT IF EXISTS scans_user_id_fkey;
ALTER TABLE IF EXISTS invoices DROP CONSTRAINT IF EXISTS invoices_user_id_fkey;

-- Fix missing columns in scans table (Schema Mismatch Fix)
ALTER TABLE IF EXISTS scans ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE IF EXISTS scans ADD COLUMN IF NOT EXISTS file_type VARCHAR(50);
ALTER TABLE IF EXISTS scans ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255);
ALTER TABLE IF EXISTS scans ADD COLUMN IF NOT EXISTS signature_url VARCHAR(500);
ALTER TABLE IF EXISTS scans ADD COLUMN IF NOT EXISTS imagekit_url VARCHAR(500);
ALTER TABLE IF EXISTS scans ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE IF EXISTS scans ADD COLUMN IF NOT EXISTS processing_time FLOAT;
ALTER TABLE IF EXISTS scans ADD COLUMN IF NOT EXISTS confidence_score FLOAT;
ALTER TABLE IF EXISTS scans ADD COLUMN IF NOT EXISTS extracted_text TEXT;
ALTER TABLE IF EXISTS scans ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';

-- Fix updated_at default value for scans
ALTER TABLE IF EXISTS scans ALTER COLUMN updated_at SET DEFAULT NOW();

-- Create REVIEWS table (Required for feedback)
CREATE TABLE IF NOT EXISTS reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user_name VARCHAR(100),
    user_email VARCHAR(255),
    rating INTEGER,
    feedback TEXT,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure reviews.id has default (in case table existed)
ALTER TABLE reviews ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Create ACTIVITIES table (Required for logs)
CREATE TABLE IF NOT EXISTS activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    feature VARCHAR(50),
    action VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure activities.id has default (in case table existed)
ALTER TABLE activities ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE IF EXISTS scan_records DROP CONSTRAINT IF EXISTS scan_records_scan_id_fkey;
ALTER TABLE IF EXISTS quizzes DROP CONSTRAINT IF EXISTS quizzes_user_id_fkey;
ALTER TABLE IF EXISTS reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
ALTER TABLE IF EXISTS credit_history DROP CONSTRAINT IF EXISTS credit_history_user_id_fkey;
ALTER TABLE IF EXISTS activities DROP CONSTRAINT IF EXISTS activities_user_id_fkey;

ALTER TABLE IF EXISTS document_audits DROP CONSTRAINT IF EXISTS document_audits_user_id_fkey;
ALTER TABLE IF EXISTS imagekit_files DROP CONSTRAINT IF EXISTS imagekit_files_user_id_fkey;

-- Drop existing sequence if users.id was serial/bigserial
DROP SEQUENCE IF EXISTS users_id_seq CASCADE;

-- TRUNCATE ALL DATA SAFELY (Only if table exists)
DO $$
DECLARE
    t text;
BEGIN
    -- List of all potential tables to clear
    FOREACH t IN ARRAY ARRAY['scan_records', 'scans', 'invoices', 'quizzes', 'reviews', 'credit_history', 'activities', 'document_audits', 'imagekit_files']
    LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('TRUNCATE TABLE %I CASCADE', t);
        END IF;
    END LOOP;
    
    -- Finally truncate users
    TRUNCATE TABLE users CASCADE;
END $$;

-- Make hashed_password nullable (Auth handled by Supabase)
ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;

ALTER TABLE users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE users ALTER COLUMN id TYPE uuid USING gen_random_uuid();
ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Convert dependent tables user_id to UUID
ALTER TABLE IF EXISTS scans ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE IF EXISTS scans ALTER COLUMN user_id TYPE uuid USING gen_random_uuid();

ALTER TABLE IF EXISTS invoices ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE IF EXISTS invoices ALTER COLUMN user_id TYPE uuid USING gen_random_uuid();

ALTER TABLE IF EXISTS quizzes ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE IF EXISTS quizzes ALTER COLUMN user_id TYPE uuid USING gen_random_uuid();

ALTER TABLE IF EXISTS reviews ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE IF EXISTS reviews ALTER COLUMN user_id TYPE uuid USING gen_random_uuid();

ALTER TABLE IF EXISTS credit_history ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE IF EXISTS credit_history ALTER COLUMN user_id TYPE uuid USING gen_random_uuid();

ALTER TABLE IF EXISTS activities ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE IF EXISTS activities ALTER COLUMN user_id TYPE uuid USING gen_random_uuid();

ALTER TABLE IF EXISTS document_audits ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE IF EXISTS document_audits ALTER COLUMN user_id TYPE uuid USING gen_random_uuid();

ALTER TABLE IF EXISTS imagekit_files ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE IF EXISTS imagekit_files ALTER COLUMN user_id TYPE uuid USING gen_random_uuid();

-- Recreate FK constraints with correct UUID types
ALTER TABLE IF EXISTS scans 
  ADD CONSTRAINT scans_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS invoices 
  ADD CONSTRAINT invoices_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS scan_records 
  ADD CONSTRAINT scan_records_scan_id_fkey 
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS quizzes 
  ADD CONSTRAINT quizzes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS reviews 
  ADD CONSTRAINT reviews_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS credit_history 
  ADD CONSTRAINT credit_history_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS document_audits 
  ADD CONSTRAINT document_audits_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS imagekit_files 
  ADD CONSTRAINT imagekit_files_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Activities usually don't have FK in some schemas, but let's be safe if it exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'activities') THEN
        ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_user_id_fkey;
    END IF;
END $$;

COMMIT;

-- ==========================================
-- STEP 1.5: ENABLE RLS (Row Level Security)
-- ==========================================

-- Helper function for RLS
CREATE OR REPLACE FUNCTION public.is_owner(uid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN auth.uid() = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS credit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS document_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS imagekit_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activities ENABLE ROW LEVEL SECURITY;

-- Creating generic policy generator
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['scans', 'invoices', 'quizzes', 'reviews', 'credit_history', 'document_audits', 'imagekit_files', 'activities']
    LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('DROP POLICY IF EXISTS "Users can view own %I" ON %I', t, t);
            EXECUTE format('CREATE POLICY "Users can view own %I" ON %I FOR SELECT USING (auth.uid() = user_id)', t, t);
            
            EXECUTE format('DROP POLICY IF EXISTS "Users can insert own %I" ON %I', t, t);
            EXECUTE format('CREATE POLICY "Users can insert own %I" ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)', t, t);
            
            EXECUTE format('DROP POLICY IF EXISTS "Users can update own %I" ON %I', t, t);
            EXECUTE format('CREATE POLICY "Users can update own %I" ON %I FOR UPDATE USING (auth.uid() = user_id)', t, t);
            
            EXECUTE format('DROP POLICY IF EXISTS "Users can delete own %I" ON %I', t, t);
            EXECUTE format('CREATE POLICY "Users can delete own %I" ON %I FOR DELETE USING (auth.uid() = user_id)', t, t);
        END IF;
    END LOOP;
END $$;

-- Public User Profile Policy
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- ==========================================
-- STEP 2: Create trigger function
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, username, credits, is_active, updated_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
    10, 
    true,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- STEP 3: Create trigger
-- ==========================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- STEP 4: Populate existing auth users
-- ==========================================

INSERT INTO public.users (id, email, username, credits, is_active, updated_at)
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'full_name', -- Simplified to match pattern, or keep COALESCE if preferred
  10 AS credits,
  true AS is_active,
  NOW() AS updated_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- STEP 5: Verify results
-- ==========================================

SELECT 'Migration completed successfully!' AS status;
SELECT 'Total users synced:' AS info, COUNT(*) AS count FROM public.users;
SELECT 'Auth users:' AS info, COUNT(*) AS count FROM auth.users;

-- Verify column types are now correct
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'scans', 'invoices')
  AND column_name IN ('id', 'user_id')
ORDER BY table_name, ordinal_position;
