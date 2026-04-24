import { GitFork, Library } from 'lucide-react';
import { SCENE_LIBRARY, type LibraryScene } from '../scenes/library';
import { Panel } from './components';

type SceneLibraryProps = {
  onFork: (scene: LibraryScene) => void;
};

export function SceneLibrary({ onFork }: SceneLibraryProps) {
  return (
    <Panel
      title="LIBRARY"
      flags={`${SCENE_LIBRARY.length} seeds`}
      dense
      flush
      className="library-panel"
      tools={<Library size={13} />}
    >
      <div className="library-list">
        {SCENE_LIBRARY.map((scene) => (
          <button key={scene.id} className="library-card" onClick={() => onFork(scene)}>
            <span>
              <strong>{scene.name}</strong>
              <small>{scene.shelf} - {scene.description}</small>
            </span>
            <span className="button button--default library-card__action">
              <span className="button__icon">
                <GitFork size={12} />
              </span>
              <span>fork</span>
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}
