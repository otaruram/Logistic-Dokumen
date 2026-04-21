-- ==========================================
-- 1. TABEL UTAMA UNTUK METADATA & HASIL OCR
-- ==========================================

-- Menggunakan IF NOT EXISTS memastikan tabel tidak akan ditimpa jika sudah ada,
-- sehingga data lama Anda tetap aman 100%.
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'verified', 'tampered')),
    doc_hash TEXT, -- Hash file dokumen untuk deteksi manipulasi
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ekstraksi OCR. IF NOT EXISTS menjaga data aman.
CREATE TABLE IF NOT EXISTS public.extracted_finance_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_name TEXT NOT NULL,
    transaction_date DATE NOT NULL,
    nominal_amount NUMERIC NOT NULL CHECK (nominal_amount >= 0),
    data_hash TEXT, -- Cryptographic binding (Digital Signature) mencegah fraud pada DB
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. INDEXING (OPTIMASI PENCARIAN & QUERY)
-- ==========================================
-- IF NOT EXISTS memastikan tidak error saat index sudah ada.
CREATE INDEX IF NOT EXISTS idx_finance_data_date ON public.extracted_finance_data(transaction_date);
CREATE INDEX IF NOT EXISTS idx_finance_data_vendor ON public.extracted_finance_data(vendor_name);
CREATE INDEX IF NOT EXISTS idx_finance_data_user_date ON public.extracted_finance_data(user_id, transaction_date);


-- ==========================================
-- 3. FUNGSI WEIGHTED SCORING (Logistics Trust Score)
-- ==========================================
-- CREATE OR REPLACE FUNCTION hanya memperbarui logika fungsinya saja,
-- sama sekali tidak menyentuh atau menghapus data di dalam tabel.

CREATE OR REPLACE FUNCTION public.calculate_logistics_trust_score(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_total_nominal NUMERIC := 0;
    v_trx_count INTEGER := 0;
    v_unique_clients INTEGER := 0;
    v_months_active NUMERIC := 1;
    v_score_nominal INTEGER := 0;
    v_score_freq INTEGER := 0;
    v_score_stability INTEGER := 0;
    v_total_score INTEGER := 0;
BEGIN
    SELECT 
        COALESCE(SUM(nominal_amount), 0),
        COUNT(id),
        COUNT(DISTINCT vendor_name),
        GREATEST(
            EXTRACT(YEAR FROM age(MAX(transaction_date), MIN(transaction_date))) * 12 + 
            EXTRACT(MONTH FROM age(MAX(transaction_date), MIN(transaction_date))) + 1, 
        1)
    INTO 
        v_total_nominal, v_trx_count, v_unique_clients, v_months_active
    FROM public.extracted_finance_data
    WHERE user_id = p_user_id;

    IF v_trx_count = 0 THEN
        RETURN 0;
    END IF;

    v_score_nominal := LEAST((v_total_nominal / 1000000000.0) * 500, 500)::INTEGER;
    v_score_freq := LEAST(((v_trx_count::NUMERIC / v_months_active) / 20.0) * 300, 300)::INTEGER;

    IF v_unique_clients > 0 THEN
        v_score_stability := LEAST(((v_trx_count::NUMERIC / v_unique_clients) / 5.0) * 200, 200)::INTEGER;
    END IF;

    v_total_score := v_score_nominal + v_score_freq + v_score_stability;
    RETURN v_total_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_finance_data ENABLE ROW LEVEL SECURITY;

-- 4.a Kebijakan untuk UMKM (Pemilik Data)
-- Menghapus policy jika sudah ada agar tidak error saat di-run ulang,
-- tidak akan menghapus data tabel sama sekali.
DROP POLICY IF EXISTS "UMKM can view their own documents" ON public.documents;
CREATE POLICY "UMKM can view their own documents"
ON public.documents FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "UMKM can insert their own documents" ON public.documents;
CREATE POLICY "UMKM can insert their own documents"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "UMKM can view their own extracted data" ON public.extracted_finance_data;
CREATE POLICY "UMKM can view their own extracted data"
ON public.extracted_finance_data FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "UMKM can insert their own extracted data" ON public.extracted_finance_data;
CREATE POLICY "UMKM can insert their own extracted data"
ON public.extracted_finance_data FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4.b Kebijakan untuk Perbankan/Lender
DROP POLICY IF EXISTS "Lenders can view verified extracted data for scoring" ON public.extracted_finance_data;
CREATE POLICY "Lenders can view verified extracted data for scoring"
ON public.extracted_finance_data FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'lender'
);


