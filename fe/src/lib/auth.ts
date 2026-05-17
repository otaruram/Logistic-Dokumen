/**
 * Auth helpers for API calls — reads the current Supabase session access token.
 */
import { supabase } from "@/lib/supabaseClient";

export async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
