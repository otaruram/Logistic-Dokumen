# Database Setup Guide - Missing Tables Fix

## Problem
Your application is missing two critical Supabase tables:
1. `activities` - tracks user feature usage
2. `reviews` - stores user reviews for the landing page

## Solution

### Step 1: Run SQL Migration in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of `supabase-missing-tables.sql`
6. Click **Run** (or press Ctrl+Enter)

### Step 2: Verify Tables Created

Run this query to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('activities', 'reviews');
```

You should see both tables listed.

### Step 3: Test Your Application

The following errors should now be resolved:
- ✅ `Could not find the table 'public.reviews'`
- ✅ `Could not find the table 'public.activities'`
- ✅ `float() argument must be a string or a real number, not 'NoneType'`

## What Was Fixed

### Backend Code Changes
1. **audit_service.py** - Added null safety for float conversions:
   - `float(ai_data.get('grandTotal') or 0)` instead of `float(ai_data.get('grandTotal', 0))`
   - This handles cases where the AI returns `None` values
   - Added default values for all extracted invoice fields

### Database Tables Created

#### activities table
- Tracks all user activities (dgtnz, invoice, compressor, quiz, audit)
- Used for dashboard statistics and weekly activity charts
- Includes RLS policies for user privacy

#### reviews table
- Stores user reviews for the landing page
- Includes approval system (is_approved flag)
- Public can view approved reviews only
- Users can submit and view their own reviews

## Notes

- Both tables use Row Level Security (RLS) for data protection
- Automatic `updated_at` triggers are configured
- Proper indexes added for performance
- Foreign key constraints respect user privacy

## Troubleshooting

If you still see errors after running the migration:
1. Check Supabase logs for SQL errors
2. Verify your `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`
3. Restart your backend server: `uvicorn main:app --reload`