-- ==========================================
-- 5. TELEGRAM LINKAGE (NIK + PERMANENT KEY)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.telegram_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
        tele_key TEXT NOT NULL UNIQUE,
        nik_hash TEXT NOT NULL,
        nik_last4 TEXT NOT NULL,
        is_linked BOOLEAN NOT NULL DEFAULT FALSE,
        telegram_chat_id TEXT,
        telegram_user_id TEXT,
        telegram_username TEXT,
        linked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_links_user_id ON public.telegram_links(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_links_chat_id ON public.telegram_links(telegram_chat_id);

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own telegram link" ON public.telegram_links;
CREATE POLICY "Users can view own telegram link"
ON public.telegram_links FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own telegram link" ON public.telegram_links;
CREATE POLICY "Users can insert own telegram link"
ON public.telegram_links FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own telegram link" ON public.telegram_links;
CREATE POLICY "Users can update own telegram link"
ON public.telegram_links FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 6. FRAUD_SCANS — Universal Invoice Fields
--    Migration: add new columns if not exist
-- ==========================================

ALTER TABLE public.fraud_scans
    ADD COLUMN IF NOT EXISTS doc_type         TEXT,
    ADD COLUMN IF NOT EXISTS nomor_dokumen    TEXT,
    ADD COLUMN IF NOT EXISTS tanggal_terbit   DATE,
    ADD COLUMN IF NOT EXISTS nama_penjual     TEXT,
    ADD COLUMN IF NOT EXISTS nominal_subtotal NUMERIC,
    ADD COLUMN IF NOT EXISTS nominal_ppn      NUMERIC,
    ADD COLUMN IF NOT EXISTS metode_bayar     TEXT,
    ADD COLUMN IF NOT EXISTS terminal_id      TEXT,
    ADD COLUMN IF NOT EXISTS no_referensi     TEXT;

-- also populate nomor_dokumen from nomor_surat_jalan for existing rows
UPDATE public.fraud_scans
    SET nomor_dokumen = nomor_surat_jalan
    WHERE nomor_dokumen IS NULL AND nomor_surat_jalan IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fraud_scans_doc_type     ON public.fraud_scans(doc_type);
CREATE INDEX IF NOT EXISTS idx_fraud_scans_nomor_dok    ON public.fraud_scans(nomor_dokumen);

-- ==========================================
-- 7. TELEGRAM_LINKS — Make nik_hash / nik_last4 nullable
--    (NIK auth removed, key auto-generated from OAuth identity)
-- ==========================================
ALTER TABLE public.telegram_links
    ALTER COLUMN nik_hash  DROP NOT NULL,
    ALTER COLUMN nik_last4 DROP NOT NULL;

-- ==========================================
-- 8. PROFILES — Add user_email for partner lookup
-- ==========================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email
    ON public.profiles(user_email) WHERE user_email IS NOT NULL;

-- ==========================================
-- 9. DOCUMENTS — Additional fraud-detection columns
-- ==========================================
ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS file_hash   TEXT,
    ADD COLUMN IF NOT EXISTS is_physical BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS spoof_reason TEXT;

-- ==========================================
-- 10. API_KEYS — For Partner / B2B Access
-- ==========================================
CREATE TABLE IF NOT EXISTS public.api_keys (
    id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_value    TEXT     NOT NULL UNIQUE,
    name         TEXT     NOT NULL DEFAULT 'Default Key',
    is_active    BOOLEAN  NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_value   ON public.api_keys(key_value);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own api keys" ON public.api_keys;
CREATE POLICY "Users manage own api keys"
ON public.api_keys FOR ALL TO authenticated
USING  (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
