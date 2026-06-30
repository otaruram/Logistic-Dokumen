-- ============================================================
-- OtaruChain — Supabase PostgreSQL Schema
-- DIGDAYA x Hackathon 3rd Submission
-- ============================================================
-- Run this in Supabase SQL Editor to create all tables.
-- ============================================================


-- ============================================================
-- 1. Worker Profiles (HR/Koperasi data)
-- ============================================================
-- Stores verified employee data synced from HR/Koperasi systems.
-- The phone_number is the primary lookup key for the Decision API.

CREATE TABLE IF NOT EXISTS worker_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number    VARCHAR(20) UNIQUE NOT NULL,   -- E.164 format (+62XXXXXXXXXX)
    full_name       VARCHAR(255) NOT NULL,
    nik             VARCHAR(16) UNIQUE,             -- National ID (KTP number)
    company_name    VARCHAR(255),                   -- e.g., "PT Maju Bersama Manufacturing"
    department      VARCHAR(100),                   -- e.g., "Produksi", "QC", "Gudang"
    position        VARCHAR(100),                   -- e.g., "Operator Mesin"
    verified_income DECIMAL(15,2) NOT NULL,         -- Monthly take-home pay in IDR
    join_date       DATE NOT NULL,                  -- Koperasi membership start date
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE worker_profiles IS 'Verified worker profiles from HR/Koperasi systems. Phone number is primary lookup key.';
COMMENT ON COLUMN worker_profiles.verified_income IS 'Monthly take-home pay in IDR, verified by HR department.';
COMMENT ON COLUMN worker_profiles.join_date IS 'Date worker joined the Koperasi — used for tenure calculations in gamification.';


-- ============================================================
-- 2. Loan History (for DSR calculations)
-- ============================================================
-- Tracks all loans (Koperasi, bank, external) for computing
-- the Debt Service Ratio. DSR = total_monthly_installments / verified_income.

CREATE TABLE IF NOT EXISTS loan_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id           UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    loan_type           VARCHAR(50) NOT NULL,        -- 'KOPERASI', 'BANK', 'EXTERNAL'
    principal_amount    DECIMAL(15,2) NOT NULL,      -- Original loan amount in IDR
    monthly_installment DECIMAL(15,2) NOT NULL,      -- Monthly payment in IDR
    total_installments  INTEGER NOT NULL,            -- Total months to repay
    paid_installments   INTEGER DEFAULT 0,           -- Months already paid
    status              VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, DEFAULTED
    start_date          DATE NOT NULL,
    end_date            DATE,                        -- Expected completion date
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE loan_history IS 'Complete loan portfolio for DSR computation. Includes Koperasi, bank, and external loans.';
COMMENT ON COLUMN loan_history.status IS 'ACTIVE = currently being repaid, COMPLETED = fully paid, DEFAULTED = missed payments.';


-- ============================================================
-- 3. Gamification / Trust Profiles
-- ============================================================
-- Tracks behavioral trust metrics. Streak resets to 0 when fraud detected.
-- Trust score influences the final recommendation tier.

