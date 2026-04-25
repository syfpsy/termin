import type { Session } from '@supabase/supabase-js';
import { Cloud, Download, Globe, Library as LibraryIcon, LogIn, LogOut, Lock, Send, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  isSupabaseConfigured,
  signInWithGoogle,
  signInWithMagicLink,
  signOut,
} from '../state/authState';
import {
  listMyCloudProjects,
  listPublishedProjects,
  pushProjectToCloud,
  setProjectPublished,
  type CloudProjectRow,
} from '../state/cloudProjects';
import type { Project } from '../state/projectSchema';
import { Panel } from './components';

type CloudPanelProps = {
  project: Project | null;
  /** Session is owned by App (single source of truth) and passed in. */
  session: Session | null;
  onProjectFromCloud: (project: Project) => void;
  onError?: (message: string) => void;
};

type View = 'auth' | 'mine' | 'public';

export function CloudPanel({ project, session, onProjectFromCloud, onError }: CloudPanelProps) {
  const [view, setView] = useState<View>('mine');
  const [mine, setMine] = useState<CloudProjectRow[]>([]);
  const [published, setPublished] = useState<CloudProjectRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [magicSentTo, setMagicSentTo] = useState<string | null>(null);
  const [signinError, setSigninError] = useState<string | null>(null);

  // Refresh the user's cloud project list whenever a session lands or the
  // active local project's id/name changes (so newly-pushed rows appear).
  useEffect(() => {
    if (!session) {
      setMine([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await listMyCloudProjects();
      if (cancelled) return;
      if (result.ok) setMine(result.value);
      else onError?.(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, project?.id, project?.name, onError]);

  // Public list lazily loads when the user opens the public tab.
  useEffect(() => {
    if (view !== 'public') return;
    let cancelled = false;
    void (async () => {
      const result = await listPublishedProjects();
      if (cancelled) return;
      if (result.ok) setPublished(result.value);
      else onError?.(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [view, onError]);

  if (!isSupabaseConfigured) {
    return (
      <Panel id="cloud" title="CLOUD" tone="cyan" flags="offline" dense flush>
        <div className="cloud-panel">
          <p className="cloud-panel__lede">
            Cloud is not configured in this build. Add{' '}
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable
            sign-in, library sync, and the public Phosphor library.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      id="cloud"
      title="CLOUD"
      tone="cyan"
      flags={session ? session.user.email ?? 'signed in' : 'sign in'}
      dense
      flush
      tools={
        session && (
          <button
            type="button"
            className="icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void signOut()}
          >
            <LogOut size={11} />
          </button>
        )
      }
    >
      <div className="cloud-panel">
        {!session ? (
          <SignInForm
            email={emailDraft}
            onEmailChange={setEmailDraft}
            magicSentTo={magicSentTo}
            error={signinError}
            onMagicLink={async () => {
              setSigninError(null);
              setBusy('magic');
              const result = await signInWithMagicLink(emailDraft);
              setBusy(null);
              if (result.ok) setMagicSentTo(emailDraft.trim());
              else setSigninError(result.error);
            }}
            onGoogle={async () => {
              setSigninError(null);
              const result = await signInWithGoogle();
              if (!result.ok) setSigninError(result.error);
            }}
            busy={busy === 'magic'}
          />
        ) : (
          <SignedInBody
            project={project}
            view={view}
            onChangeView={setView}
            mine={mine}
            published={published}
            busy={busy}
            onSaveCurrent={async () => {
              if (!project) return;
              setBusy('save');
              const result = await pushProjectToCloud(project);
              setBusy(null);
              if (!result.ok) {
                onError?.(result.error);
                return;
              }
              const refresh = await listMyCloudProjects();
              if (refresh.ok) setMine(refresh.value);
            }}
            onTogglePublished={async (id, next) => {
              setBusy(`pub-${id}`);
              const result = await setProjectPublished(id, next);
              setBusy(null);
              if (!result.ok) {
                onError?.(result.error);
                return;
              }
              const refresh = await listMyCloudProjects();
              if (refresh.ok) setMine(refresh.value);
            }}
            onOpenRow={(row) => onProjectFromCloud(row.body)}
          />
        )}
      </div>
    </Panel>
  );
}

type SignInFormProps = {
  email: string;
  onEmailChange: (email: string) => void;
  magicSentTo: string | null;
  error: string | null;
  onMagicLink: () => void;
  onGoogle: () => void;
  busy: boolean;
};

function SignInForm({ email, onEmailChange, magicSentTo, error, onMagicLink, onGoogle, busy }: SignInFormProps) {
  return (
    <form
      className="cloud-panel__signin"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) onMagicLink();
      }}
    >
      <p className="cloud-panel__lede">
        Sign in to sync your library across devices and browse the Phosphor public library.
      </p>
      <button type="button" className="button button--default cloud-panel__google" onClick={onGoogle}>
        <LogIn size={11} /> sign in with Google
      </button>
      <div className="cloud-panel__divider"><span>or</span></div>
      <label className="cloud-panel__label">
        <span>email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
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
          Magic link sent to <strong>{magicSentTo}</strong>. Check your inbox and click the link
          — you'll land back here signed in.
        </p>
      )}
      {error && <p className="cloud-panel__error">{error}</p>}
    </form>
  );
}

type SignedInBodyProps = {
  project: Project | null;
  view: View;
  onChangeView: (view: View) => void;
  mine: CloudProjectRow[];
  published: CloudProjectRow[];
  busy: string | null;
  onSaveCurrent: () => void;
  onTogglePublished: (id: string, next: boolean) => void;
  onOpenRow: (row: CloudProjectRow) => void;
};

function SignedInBody({
  project,
  view,
  onChangeView,
  mine,
  published,
  busy,
  onSaveCurrent,
  onTogglePublished,
  onOpenRow,
}: SignedInBodyProps) {
  const myRow = project ? mine.find((row) => row.id === project.id) : undefined;
  const isPublished = myRow?.is_published ?? false;
  const isUploaded = Boolean(myRow);

  return (
    <>
      <div className="cloud-panel__active">
        <button
          type="button"
          className="button button--default"
          onClick={onSaveCurrent}
          disabled={!project || busy === 'save'}
          title="Push the active project to your cloud library"
        >
          <Upload size={11} /> {isUploaded ? 'sync to cloud' : 'save to cloud'}
        </button>
        {project && (
          <button
            type="button"
            className="button button--default"
            disabled={!isUploaded || busy === `pub-${project.id}`}
            onClick={() => onTogglePublished(project.id, !isPublished)}
            title={isPublished ? 'Unpublish — only you can read it' : 'Publish — anyone can fork'}
          >
            {isPublished ? <Lock size={11} /> : <Globe size={11} />}{' '}
            {isPublished ? 'unpublish' : 'publish'}
          </button>
        )}
      </div>

      <div className="cloud-panel__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'mine'}
          className={`cloud-panel__tab ${view === 'mine' ? 'is-active' : ''}`}
          onClick={() => onChangeView('mine')}
        >
          <Cloud size={10} /> my library
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'public'}
          className={`cloud-panel__tab ${view === 'public' ? 'is-active' : ''}`}
          onClick={() => onChangeView('public')}
        >
          <LibraryIcon size={10} /> phosphor library
        </button>
      </div>

      <div className="cloud-panel__rows">
        {(view === 'mine' ? mine : published).map((row) => (
          <button
            key={row.id}
            type="button"
            className={`cloud-row ${row.id === project?.id ? 'cloud-row--active' : ''}`}
            onClick={() => onOpenRow(row)}
            title={`Open "${row.name}"`}
          >
            <span className="cloud-row__name">{row.name}</span>
            <span className="cloud-row__meta">
              {row.is_published ? <Globe size={9} /> : null}
              <span>{relativeTime(row.updated_at)}</span>
            </span>
          </button>
        ))}
        {(view === 'mine' ? mine : published).length === 0 && (
          <p className="cloud-panel__empty">
            {view === 'mine' ? (
              <>Your cloud library is empty. Click "save to cloud" above to upload the active project.</>
            ) : (
              <>The public library is quiet. Publish a project to seed it.</>
            )}
          </p>
        )}
      </div>

      <p className="cloud-panel__note">
        <Download size={9} /> Opening a project pulls it into local storage so you can edit
        offline; "sync to cloud" pushes it back when you're done.
      </p>
    </>
  );
}

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const elapsed = Date.now() - then;
  const min = Math.round(elapsed / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const month = Math.round(day / 30);
  return `${month}mo ago`;
}
