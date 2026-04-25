import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Phosphor's Supabase singleton. Configured via Vite env vars so the
 * anon key is bundled at build time. The anon key is **public-safe** —
 * RLS policies on the projects table (see supabase/migrations) do the
 * actual access control.
 *
 * If env vars are missing (e.g. local dev without `.env.local`), the
 * client returns null and every cloud helper short-circuits with an
 * "offline / not configured" branch. The app stays fully usable in
 * local-only mode.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
if (url && anonKey) {
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Default PKCE flow: more secure, the recommended Supabase v2 path.
      // Magic-link emails redirect to `?code=...` and Supabase JS exchanges
      // the code for a session on URL parse. Cross-device click works
      // because the verifier is read from the link itself, not localStorage.
      flowType: 'pkce',
      debug: import.meta.env.DEV,
    },
  });
}

export const supabase: SupabaseClient | null = client;
export const isSupabaseConfigured = client !== null;