CREATE TABLE IF NOT EXISTS gamification_profiles (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id                UUID UNIQUE NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    repayment_streak         INTEGER DEFAULT 0,     -- Consecutive on-time payment months
    receipt_submissions      INTEGER DEFAULT 0,     -- Total receipts submitted via bot
    receipts_passed          INTEGER DEFAULT 0,     -- Receipts that passed AI integrity check
    fraud_flags_count        INTEGER DEFAULT 0,     -- Incremented on fraud → resets streak to 0
    trust_score              DECIMAL(5,2) DEFAULT 50.00,  -- Computed score 0-100
    last_streak_reset_reason VARCHAR(255),          -- Why streak was last reset
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE gamification_profiles IS 'Behavioral trust metrics. Fraud detection resets streak and deducts score.';
COMMENT ON COLUMN gamification_profiles.fraud_flags_count IS 'Each increment resets repayment_streak to 0 and deducts FRAUD_PENALTY from trust_score.';


-- ============================================================
-- 4. Assessments (Decision Gate results)
-- ============================================================
-- Stores the full output of every Decision Gate call.
-- Status flow: PENDING → SEALED (after admin approval + SHA-256).

CREATE TABLE IF NOT EXISTS assessments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id             UUID NOT NULL REFERENCES worker_profiles(id),
    phone_number          VARCHAR(20) NOT NULL,
    receipt_image_url     TEXT,                     -- CDN URL or base64 data URI

    -- Layer 1: AI Integrity Check
    ai_ocr_data           JSONB,                   -- Parsed receipt items from Gemini
    ai_tampering_score    DECIMAL(5,2),             -- 0-100 (100 = definitely tampered)
    ai_anomaly_flags      JSONB,                   -- Array of flagged price anomalies
    ai_integrity_status   VARCHAR(20),              -- PASS, FAIL, WARNING, TIMEOUT

    -- Layer 2: Financial Capacity
    verified_income       DECIMAL(15,2),            -- Worker's monthly income at time of check
    total_active_debt     DECIMAL(15,2),            -- Sum of all active monthly installments
    computed_dsr          DECIMAL(5,4),             -- e.g., 0.4523 = 45.23%
    financial_status      VARCHAR(20),              -- SAFE, WARNING, BREACH

    -- Layer 3: Gamification
    trust_score           DECIMAL(5,2),             -- Trust score at time of check
    repayment_streak      INTEGER,                  -- Streak at time of check

    -- Decision
    status_rekomendasi    VARCHAR(20) NOT NULL,      -- APPROVE, REJECT, REVISI
    decision_reasoning    TEXT,                      -- Human-readable explanation

    -- Admin Review (populated after admin action)
    admin_action          VARCHAR(20),               -- APPROVE, REJECT (by admin)
    admin_id              UUID,                      -- Who approved/rejected
    admin_notes           TEXT,                      -- Admin commentary
    sealed_at             TIMESTAMPTZ,               -- When SHA-256 seal was generated

    -- Meta
    status                VARCHAR(20) DEFAULT 'PENDING', -- PENDING → SEALED
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE assessments IS 'Complete Decision Gate results. Moves from PENDING to SEALED after admin review + SHA-256.';
COMMENT ON COLUMN assessments.status_rekomendasi IS 'System recommendation: APPROVE (safe), REJECT (breach/fraud), REVISI (needs review).';


-- ============================================================
-- 5. Supa Ledger (Immutable Audit Trail with SHA-256)
-- ============================================================
-- The cryptographic backbone: each sealed assessment gets a SHA-256 hash
-- computed over the ENTIRE frozen payload. If anyone modifies the database
-- record post-sealing, re-computing the hash will yield a different value,
-- proving tampering. Blockchain-level integrity without the overhead.

CREATE TABLE IF NOT EXISTS supa_ledger (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id    UUID NOT NULL REFERENCES assessments(id),
    sha256_hash      VARCHAR(64) NOT NULL UNIQUE,   -- The cryptographic seal (hex)
    payload_snapshot JSONB NOT NULL,                 -- Complete frozen payload at time of seal
    sealed_by        VARCHAR(100),                   -- Admin identifier
    sealed_at        TIMESTAMPTZ DEFAULT NOW(),

    -- Integrity verification
    is_verified      BOOLEAN DEFAULT TRUE,           -- FALSE if tamper detected
    last_verified    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE supa_ledger IS 'Immutable audit trail with SHA-256 cryptographic seals. Detects post-approval tampering.';
COMMENT ON COLUMN supa_ledger.sha256_hash IS 'SHA-256 hash of the complete frozen payload. Unique across all entries.';
COMMENT ON COLUMN supa_ledger.payload_snapshot IS 'JSON snapshot of the entire assessment at time of sealing. Used for hash verification.';


-- ============================================================
-- 6. Audit Log (Operational Telemetry)
-- ============================================================
-- Fine-grained event logging for operational monitoring and compliance.

CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  VARCHAR(50) NOT NULL,              -- DECISION_REQUESTED, ASSESSMENT_SEALED, TAMPER_DETECTED, etc.
    actor       VARCHAR(100),                      -- 'system', 'admin:uuid', 'worker:hash'
    payload     JSONB,                             -- Event-specific data
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE audit_log IS 'Operational event log for monitoring, debugging, and compliance auditing.';


-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_worker_phone
    ON worker_profiles(phone_number);

CREATE INDEX IF NOT EXISTS idx_loan_worker_status
    ON loan_history(worker_id, status);

CREATE INDEX IF NOT EXISTS idx_assessment_worker
    ON assessments(worker_id);

CREATE INDEX IF NOT EXISTS idx_assessment_status
    ON assessments(status);

CREATE INDEX IF NOT EXISTS idx_assessment_created
    ON assessments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_assessment
    ON supa_ledger(assessment_id);

CREATE INDEX IF NOT EXISTS idx_ledger_hash
    ON supa_ledger(sha256_hash);

CREATE INDEX IF NOT EXISTS idx_audit_event_time
    ON audit_log(event_type, created_at DESC);


-- ============================================================
-- ROW LEVEL SECURITY (UU PDP Compliance)
-- ============================================================
-- All tables are locked down to service_role only.
-- The FastAPI backend uses the service_role key and handles
-- authorization at the application layer.

ALTER TABLE worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE supa_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Allow full access for authenticated service_role
CREATE POLICY "service_access_worker_profiles" ON worker_profiles
    FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_access_loan_history" ON loan_history
    FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_access_gamification" ON gamification_profiles
    FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_access_assessments" ON assessments
    FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_access_supa_ledger" ON supa_ledger
    FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_access_audit_log" ON audit_log
    FOR ALL USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- SEED DATA (Demo/Hackathon)
-- ============================================================
-- Insert sample workers for the DIGDAYA demo.

INSERT INTO worker_profiles (phone_number, full_name, nik, company_name, department, position, verified_income, join_date)
VALUES
    ('+6281234567890', 'Ahmad Suparman', '3201012345670001', 'PT Maju Bersama Manufacturing', 'Produksi', 'Operator Mesin CNC', 5500000.00, '2023-01-15'),
    ('+6281234567891', 'Siti Rahayu', '3201012345670002', 'PT Maju Bersama Manufacturing', 'Quality Control', 'Inspector QC', 4800000.00, '2022-06-01'),
    ('+6281234567892', 'Budi Santoso', '3201012345670003', 'PT Maju Bersama Manufacturing', 'Gudang', 'Forklift Operator', 4200000.00, '2024-03-10')
ON CONFLICT (phone_number) DO NOTHING;

-- Sample loan history
INSERT INTO loan_history (worker_id, loan_type, principal_amount, monthly_installment, total_installments, paid_installments, status, start_date)
SELECT id, 'KOPERASI', 9000000.00, 750000.00, 12, 4, 'ACTIVE', '2026-03-01'
FROM worker_profiles WHERE phone_number = '+6281234567890'
ON CONFLICT DO NOTHING;

-- Sample gamification profiles
INSERT INTO gamification_profiles (worker_id, repayment_streak, receipt_submissions, receipts_passed, fraud_flags_count, trust_score)
SELECT id, 11, 24, 23, 0, 82.50
FROM worker_profiles WHERE phone_number = '+6281234567890'
ON CONFLICT (worker_id) DO NOTHING;

INSERT INTO gamification_profiles (worker_id, repayment_streak, receipt_submissions, receipts_passed, fraud_flags_count, trust_score)
SELECT id, 6, 12, 12, 0, 65.00
FROM worker_profiles WHERE phone_number = '+6281234567891'
ON CONFLICT (worker_id) DO NOTHING;

INSERT INTO gamification_profiles (worker_id, repayment_streak, receipt_submissions, receipts_passed, fraud_flags_count, trust_score)
SELECT id, 2, 5, 3, 1, 28.00
FROM worker_profiles WHERE phone_number = '+6281234567892'
ON CONFLICT (worker_id) DO NOTHING;
