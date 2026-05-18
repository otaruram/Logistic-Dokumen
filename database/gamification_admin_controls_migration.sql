-- gamification_admin_controls_migration.sql
-- Admin controls for configurable gamification rewards and audit trail

CREATE TABLE IF NOT EXISTS gamification_config (
  id INTEGER PRIMARY KEY,
  silver_threshold INTEGER NOT NULL DEFAULT 50,
  gold_threshold INTEGER NOT NULL DEFAULT 150,
  platinum_threshold INTEGER NOT NULL DEFAULT 250,
  gold_interest_discount_pct DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  platinum_interest_discount_pct DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  gold_plafon_bonus BIGINT NOT NULL DEFAULT 1000000,
  platinum_plafon_bonus BIGINT NOT NULL DEFAULT 2500000,
  gold_context_tba TEXT NOT NULL DEFAULT 'TBA: benefit Gold aktif setelah verifikasi risiko internal koperasi.',
  platinum_context_tba TEXT NOT NULL DEFAULT 'TBA: benefit Platinum aktif setelah validasi partner + governance check.',
  badge_base_url TEXT NOT NULL DEFAULT 'https://api.dicebear.com/9.x/shapes/png',
  certificate_base_url TEXT NOT NULL DEFAULT 'https://api.dicebear.com/9.x/glass/png',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO gamification_config (
  id,
  silver_threshold,
  gold_threshold,
  platinum_threshold,
  gold_interest_discount_pct,
  platinum_interest_discount_pct,
  gold_plafon_bonus,
  platinum_plafon_bonus
)
VALUES (1, 50, 150, 250, 0.5, 1.0, 1000000, 2500000)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS gamification_admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID,
  admin_email TEXT,
  target_user_id UUID NOT NULL,
  month_year TEXT NOT NULL,
  badge_type TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gamification_admin_actions_target
  ON gamification_admin_actions(target_user_id, month_year);
