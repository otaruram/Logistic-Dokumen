-- Create quizzes table in Supabase
-- Run this SQL in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.quizzes (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    title TEXT NOT NULL,
    questions JSONB NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_quizzes_user_id ON public.quizzes(user_id);
CREATE INDEX idx_quizzes_created_at ON public.quizzes(created_at DESC);
CREATE INDEX idx_quizzes_topic ON public.quizzes(topic);

-- Enable Row Level Security (RLS)
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own quizzes
CREATE POLICY "Users can view their own quizzes"
ON public.quizzes
FOR SELECT
USING (auth.uid()::text = user_id);

-- Policy: Users can insert their own quizzes
CREATE POLICY "Users can insert their own quizzes"
ON public.quizzes
FOR INSERT
WITH CHECK (auth.uid()::text = user_id OR auth.role() = 'authenticated');

-- Policy: Anyone can read quiz by ID (for sharing)
CREATE POLICY "Anyone can read quiz by ID"
ON public.quizzes
FOR SELECT
USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;

-- Comment for documentation
COMMENT ON TABLE public.quizzes IS 'AI-generated quizzes stored for users';
COMMENT ON COLUMN public.quizzes.questions IS 'JSONB array containing 20 quiz questions with options and explanations';
