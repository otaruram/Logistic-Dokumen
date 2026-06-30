-- gamification_badge_type_fix_migration.sql
-- Fix production constraint so platinum_integrity is allowed.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gamification_badges_badge_type_check'
  ) THEN
    ALTER TABLE public.gamification_badges
      DROP CONSTRAINT gamification_badges_badge_type_check;
  END IF;

  ALTER TABLE public.gamification_badges
    ADD CONSTRAINT gamification_badges_badge_type_check
    CHECK (badge_type IN ('silver_integrity', 'gold_integrity', 'platinum_integrity'));
END $$;
