-- =====================================================
-- Create ImageKit Files Tracking Table
-- For Janitor (Auto-cleanup) Feature
-- =====================================================

-- 1. Create imagekit_files table to track uploaded files
CREATE TABLE IF NOT EXISTS public.imagekit_files (
    id SERIAL PRIMARY KEY,
    file_id TEXT NOT NULL UNIQUE,     -- ImageKit file_id for deletion
    file_url TEXT NOT NULL,           -- Public URL of the file
    file_name TEXT,                   -- Original filename
    file_type TEXT,                   -- image/png, application/pdf, etc
    feature TEXT NOT NULL,            -- 'qr', 'scan', 'invoice', etc
    user_id INTEGER,                  -- INTEGER to match Prisma schema
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for faster cleanup queries
CREATE INDEX IF NOT EXISTS idx_imagekit_created_at ON public.imagekit_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imagekit_feature ON public.imagekit_files(feature);
CREATE INDEX IF NOT EXISTS idx_imagekit_user_id ON public.imagekit_files(user_id);

-- 3. Enable RLS
ALTER TABLE public.imagekit_files ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Users can view own files" ON public.imagekit_files;
CREATE POLICY "Users can view own files" 
ON public.imagekit_files 
FOR SELECT 
USING (user_id = (SELECT id FROM users WHERE id::text = auth.uid()::text));

DROP POLICY IF EXISTS "Authenticated users can insert files" ON public.imagekit_files;
CREATE POLICY "Authenticated users can insert files" 
ON public.imagekit_files 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 5. Function: Auto-cleanup old files (Janitor)
-- Delete files older than 7 days
CREATE OR REPLACE FUNCTION cleanup_old_imagekit_files()
RETURNS TABLE(deleted_count INTEGER, file_ids TEXT[]) AS $$
DECLARE
    old_files RECORD;
    deleted_ids TEXT[];
    count INTEGER := 0;
BEGIN
    -- Get files older than 7 days
    FOR old_files IN 
        SELECT file_id FROM public.imagekit_files 
        WHERE created_at < NOW() - INTERVAL '7 days'
    LOOP
        deleted_ids := array_append(deleted_ids, old_files.file_id);
        count := count + 1;
    END LOOP;
    
    -- Delete from database (backend will handle ImageKit API deletion)
    DELETE FROM public.imagekit_files WHERE created_at < NOW() - INTERVAL '7 days';
    
    RETURN QUERY SELECT count, deleted_ids;
END;
$$ LANGUAGE plpgsql;

-- 6. Optional: Schedule cleanup daily (requires pg_cron extension)
-- Uncomment below if you have pg_cron enabled
-- SELECT cron.schedule('cleanup-imagekit-daily', '0 2 * * *', 'SELECT cleanup_old_imagekit_files()');

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check table structure
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'imagekit_files';

-- Test cleanup function (dry run - see what would be deleted)
-- SELECT * FROM public.imagekit_files WHERE created_at < NOW() - INTERVAL '7 days';
