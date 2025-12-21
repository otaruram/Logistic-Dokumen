import { createClient } from '@supabase/supabase-js'

// Load from environment variables with fallback
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Check if configuration is missing
const isMissingConfig = !SUPABASE_URL || !SUPABASE_ANON_KEY;

if (isMissingConfig) {
  console.error('❌ Missing Supabase configuration!');
  console.error('   VITE_SUPABASE_URL:', SUPABASE_URL ? '✓ Set' : '✗ Missing');
  console.error('   VITE_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing');
  console.error('');
  console.error('   📋 TO FIX (Vercel):');
  console.error('   1. Go to: https://vercel.com → Project Settings → Environment Variables');
  console.error('   2. Add: VITE_SUPABASE_URL = https://xxxxx.supabase.co');
  console.error('   3. Add: VITE_SUPABASE_ANON_KEY = eyJhbGc...');
  console.error('   4. Redeploy: Deployments → ... → Redeploy');
}

// ✅ Create client with fallback values to prevent blank screen
// Using dummy values if config missing - will show error in app but won't crash
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    }
  }
);

// Export config status for error handling in components
export const isSupabaseConfigured = !isMissingConfig;
