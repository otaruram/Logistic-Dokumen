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

-- Drop all foreign keys that reference users.id
ALTER TABLE IF EXISTS scans DROP CONSTRAINT IF EXISTS scans_user_id_fkey;
ALTER TABLE IF EXISTS invoices DROP CONSTRAINT IF EXISTS invoices_user_id_fkey;
ALTER TABLE IF EXISTS scan_records DROP CONSTRAINT IF EXISTS scan_records_scan_id_fkey;

-- Drop existing sequence if users.id was serial/bigserial
DROP SEQUENCE IF EXISTS users_id_seq CASCADE;

-- Convert users.id from INTEGER to UUID
-- WARNING: This will delete all existing users data!
TRUNCATE TABLE users CASCADE;

ALTER TABLE users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE users ALTER COLUMN id TYPE uuid USING gen_random_uuid();
ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Convert scans.user_id to UUID
ALTER TABLE scans ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE scans ALTER COLUMN user_id TYPE uuid USING gen_random_uuid();

-- Convert invoices.user_id to UUID  
ALTER TABLE invoices ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE invoices ALTER COLUMN user_id TYPE uuid USING gen_random_uuid();

-- Recreate FK constraints with correct UUID types
ALTER TABLE scans 
  ADD CONSTRAINT scans_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE invoices 
  ADD CONSTRAINT invoices_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE scan_records 
  ADD CONSTRAINT scan_records_scan_id_fkey 
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE;

COMMIT;

-- ==========================================
-- STEP 2: Create trigger function
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, username, credits, is_active)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
    5, 
    true
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

INSERT INTO public.users (id, email, username, credits, is_active)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email) AS username,
  5 AS credits,
  true AS is_active
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
