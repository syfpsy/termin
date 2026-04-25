import { Pencil, Plus, Trash2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { assetPreview } from '../state/assetUtils';
import { DEFAULT_PALETTE, type ProjectAsset, type ProjectAssetBody } from '../state/projectSchema';
import { Button, Panel } from './components';

type AssetPanelProps = {
  assets: ProjectAsset[];
  onAdd: (body: ProjectAssetBody, name: string) => void;
  onRename: (assetId: string, name: string) => void;
  onDelete: (assetId: string) => void;
  onUpdate: (assetId: string, body: ProjectAssetBody) => void;
  onApplyAtPlayhead: (asset: ProjectAsset) => void;
};

type CreatorState =
  | { kind: 'closed' }
  | { kind: 'text' }
  | { kind: 'ascii' }
  | { kind: 'palette' }
  | { kind: 'data' };

export function AssetPanel({
  assets,
  onAdd,
  onRename,
  onDelete,
  onUpdate,
  onApplyAtPlayhead,
}: AssetPanelProps) {
  const [creator, setCreator] = useState<CreatorState>({ kind: 'closed' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBodyId, setEditingBodyId] = useState<string | null>(null);

  const closeCreator = () => setCreator({ kind: 'closed' });
  const editingBody = assets.find((asset) => asset.id === editingBodyId) ?? null;

  return (
    <Panel
      id="assets"
      title="ASSETS"
      tone="cyan"
      flags={`${assets.length}`}
      dense
      flush
      tools={
        <Button
          aria-label="Add asset"
          icon={<Plus size={12} />}
          onClick={() => setCreator({ kind: 'text' })}
          title="Add a new asset"
        />
      }
    >
      <div className="asset-panel">
        {creator.kind === 'closed' && (
          <div className="asset-panel__add-row" role="toolbar" aria-label="Add asset">
            <button type="button" className="asset-panel__add" onClick={() => setCreator({ kind: 'text' })}>
              + text
            </button>
            <button type="button" className="asset-panel__add" onClick={() => setCreator({ kind: 'ascii' })}>
              + ascii
            </button>
            <button type="button" className="asset-panel__add" onClick={() => setCreator({ kind: 'palette' })}>
              + palette
            </button>
            <button type="button" className="asset-panel__add" onClick={() => setCreator({ kind: 'data' })}>
              + data
            </button>
          </div>
        )}

        {creator.kind !== 'closed' && (
          <AssetCreator
            kind={creator.kind}
            onCancel={closeCreator}
            onSubmit={(body, name) => {
              onAdd(body, name);
              closeCreator();
            }}
          />
        )}

        {editingBody && (
          <AssetEditor
            asset={editingBody}
            onCancel={() => setEditingBodyId(null)}
            onSave={(body) => {
              onUpdate(editingBody.id, body);
              setEditingBodyId(null);
            }}
          />
        )}

        {assets.length === 0 ? (
          <p className="asset-panel__empty">
            Drop in text snippets, ASCII frames, palettes, or JSON data.
            They live with the project and can be reused across scenes.
          </p>
        ) : (
          <ul className="asset-panel__list" role="list">
            {assets.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                isEditingName={editingId === asset.id}
                onSelectName={() => setEditingId(asset.id)}
                onCommitName={(name) => {
                  onRename(asset.id, name);
                  setEditingId(null);
                }}
                onCancelName={() => setEditingId(null)}
                onApply={() => onApplyAtPlayhead(asset)}
                onEditBody={() => setEditingBodyId(asset.id)}
                onDelete={() => onDelete(asset.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

type AssetRowProps = {
  asset: ProjectAsset;
  isEditingName: boolean;
  onSelectName: () => void;
  onCommitName: (name: string) => void;
  onCancelName: () => void;
  onApply: () => void;
  onEditBody: () => void;
  onDelete: () => void;
};

function AssetRow({
  asset,
  isEditingName,
  onSelectName,
  onCommitName,
  onCancelName,
  onApply,
  onEditBody,
  onDelete,
}: AssetRowProps) {
  const isApplyable =
    asset.kind === 'text' ||
    asset.kind === 'ascii' ||
    asset.kind === 'palette' ||
    asset.kind === 'data' ||
    asset.kind === 'image-ascii';

  const draggable = asset.kind === 'text' || asset.kind === 'ascii' || asset.kind === 'image-ascii';

  return (
    <li
      className={`asset-row asset-row--${asset.kind}`}
      data-asset-id={asset.id}
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return;
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('application/x-phosphor-asset', asset.id);
        event.dataTransfer.setData('text/plain', asset.name);
      }}
    >
      <span className={`asset-row__kind asset-row__kind--${asset.kind}`} aria-label={asset.kind}>
        {kindGlyph(asset.kind)}
      </span>
      {isEditingName ? (
        <input
          autoFocus
          className="asset-row__rename"
          defaultValue={asset.name}
          onBlur={(event) => {
            const next = event.currentTarget.value.trim();
            if (next && next !== asset.name) onCommitName(next);
            else onCancelName();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              event.currentTarget.value = asset.name;
              onCancelName();
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="asset-row__select"
          title={`${asset.name} (double-click to rename)`}
          onDoubleClick={onSelectName}
        >
          <span className="asset-row__name">{asset.name}</span>
          <span className="asset-row__preview">{assetPreview(asset)}</span>
        </button>
      )}
      <div className="asset-row__tools">
        {isApplyable && (
          <button
            type="button"
            className="icon-button"
            aria-label="Use at playhead"
            title={dragHint(asset.kind)}
            onClick={onApply}
          >
            <Wand2 size={11} />
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label="Edit asset body"
          title="Edit"
          onClick={onEditBody}
        >
          <Pencil size={11} />
        </button>
        <button
          type="button"
          className="icon-button icon-button--danger"
          aria-label="Delete asset"
          title="Delete asset"
          onClick={onDelete}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </li>
  );
}

function kindGlyph(kind: ProjectAsset['kind']): string {
  switch (kind) {
    case 'text':
      return 'T';
    case 'ascii':
      return '▤';
    case 'palette':
      return '◐';
    case 'data':
      return '{}';
    case 'image-ascii':
      return '▦';
    case 'subscene':
      return '↳';
    default:
      return '?';
  }
}

function dragHint(kind: ProjectAsset['kind']): string {
  if (kind === 'text' || kind === 'ascii' || kind === 'image-ascii') {
    return 'Drag onto timeline or click to insert at playhead';
  }
  if (kind === 'palette') return 'Apply this palette to the active scene';
  if (kind === 'data') return 'Inject this data block into the active scene';
  return 'Use this asset';
}

type AssetCreatorProps = {
  kind: 'text' | 'ascii' | 'palette' | 'data';
  onCancel: () => void;
  onSubmit: (body: ProjectAssetBody, name: string) => void;
};

function AssetCreator({ kind, onCancel, onSubmit }: AssetCreatorProps) {
  return (
    <div className="asset-creator" role="group" aria-label={`Create ${kind} asset`}>
      <div className="asset-creator__heading">new {kind}</div>
      <AssetEditorBody
        initial={emptyBody(kind)}
        nameInitial={defaultName(kind)}
        onCancel={onCancel}
        onSubmit={(body, name) => onSubmit(body, name)}
        showName
      />
    </div>
  );
}

type AssetEditorProps = {
  asset: ProjectAsset;
  onCancel: () => void;
  onSave: (body: ProjectAssetBody) => void;
};

function AssetEditor({ asset, onCancel, onSave }: AssetEditorProps) {
  return (
    <div className="asset-creator" role="group" aria-label={`Edit ${asset.kind} asset`}>
      <div className="asset-creator__heading">edit {asset.name}</div>
      <AssetEditorBody
        initial={extractBody(asset)}
        nameInitial={asset.name}
        onCancel={onCancel}
        onSubmit={(body) => onSave(body)}
        showName={false}
      />
    </div>
  );
}

type AssetEditorBodyProps = {
  initial: ProjectAssetBody;
  nameInitial: string;
  showName: boolean;
  onCancel: () => void;
  onSubmit: (body: ProjectAssetBody, name: string) => void;
};

function AssetEditorBody({ initial, nameInitial, showName, onCancel, onSubmit }: AssetEditorBodyProps) {
  const [name, setName] = useState(nameInitial);
  const [textValue, setTextValue] = useState(initial.kind === 'text' ? initial.text : '');
  const [asciiValue, setAsciiValue] = useState(initial.kind === 'ascii' ? initial.lines.join('\n') : '');
  const [paletteValue, setPaletteValue] = useState(
    initial.kind === 'palette' ? initial.tones : DEFAULT_PALETTE,
  );
  const [dataValue, setDataValue] = useState(
    initial.kind === 'data' ? JSON.stringify(initial.data, null, 2) : '{}',
  );
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    let body: ProjectAssetBody;
    if (initial.kind === 'text') {
      body = { kind: 'text', text: textValue };
    } else if (initial.kind === 'ascii') {
      body = { kind: 'ascii', lines: asciiValue.split('\n') };
    } else if (initial.kind === 'palette') {
      body = { kind: 'palette', tones: paletteValue };
    } else if (initial.kind === 'data') {
      try {
        const parsed = JSON.parse(dataValue);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setError('Data must be a JSON object.');
          return;
        }
        body = { kind: 'data', data: parsed as Record<string, unknown> };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid JSON');
        return;
      }
    } else if (initial.kind === 'image-ascii' || initial.kind === 'subscene') {
      onCancel();
      return;
    } else {
      onCancel();
      return;
    }
    onSubmit(body, name.trim() || nameInitial);
  };

  return (
    <div className="asset-creator__body">
      {showName && (
        <label className="asset-creator__field">
          <span>name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
      )}

      {initial.kind === 'text' && (
        <label className="asset-creator__field">
          <span>text</span>
          <textarea rows={3} value={textValue} onChange={(event) => setTextValue(event.target.value)} />
        </label>
      )}

      {initial.kind === 'ascii' && (
        <label className="asset-creator__field">
          <span>lines (one per row)</span>
          <textarea rows={6} value={asciiValue} onChange={(event) => setAsciiValue(event.target.value)} />
        </label>
      )}

      {initial.kind === 'palette' && (
        <div className="asset-creator__palette">
          {Object.entries(paletteValue).map(([key, hex]) => (
            <label key={key} className="asset-creator__swatch">
              <span>{key}</span>
              <input
                type="color"
                value={hex}
                onChange={(event) =>
                  setPaletteValue((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </label>
          ))}
        </div>
      )}

      {initial.kind === 'data' && (
        <label className="asset-creator__field">
          <span>JSON object</span>
          <textarea rows={6} value={dataValue} onChange={(event) => setDataValue(event.target.value)} />
        </label>
      )}

      {error && <div className="asset-creator__error">{error}</div>}

      <div className="asset-creator__actions">
        <button type="button" className="button" onClick={onCancel}>
          cancel
        </button>
        <button type="button" className="button button--prim" onClick={submit}>
          save
        </button>
      </div>
    </div>
  );
}

function emptyBody(kind: 'text' | 'ascii' | 'palette' | 'data'): ProjectAssetBody {
  if (kind === 'text') return { kind: 'text', text: '' };
  if (kind === 'ascii') return { kind: 'ascii', lines: [] };
  if (kind === 'palette') return { kind: 'palette', tones: DEFAULT_PALETTE };
  return { kind: 'data', data: {} };
}

function defaultName(kind: 'text' | 'ascii' | 'palette' | 'data'): string {
  if (kind === 'text') return 'snippet';
  if (kind === 'ascii') return 'frame';
  if (kind === 'palette') return 'palette';
  return 'data';
}

function extractBody(asset: ProjectAsset): ProjectAssetBody {
  if (asset.kind === 'text') return { kind: 'text', text: asset.text };
  if (asset.kind === 'ascii') return { kind: 'ascii', lines: asset.lines };
  if (asset.kind === 'palette') return { kind: 'palette', tones: asset.tones };
  if (asset.kind === 'data') return { kind: 'data', data: asset.data };
  if (asset.kind === 'image-ascii')
    return {
      kind: 'image-ascii',
      ascii: asset.ascii,
      sourceWidth: asset.sourceWidth,
      sourceHeight: asset.sourceHeight,
      cols: asset.cols,
      rows: asset.rows,
      sourcePngBase64: asset.sourcePngBase64,
    };
  return { kind: 'subscene', sceneId: asset.sceneId };
}
