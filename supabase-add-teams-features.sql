-- SQL Migration: Add Teams and Community features
-- Run this in Supabase SQL Editor to fix "column users.team_id does not exist" error

BEGIN;

-- 1. Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    join_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can view teams
CREATE POLICY "Authenticated users can view teams" ON public.teams
    FOR SELECT USING (auth.role() = 'authenticated');

-- RLS: Authenticated users can create teams
CREATE POLICY "Authenticated users can create teams" ON public.teams
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- 2. Add team_id to users table
-- Check if column exists first to avoid errors on re-run
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'team_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN team_id INTEGER REFERENCES public.teams(id) ON DELETE SET NULL;
        CREATE INDEX idx_users_team_id ON public.users(team_id);
    END IF;
END $$;


-- 3. Create community_posts table
CREATE TABLE IF NOT EXISTS public.community_posts (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    scope TEXT DEFAULT 'GLOBAL', -- 'INTERNAL' or 'GLOBAL'
    team_id INTEGER REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID, -- References auth.users or public.users.id (if UUID). Using UUID to match modern Supabase auth.
    author_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: In models.py user_id is defined as String (UUID), but best practice in Supabase is usually UUID.
-- If public.users.id is currently Integer (old schema), we might need to be careful. 
-- However, supabase-trigger.sql suggests a migration to UUID for users.id. 
-- Assuming users.id is compatible or we store auth.uid() here.

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_community_posts_team_id ON public.community_posts(team_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON public.community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON public.community_posts(created_at);

-- Enable RLS for community_posts
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Community Posts
-- View: Anyone can view GLOBAL posts, Team members can view INTERNAL posts
CREATE POLICY "View posts" ON public.community_posts
    FOR SELECT USING (
        scope = 'GLOBAL' OR 
        (scope = 'INTERNAL' AND team_id IN (
            SELECT team_id FROM public.users WHERE id = auth.uid()::uuid -- Assumes public.users.id matches auth.uid
        ))
    );

-- Insert: Authenticated users can create posts
CREATE POLICY "Create posts" ON public.community_posts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');


COMMIT;

SELECT 'Migration completed successfully. verify by checking users table columns.' as status;
