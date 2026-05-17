-- =============================================================================
-- Otaru Financial Bot — Full Migration
-- Jalankan sekali di Supabase SQL Editor
-- =============================================================================

-- 1. Profil keuangan personal (manual input dari finance bot)
CREATE TABLE IF NOT EXISTS personal_finance_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Manual input fields
    gaji_bulanan    BIGINT DEFAULT 0,            -- IDR
    tanggungan      INT DEFAULT 0,               -- jumlah orang
    pengeluaran_rutin BIGINT DEFAULT 0,          -- IDR/bulan
    pekerjaan       TEXT,
    nama_perusahaan TEXT,
    -- OCR-verified overrides (lebih tinggi bobot-nya)
    gaji_verified   BIGINT,                      -- dari slip gaji OCR
    verified_at     TIMESTAMPTZ,
    verified_source TEXT,                        -- 'slip_gaji' | 'struk_belanja'
    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id)
);

-- 2. Upload personal: slip gaji & struk belanja
CREATE TABLE IF NOT EXISTS personal_finance_docs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    doc_type        TEXT NOT NULL CHECK (doc_type IN ('slip_gaji', 'struk_belanja', 'unknown')),
    storage_path    TEXT,                        -- path di Supabase Storage / ImageKit
    ocr_raw         JSONB DEFAULT '{}',
    extracted_nominal BIGINT,                   -- nominal utama yg diekstrak
    confidence      TEXT DEFAULT 'low' CHECK (confidence IN ('high', 'medium', 'low')),
    ai_indicator    TEXT DEFAULT 'CLEAN' CHECK (ai_indicator IN ('CLEAN', 'TAMPERED', 'SUSPICIOUS')),
    uploaded_via    TEXT DEFAULT 'telegram',     -- 'telegram' | 'web'
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 3. Riwayat cicilan / hutang aktif (manual entry dari bot)
CREATE TABLE IF NOT EXISTS active_installments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nama_pinjaman   TEXT NOT NULL,               -- e.g. "KPR BRI", "Cicilan HP"
    cicilan_bulanan BIGINT NOT NULL,             -- IDR/bulan
    sisa_tenor      INT DEFAULT 0,               -- bulan
    lembaga         TEXT,                        -- nama bank/fintech
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'lunas')),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 4. Histori skor (snapshot per kalkulasi)
CREATE TABLE IF NOT EXISTS otaru_score_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    otaru_index     INT NOT NULL,
    credit_grade    TEXT NOT NULL,
    dsr_percent     NUMERIC(5,2),
    integrity_score INT,
    dsr_score       INT,
    consistency_score INT,
    snapshot_at     TIMESTAMPTZ DEFAULT now()
);

-- 5. Partner API keys (scoped)
CREATE TABLE IF NOT EXISTS partner_api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_name    TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    api_key_hash    TEXT NOT NULL UNIQUE,       -- SHA-256 hash dari raw key
    plan            TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'enterprise')),
    rate_limit_per_day INT DEFAULT 50,          -- starter=50, growth=unlimited(-1), enterprise=custom
    scopes          TEXT[] DEFAULT ARRAY['credit_score'],  -- 'credit_score','kyc','family'
    is_active       BOOLEAN DEFAULT TRUE,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 6. Partner API usage log
CREATE TABLE IF NOT EXISTS partner_api_usage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id      UUID REFERENCES partner_api_keys(id) ON DELETE CASCADE,
    endpoint        TEXT NOT NULL,
    target_user_id  UUID,
    response_code   INT,
    requested_at    TIMESTAMPTZ DEFAULT now()
);

-- 7. Family sharing (sudah ada, pastikan exist)
CREATE TABLE IF NOT EXISTS family_sharing_invites (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_contact     TEXT NOT NULL,
    permission          TEXT DEFAULT 'view_only',
    invite_token_hash   TEXT NOT NULL UNIQUE,
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
    expires_at          TIMESTAMPTZ NOT NULL,
    accepted_user_id    UUID REFERENCES auth.users(id),
    accepted_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_sharing_access (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    viewer_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission      TEXT DEFAULT 'view_only',
    status          TEXT DEFAULT 'active' CHECK (status IN ('active','revoked')),
    accepted_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE (owner_user_id, viewer_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pfp_user ON personal_finance_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_pfd_user ON personal_finance_docs(user_id);
CREATE INDEX IF NOT EXISTS idx_pfd_type ON personal_finance_docs(doc_type);
CREATE INDEX IF NOT EXISTS idx_ai_user ON active_installments(user_id);
CREATE INDEX IF NOT EXISTS idx_osh_user ON otaru_score_history(user_id);
CREATE INDEX IF NOT EXISTS idx_pak_hash ON partner_api_keys(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_pau_key ON partner_api_usage(api_key_id);

-- RLS: semua tabel protected
ALTER TABLE personal_finance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_finance_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE otaru_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_sharing_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_sharing_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies (user hanya bisa akses data sendiri)
DROP POLICY IF EXISTS "user own pfp" ON personal_finance_profiles;
CREATE POLICY "user own pfp" ON personal_finance_profiles
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user own pfd" ON personal_finance_docs;
CREATE POLICY "user own pfd" ON personal_finance_docs
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user own ai" ON active_installments;
CREATE POLICY "user own ai" ON active_installments
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user own osh" ON otaru_score_history;
CREATE POLICY "user own osh" ON otaru_score_history
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "family owner" ON family_sharing_invites;
CREATE POLICY "family owner" ON family_sharing_invites
    FOR ALL USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "family viewer read" ON family_sharing_access;
CREATE POLICY "family viewer read" ON family_sharing_access
    FOR SELECT USING (auth.uid() = owner_user_id OR auth.uid() = viewer_user_id);

DROP POLICY IF EXISTS "family owner manage" ON family_sharing_access;
CREATE POLICY "family owner manage" ON family_sharing_access
    FOR ALL USING (auth.uid() = owner_user_id);

-- partner_api_keys & usage: service_role only (backend bypass RLS)
DROP POLICY IF EXISTS "service only pak" ON partner_api_keys;
CREATE POLICY "service only pak" ON partner_api_keys
    FOR ALL USING (FALSE);

DROP POLICY IF EXISTS "service only pau" ON partner_api_usage;
CREATE POLICY "service only pau" ON partner_api_usage
    FOR ALL USING (FALSE);
