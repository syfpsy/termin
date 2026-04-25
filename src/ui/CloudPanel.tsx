import { Cloud, Download, LogIn, Upload } from 'lucide-react';
import { useState } from 'react';
import { Panel } from './components';

type CloudPanelProps = {
  onSaveCurrentToCloud?: () => void;
  onBrowsePhosphorLibrary?: () => void;
};

const DRAFT_EMAIL_KEY = 'phosphor.cloud.draft.email';

/**
 * Placeholder for the cloud sync layer. UI is wired but actual sync needs
 * an account backend (auth + storage) which is a separate piece of work.
 * The button stubs save the draft state locally so once the backend lands
 * the existing user flow keeps working.
 */
export function CloudPanel({ onSaveCurrentToCloud, onBrowsePhosphorLibrary }: CloudPanelProps) {
  const [email, setEmail] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(DRAFT_EMAIL_KEY) ?? '';
  });
  const [signedIn, setSignedIn] = useState(false);

  return (
    <Panel id="cloud" title="CLOUD" tone="cyan" flags="preview" dense flush>
      <div className="cloud-panel">
        {!signedIn ? (
          <form
            className="cloud-panel__signin"
            onSubmit={(event) => {
              event.preventDefault();
              if (typeof window !== 'undefined') {
                window.localStorage.setItem(DRAFT_EMAIL_KEY, email);
              }
              setSignedIn(true);
            }}
          >
            <p className="cloud-panel__lede">
              Sync your library + curated Phosphor scenes. Sign-in is a preview —
              account backend lands in the next iteration.
            </p>
            <label className="cloud-panel__label">
              <span>email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <button type="submit" className="button button--prim">
              <LogIn size={11} /> sign in (preview)
            </button>
          </form>
        ) : (
          <div className="cloud-panel__signed">
            <div className="cloud-panel__identity">
              <Cloud size={11} /> {email || 'preview user'}
            </div>
            <button
              type="button"
              className="button button--default"
              onClick={onSaveCurrentToCloud}
              disabled={!onSaveCurrentToCloud}
              title="Save the active project to your cloud library"
            >
              <Upload size={11} /> save library
            </button>
            <button
              type="button"
              className="button button--default"
              onClick={onBrowsePhosphorLibrary}
              disabled={!onBrowsePhosphorLibrary}
              title="Browse Phosphor's curated scenes"
            >
              <Download size={11} /> browse phosphor library
            </button>
            <p className="cloud-panel__note">
              Local-only for now. Saves stage in your browser until the backend
              ships; nothing leaves your device.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}
