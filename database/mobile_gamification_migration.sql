-- Migration: Add Mobile Number and Gamification Indexes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number);

-- Ensure gamification table exists for missions
CREATE TABLE IF NOT EXISTS gamification_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    badge_type TEXT NOT NULL, -- 'silver_integrity', 'gold_integrity'
    month_year TEXT NOT NULL, -- '2024-03'
    verified_count INTEGER DEFAULT 0,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    interest_discount_pct FLOAT DEFAULT 0,
    plafon_bonus INTEGER DEFAULT 0,
    UNIQUE(user_id, month_year, badge_type)
);
