-- Fix updated_at column to have default value
-- Execute this in Supabase SQL Editor

-- Make sure updated_at has a default value and is nullable
ALTER TABLE public.users 
  ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now());

-- Update any NULL values to current timestamp
UPDATE public.users 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Optional: Add trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON public.users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ updated_at column fixed with default value and auto-update trigger!';
END $$;
