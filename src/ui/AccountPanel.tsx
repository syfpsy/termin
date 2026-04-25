import type { Session } from '@supabase/supabase-js';
import { Cloud, LogIn, LogOut, Send } from 'lucide-react';
import { useState } from 'react';
import {
  isSupabaseConfigured,
  signInWithGoogle,
  signInWithMagicLink,
  signOut,
} from '../state/authState';
import { Panel } from './components';

type AccountPanelProps = {
  session: Session | null;
};

/**
 * Account / sign-in surface for the Settings page. When signed out it
 * mirrors the cloud panel's sign-in form. When signed in it shows the
 * user's email, ID, sign-in provider, and a sign-out button.
 *
 * Intentionally separate from `CloudPanel` (which is right-rail and
 * library-focused) — this is the user-management entry point.
 */
export function AccountPanel({ session }: AccountPanelProps) {
  const [email, setEmail] = useState('');
  const [magicSentTo, setMagicSentTo] = useState<string | null>(null);
  const [signinError, setSigninError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <Panel id="account" title="ACCOUNT" tone="cyan" flags="cloud not configured" dense>
        <p className="cloud-panel__lede" style={{ padding: 0, margin: 0 }}>
          The cloud backend isn't configured in this build (no
          <code> VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>).
          The studio still runs fully locally; cloud sync ships once the env vars are set.
        </p>
      </Panel>
    );
  }

  if (session) {
    const provider =
      typeof session.user.app_metadata?.provider === 'string'
        ? session.user.app_metadata.provider
        : 'magic link';
    const createdAt = session.user.created_at ? new Date(session.user.created_at).toLocaleDateString() : '—';

    return (
      <Panel id="account" title="ACCOUNT" tone="cyan" flags="signed in" dense>
        <div className="account-panel">
          <div className="account-panel__row">
            <span className="account-panel__label">email</span>
            <strong>{session.user.email ?? '—'}</strong>
          </div>
          <div className="account-panel__row">
            <span className="account-panel__label">user id</span>
            <code>{session.user.id}</code>
          </div>
          <div className="account-panel__row">
            <span className="account-panel__label">signed in via</span>
            <span>{provider}</span>
          </div>
          <div className="account-panel__row">
            <span className="account-panel__label">member since</span>
            <span>{createdAt}</span>
          </div>
          <div className="account-panel__actions">
            <button
              type="button"
              className="button button--default"
              onClick={() => void signOut()}
            >
              <LogOut size={11} /> sign out
            </button>
          </div>
          <p className="account-panel__note">
            Your projects are stored under <code>{session.user.id.slice(0, 8)}…</code>.
            Row-level security on the cloud table means only you can edit them; published
            projects are readable by anyone.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel id="account" title="ACCOUNT" tone="cyan" flags="signed out" dense>
      <form
        className="account-panel account-panel--signin"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setSigninError(null);
          setBusy(true);
          const result = await signInWithMagicLink(email);
          setBusy(false);
          if (result.ok) setMagicSentTo(email.trim());
          else setSigninError(result.error);
        }}
      >
        <p className="cloud-panel__lede" style={{ margin: 0 }}>
          Sign in to sync your library across devices and access the Phosphor public library.
        </p>
        <button
          type="button"
          className="button button--default cloud-panel__google"
          onClick={async () => {
            setSigninError(null);
            const result = await signInWithGoogle();
            if (!result.ok) setSigninError(result.error);
          }}
        >
          <LogIn size={11} /> sign in with Google
        </button>
        <div className="cloud-panel__divider"><span>or</span></div>
        <label className="cloud-panel__label">
          <span>email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </label>
        <button type="submit" className="button button--prim" disabled={busy}>
          <Send size={11} /> {busy ? 'sending…' : 'send magic link'}
        </button>
        {magicSentTo && (
          <p className="cloud-panel__note">
            <Cloud size={9} /> Magic link sent to <strong>{magicSentTo}</strong>.
            Check your inbox and click the link to sign in.
          </p>
        )}
        {signinError && <p className="cloud-panel__error">{signinError}</p>}
      </form>
    </Panel>
  );
}
