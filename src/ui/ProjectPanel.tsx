import { Copy, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Project, ProjectScene, SceneId } from '../state/projectSchema';
import { Button, Panel } from './components';

type ProjectPanelProps = {
  project: Project;
  onSelectScene: (id: SceneId) => void;
  onAddScene: () => void;
  onRenameScene: (id: SceneId, name: string) => void;
  onDuplicateScene: (id: SceneId) => void;
  onDeleteScene: (id: SceneId) => void;
  onRenameProject: (name: string) => void;
};

export function ProjectPanel({
  project,
  onSelectScene,
  onAddScene,
  onRenameScene,
  onDuplicateScene,
  onDeleteScene,
  onRenameProject,
}: ProjectPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState(false);

  return (
    <Panel
      id="project"
      title="PROJECT"
      tone="amber"
      flags={`${project.scenes.length} scene${project.scenes.length === 1 ? '' : 's'}`}
      dense
      flush
      tools={
        <Button
          aria-label="Add scene"
          icon={<Plus size={12} />}
          onClick={onAddScene}
          title="Add a new scene to this project"
        />
      }
    >
      <div className="project-panel">
        <div className="project-panel__name">
          {editingProjectName ? (
            <input
              autoFocus
              className="project-panel__name-input"
              defaultValue={project.name}
              onBlur={(event) => {
                const next = event.currentTarget.value.trim();
                if (next && next !== project.name) onRenameProject(next);
                setEditingProjectName(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  event.currentTarget.value = project.name;
                  setEditingProjectName(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="project-panel__name-button"
              title="Rename project"
              onClick={() => setEditingProjectName(true)}
            >
              {project.name}
            </button>
          )}
        </div>

        <ul className="project-panel__scenes" role="list">
          {project.scenes.map((scene) => (
            <SceneRow
              key={scene.id}
              scene={scene}
              isActive={scene.id === project.activeSceneId}
              isEditing={editingId === scene.id}
              canDelete={project.scenes.length > 1}
              onSelect={() => onSelectScene(scene.id)}
              onStartRename={() => setEditingId(scene.id)}
              onCommitRename={(name) => {
                onRenameScene(scene.id, name);
                setEditingId(null);
              }}
              onCancelRename={() => setEditingId(null)}
              onDuplicate={() => onDuplicateScene(scene.id)}
              onDelete={() => onDeleteScene(scene.id)}
            />
          ))}
        </ul>
      </div>
    </Panel>
  );
}

type SceneRowProps = {
  scene: ProjectScene;
  isActive: boolean;
  isEditing: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

function SceneRow({
  scene,
  isActive,
  isEditing,
  canDelete,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDuplicate,
  onDelete,
}: SceneRowProps) {
  return (
    <li className={`project-scene-row ${isActive ? 'project-scene-row--active' : ''}`}>
      {isEditing ? (
        <input
          autoFocus
          className="project-scene-row__rename"
          defaultValue={scene.name}
          onBlur={(event) => {
            const next = event.currentTarget.value.trim();
            if (next && next !== scene.name) onCommitRename(next);
            else onCancelRename();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              event.currentTarget.value = scene.name;
              onCancelRename();
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="project-scene-row__select"
          aria-current={isActive ? 'true' : undefined}
          onClick={onSelect}
          onDoubleClick={onStartRename}
          title={`Open ${scene.name} (double-click to rename)`}
        >
          <span className="project-scene-row__name">{scene.name}</span>
          <span className="project-scene-row__duration">{formatDuration(scene.durationMs)}</span>
        </button>
      )}
      {!isEditing && (
        <div className="project-scene-row__tools">
          <button
            type="button"
            className="icon-button"
            aria-label="Duplicate scene"
            title="Duplicate scene"
            onClick={onDuplicate}
          >
            <Copy size={11} />
          </button>
          <button
            type="button"
            className="icon-button icon-button--danger"
            aria-label="Delete scene"
            title={canDelete ? 'Delete scene' : 'A project must keep at least one scene'}
            onClick={onDelete}
            disabled={!canDelete}
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </li>
  );
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '--';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
}
