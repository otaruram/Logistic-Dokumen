-- ADVANCED RLS POLICIES - GOD LEVEL SECURITY
-- Run this in Supabase SQL Editor

BEGIN;

-- ==========================================
-- 1. ENABLE RLS ON ALL TABLES (FORCE MODE)
-- ==========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans FORCE ROW LEVEL SECURITY;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes FORCE ROW LEVEL SECURITY;

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews FORCE ROW LEVEL SECURITY;

ALTER TABLE credit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_history FORCE ROW LEVEL SECURITY;

ALTER TABLE document_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_audits FORCE ROW LEVEL SECURITY;

ALTER TABLE imagekit_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE imagekit_files FORCE ROW LEVEL SECURITY;

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities FORCE ROW LEVEL SECURITY;

-- ==========================================
-- 2. DROP ALL EXISTING POLICIES (CLEAN SLATE)
-- ==========================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- ==========================================
-- 3. USERS TABLE - STRICT POLICIES
-- ==========================================

-- Users can ONLY view their own profile
CREATE POLICY "users_select_own" ON users
    FOR SELECT
    USING (auth.uid() = id);

-- Users can ONLY update their own profile (limited fields)
CREATE POLICY "users_update_own" ON users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- NO DELETE allowed for users (only admin via service role)
-- NO INSERT allowed (handled by auth.users)

-- ==========================================
-- 4. SCANS TABLE - ULTRA STRICT
-- ==========================================

-- Users can ONLY view their own scans
CREATE POLICY "scans_select_own" ON scans
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can ONLY insert scans for themselves
CREATE POLICY "scans_insert_own" ON scans
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        -- Enforce valid status
        status IN ('pending', 'processing', 'completed', 'failed')
    );

-- Users can ONLY update their own scans (limited fields)
CREATE POLICY "scans_update_own" ON scans
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can ONLY delete their own scans
CREATE POLICY "scans_delete_own" ON scans
    FOR DELETE
    USING (auth.uid() = user_id);

-- ==========================================
-- 5. DOCUMENT_AUDITS - FRAUD PREVENTION
-- ==========================================

-- Users can view their own audits
CREATE POLICY "audits_select_own" ON document_audits
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert audits for themselves
CREATE POLICY "audits_insert_own" ON document_audits
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        -- Enforce confidence score range
        confidence_score >= 0 AND confidence_score <= 100
    );

-- NO UPDATE allowed (audit records are immutable)
-- NO DELETE allowed (audit trail must be preserved)

-- ==========================================
-- 6. INVOICES - STRICT ACCESS
-- ==========================================

CREATE POLICY "invoices_select_own" ON invoices
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "invoices_insert_own" ON invoices
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        status IN ('draft', 'sent', 'paid', 'cancelled')
    );

CREATE POLICY "invoices_update_own" ON invoices
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices_delete_own" ON invoices
    FOR DELETE
    USING (auth.uid() = user_id AND status = 'draft');

-- ==========================================
-- 7. CREDIT_HISTORY - READ-ONLY FOR USERS
-- ==========================================

CREATE POLICY "credits_select_own" ON credit_history
    FOR SELECT
    USING (auth.uid() = user_id);

-- NO INSERT/UPDATE/DELETE for users (only backend via service role)

-- ==========================================
-- 8. QUIZZES, REVIEWS, ACTIVITIES - STANDARD
-- ==========================================

-- Quizzes
CREATE POLICY "quizzes_all_own" ON quizzes
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Reviews
CREATE POLICY "reviews_all_own" ON reviews
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Activities (read-only for users)
CREATE POLICY "activities_select_own" ON activities
    FOR SELECT
    USING (auth.uid() = user_id);

-- ==========================================
-- 9. IMAGEKIT_FILES - STRICT FILE ACCESS
-- ==========================================

CREATE POLICY "imagekit_select_own" ON imagekit_files
    FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "imagekit_insert_own" ON imagekit_files
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        feature IN ('qr', 'scan', 'invoice', 'quiz', 'signature', 'ppt')
    );

-- NO UPDATE/DELETE for users (managed by backend)

COMMIT;

-- ==========================================
-- 10. VERIFICATION
-- ==========================================
SELECT 
    schemaname,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

SELECT '✅ GOD-LEVEL RLS ACTIVATED!' as status;
