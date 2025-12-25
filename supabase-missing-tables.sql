-- SQL Migration: Create missing tables for Supabase
-- Run this in Supabase SQL Editor

-- ==========================================
-- 1. Create/Update activities table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.activities (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  feature VARCHAR(50) NOT NULL CHECK (feature IN ('dgtnz', 'invoice', 'compressor', 'quiz', 'audit', 'slides')),
  action VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if table already exists
DO $$ 
BEGIN
  -- Add action column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'activities' 
    AND column_name = 'action'
  ) THEN
    ALTER TABLE public.activities ADD COLUMN action VARCHAR(50);
    -- Set default value for existing rows
    UPDATE public.activities SET action = 'unknown' WHERE action IS NULL;
    -- Make it NOT NULL after setting defaults
    ALTER TABLE public.activities ALTER COLUMN action SET NOT NULL;
  END IF;

  -- Add metadata column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'activities' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.activities ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON public.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_feature ON public.activities(feature);
CREATE INDEX IF NOT EXISTS idx_activities_action ON public.activities(action);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at);

-- Enable RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view their own activities" ON public.activities;
CREATE POLICY "Users can view their own activities"
  ON public.activities
  FOR SELECT
  USING (auth.uid()::text::integer = user_id);

DROP POLICY IF EXISTS "Users can insert their own activities" ON public.activities;
CREATE POLICY "Users can insert their own activities"
  ON public.activities
  FOR INSERT
  WITH CHECK (auth.uid()::text::integer = user_id);

-- ==========================================
-- 2. Create reviews table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  username VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON public.reviews(is_approved);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.reviews;
CREATE POLICY "Anyone can view approved reviews"
  ON public.reviews
  FOR SELECT
  USING (is_approved = true);

DROP POLICY IF EXISTS "Users can view their own reviews" ON public.reviews;
CREATE POLICY "Users can view their own reviews"
  ON public.reviews
  FOR SELECT
  USING (auth.uid()::text::integer = user_id);

DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.reviews;
CREATE POLICY "Users can insert their own reviews"
  ON public.reviews
  FOR INSERT
  WITH CHECK (auth.uid()::text::integer = user_id);

-- ==========================================
-- 3. Create updated_at trigger function
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_activities_updated_at ON public.activities;
CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- 4. Grant permissions
-- ==========================================
GRANT SELECT, INSERT ON public.activities TO authenticated;
GRANT SELECT, INSERT ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;

-- ==========================================
-- 5. Update scans table with missing columns
-- ==========================================
DO $$ 
BEGIN
  -- Add file_size column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scans' 
    AND column_name = 'file_size'
  ) THEN
    ALTER TABLE public.scans ADD COLUMN file_size INTEGER;
  END IF;

  -- Add file_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scans' 
    AND column_name = 'file_type'
  ) THEN
    ALTER TABLE public.scans ADD COLUMN file_type VARCHAR(50);
  END IF;

  -- Add recipient_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scans' 
    AND column_name = 'recipient_name'
  ) THEN
    ALTER TABLE public.scans ADD COLUMN recipient_name VARCHAR(255);
  END IF;

  -- Add signature_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scans' 
    AND column_name = 'signature_url'
  ) THEN
    ALTER TABLE public.scans ADD COLUMN signature_url VARCHAR(500);
  END IF;

  -- Add imagekit_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scans' 
    AND column_name = 'imagekit_url'
  ) THEN
    ALTER TABLE public.scans ADD COLUMN imagekit_url VARCHAR(500);
  END IF;
END $$;

-- ==========================================
-- Done!
-- ==========================================
SELECT 'Migration completed successfully!' AS status;
