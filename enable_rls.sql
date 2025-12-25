-- ENABLE RLS SCRIPT
-- Run this AFTER running 'npx prisma db push'

BEGIN;

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

COMMIT;

SELECT 'RLS Policies restored successfully!' as status;
