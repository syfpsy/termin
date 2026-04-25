import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export type SignInResult = { ok: true } | { ok: false; error: string };

/**
 * Auth helpers — thin wrappers around supabase.auth so callers do not
 * import the SDK directly. Every function tolerates `supabase === null`
 * (cloud not configured) and returns a friendly result instead of
 * crashing.
 */

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export async function signInWithMagicLink(email: string): Promise<SignInResult> {
  if (!supabase) return { ok: false, error: 'Cloud is not configured.' };
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, error: 'Email required.' };
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signInWithGoogle(): Promise<SignInResult> {
  if (!supabase) return { ok: false, error: 'Cloud is not configured.' };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export type AuthListener = (session: Session | null) => void;

export function onAuthStateChange(listener: AuthListener): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    listener(session);
  });
  return () => data.subscription.unsubscribe();
}

export { isSupabaseConfigured };
