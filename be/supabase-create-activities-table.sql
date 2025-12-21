-- Create activities table for tracking all feature usage
-- Execute this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.activities (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL, -- 'dgtnz', 'qr', 'invoice', 'quiz', 'compress', 'community'
  action TEXT, -- 'scan', 'generate', 'create', 'upload', etc
  metadata JSONB, -- Additional data (file_name, quiz_id, etc)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON public.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_feature ON public.activities(feature);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user_date ON public.activities(user_id, created_at DESC);

-- Disable RLS (development mode)
ALTER TABLE public.activities DISABLE ROW LEVEL SECURITY;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Activities table created successfully!';
  RAISE NOTICE '✅ Ready to track all feature usage for analytics';
END $$;
