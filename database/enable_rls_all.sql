-- ============================================================
-- RLS (Row Level Security) — Enable on ALL tables
-- Run this in Supabase SQL Editor
-- ============================================================
-- NOTE: Backend uses supabase_admin (service_role key) which
-- automatically bypasses RLS. These policies protect the
-- frontend Supabase client (anon/authenticated) only.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. DOCUMENTS (currently UNRESTRICTED)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
CREATE POLICY "Users can update own documents"
  ON public.documents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 2. EXTRACTED_FINANCE_DATA (currently UNRESTRICTED)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.extracted_finance_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_finance_data FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own finance data" ON public.extracted_finance_data;
CREATE POLICY "Users can view own finance data"
  ON public.extracted_finance_data FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own finance data" ON public.extracted_finance_data;
CREATE POLICY "Users can insert own finance data"
  ON public.extracted_finance_data FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own finance data" ON public.extracted_finance_data;
CREATE POLICY "Users can delete own finance data"
  ON public.extracted_finance_data FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 3. PROFILES (currently UNRESTRICTED)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ──────────────────────────────────────────────────────────────
-- 4. FRAUD_SCANS (no RLS)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.fraud_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_scans FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own fraud scans" ON public.fraud_scans;
CREATE POLICY "Users can view own fraud scans"
  ON public.fraud_scans FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own fraud scans" ON public.fraud_scans;
CREATE POLICY "Users can insert own fraud scans"
  ON public.fraud_scans FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own fraud scans" ON public.fraud_scans;
CREATE POLICY "Users can delete own fraud scans"
  ON public.fraud_scans FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 5. ACTIVITIES (no RLS)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own activities" ON public.activities;
CREATE POLICY "Users can view own activities"
  ON public.activities FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own activities" ON public.activities;
CREATE POLICY "Users can insert own activities"
  ON public.activities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 6. DOCUMENT_AUDITS (no RLS)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.document_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_audits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own audits" ON public.document_audits;
CREATE POLICY "Users can view own audits"
  ON public.document_audits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own audits" ON public.document_audits;
CREATE POLICY "Users can insert own audits"
  ON public.document_audits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 7. INVOICES (no RLS)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own invoices" ON public.invoices;
CREATE POLICY "Users can insert own invoices"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own invoices" ON public.invoices;
CREATE POLICY "Users can update own invoices"
  ON public.invoices FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own invoices" ON public.invoices;
CREATE POLICY "Users can delete own invoices"
  ON public.invoices FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 8. REVIEWS (no RLS)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reviews" ON public.reviews;
CREATE POLICY "Users can view own reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own reviews" ON public.reviews;
CREATE POLICY "Users can insert own reviews"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
CREATE POLICY "Users can update own reviews"
  ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 9. SCANS (no RLS)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own scans" ON public.scans;
CREATE POLICY "Users can view own scans"
  ON public.scans FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own scans" ON public.scans;
CREATE POLICY "Users can insert own scans"
  ON public.scans FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own scans" ON public.scans;
CREATE POLICY "Users can delete own scans"
  ON public.scans FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 10. IMAGEKIT_FILES (already has RLS, add policies if missing)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.imagekit_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own imagekit files" ON public.imagekit_files;
CREATE POLICY "Users can view own imagekit files"
  ON public.imagekit_files FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own imagekit files" ON public.imagekit_files;
CREATE POLICY "Users can insert own imagekit files"
  ON public.imagekit_files FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own imagekit files" ON public.imagekit_files;
CREATE POLICY "Users can delete own imagekit files"
  ON public.imagekit_files FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 11. CREDIT_HISTORY (already has RLS, ensure policies)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.credit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credit history" ON public.credit_history;
CREATE POLICY "Users can view own credit history"
  ON public.credit_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 12. PPT_HISTORY (already has RLS, ensure policies)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.ppt_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ppt history" ON public.ppt_history;
CREATE POLICY "Users can view own ppt history"
  ON public.ppt_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own ppt history" ON public.ppt_history;
CREATE POLICY "Users can insert own ppt history"
  ON public.ppt_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own ppt history" ON public.ppt_history;
CREATE POLICY "Users can delete own ppt history"
  ON public.ppt_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 13. QUIZZES (already has RLS, ensure policies)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quizzes" ON public.quizzes;
CREATE POLICY "Users can view own quizzes"
  ON public.quizzes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own quizzes" ON public.quizzes;
CREATE POLICY "Users can insert own quizzes"
  ON public.quizzes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- DONE — All 13 tables now have RLS enabled with user-scoped
-- policies. Backend (service_role) bypasses RLS automatically.
-- ──────────────────────────────────────────────────────────────
