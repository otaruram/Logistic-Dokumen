-- DROP POLICIES SCRIPT
-- Run this BEFORE running 'npx prisma db push'

BEGIN;

-- Drop policies on all tables
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['scans', 'invoices', 'quizzes', 'reviews', 'credit_history', 'document_audits', 'imagekit_files', 'activities', 'users']
    LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
           EXECUTE format('DROP POLICY IF EXISTS "Users can view own %I" ON %I', t, t);
           EXECUTE format('DROP POLICY IF EXISTS "Users can insert own %I" ON %I', t, t);
           EXECUTE format('DROP POLICY IF EXISTS "Users can update own %I" ON %I', t, t);
           EXECUTE format('DROP POLICY IF EXISTS "Users can delete own %I" ON %I', t, t);
        END IF;
    END LOOP;
END $$;

-- Drop generic user policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

COMMIT;

SELECT 'All RLS policies dropped. You can now run prisma db push.' as status;
