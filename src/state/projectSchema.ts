/**
 * Phosphor project schema — the source-of-truth shape for everything a
 * project owns: scenes, assets, render presets, and forward-compat slots.
 *
 * Future-proofing notes:
 * - Every entity has a stable `id` (UUID) and `updatedAt` so a future cloud
 *   sync layer can do last-write-wins or CRDT diffs without a migration.
 * - `meta.syncId` and `meta.etag` are reserved for the cloud handoff.
 * - Pre-comp / nested-scene playback is deferred, but scenes carry stable
 *   ids and the asset bin already supports a `subscene` reference so the
 *   schema does not change when nested playback ships.
 * - Asset bodies are a discriminated union by `kind` so adding a new kind
 *   is purely additive — readers of an older version simply skip unknown
 *   kinds during play.
 */

export const PROJECT_SCHEMA_ID = 'phosphor.project.v1';
export const PROJECT_SCHEMA_VERSION = 1 as const;

export type ProjectId = string;
export type SceneId = string;
export type AssetId = string;
export type RenderPresetId = string;

export type Project = {
  schema: typeof PROJECT_SCHEMA_ID;
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  id: ProjectId;
  name: string;
  createdAt: string;
  updatedAt: string;
  activeSceneId: SceneId | null;
  scenes: ProjectScene[];
  assets: ProjectAsset[];
  renderPresets: RenderPreset[];
  meta: ProjectMeta;
};

export type ProjectMeta = {
  /** Cloud sync handle, populated when the project is linked to a remote. */
  syncId?: string;
  /** ETag for optimistic concurrency on cloud writes. */
  etag?: string;
  /** Free-form notes from the user or the director. */
  notes?: string;
};

export type ProjectScene = {
  id: SceneId;
  name: string;
  dsl: string;
  /** Cached duration in milliseconds; recomputed on save. */
  durationMs: number;
  /** Optional poster frame as a small base64 PNG for the project panel. */
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectAsset = {
  id: AssetId;
  name: string;
  createdAt: string;
  updatedAt: string;
} & ProjectAssetBody;

export type ProjectAssetBody =
  | { kind: 'text'; text: string }
  | { kind: 'ascii'; lines: string[] }
  | { kind: 'palette'; tones: PalettePayload }
  | { kind: 'data'; data: Record<string, unknown> }
  | {
      kind: 'image-ascii';
      ascii: string;
      sourceWidth: number;
      sourceHeight: number;
      cols: number;
      rows: number;
      sourcePngBase64?: string;
    }
  /** Reference to another scene in the same project (pre-comp, deferred playback). */
  | { kind: 'subscene'; sceneId: SceneId };

export type PaletteTone = keyof PalettePayload;

export type PalettePayload = {
  phos: string;
  phosDim: string;
  amber: string;
  amberDim: string;
  green: string;
  red: string;
  cyan: string;
  magenta: string;
  ink: string;
  inkDim: string;
  inkMuted: string;
  inkFaint: string;
  ink2: string;
};

export type RenderTarget =
  | 'me'
  | 'html'
  | 'bundle'
  | 'gif'
  | 'mp4'
  | 'webm'
  | 'svg'
  | 'png-sequence'
  | 'loop-url';

export type RenderPreset = {
  id: RenderPresetId;
  name: string;
  target: RenderTarget;
  options: RenderPresetOptions;
  createdAt: string;
};

export type RenderPresetOptions = {
  width?: number;
  height?: number;
  fps?: number;
  loopCount?: number;
  /** Forward-compat — codec, quality, palette overrides land here. */
  [key: string]: unknown;
};

/**
 * Validate-and-normalize a foreign `Project` shape (e.g. parsed from a
 * `.phosphor.proj` file). Unknown top-level keys are dropped, missing
 * fields are filled with safe defaults, and any field with the wrong
 * type is replaced with its default. Returns `null` if the shape is so
 * broken it cannot be salvaged (e.g. wrong schema id).
 */
export function normalizeProject(input: unknown): Project | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<Project>;
  if (raw.schema !== PROJECT_SCHEMA_ID) return null;
  const schemaVersion = raw.schemaVersion === PROJECT_SCHEMA_VERSION ? PROJECT_SCHEMA_VERSION : null;
  if (schemaVersion === null) return null;

  const now = new Date().toISOString();
  const id = typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID();
  const name = typeof raw.name === 'string' && raw.name ? raw.name : 'Untitled project';
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : now;
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : now;

  const scenes = Array.isArray(raw.scenes)
    ? raw.scenes.map((scene) => normalizeScene(scene)).filter((scene): scene is ProjectScene => scene !== null)
    : [];

  const assets = Array.isArray(raw.assets)
    ? raw.assets.map((asset) => normalizeAsset(asset)).filter((asset): asset is ProjectAsset => asset !== null)
    : [];

  const renderPresets = Array.isArray(raw.renderPresets)
    ? raw.renderPresets
        .map((preset) => normalizePreset(preset))
        .filter((preset): preset is RenderPreset => preset !== null)
    : [];

  const activeSceneId =
    typeof raw.activeSceneId === 'string' && scenes.some((scene) => scene.id === raw.activeSceneId)
      ? raw.activeSceneId
      : scenes[0]?.id ?? null;

  const meta: ProjectMeta = raw.meta && typeof raw.meta === 'object' ? { ...raw.meta } : {};

  return {
    schema: PROJECT_SCHEMA_ID,
    schemaVersion,
    id,
    name,
    createdAt,
    updatedAt,
    activeSceneId,
    scenes,
    assets,
    renderPresets,
    meta,
  };
}

function normalizeScene(input: unknown): ProjectScene | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<ProjectScene>;
  const dsl = typeof raw.dsl === 'string' ? raw.dsl : '';
  if (!dsl.trim()) return null;
  const now = new Date().toISOString();
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
    name: typeof raw.name === 'string' && raw.name ? raw.name : 'untitled_scene',
    dsl,
    durationMs: typeof raw.durationMs === 'number' && raw.durationMs > 0 ? raw.durationMs : 1000,
    thumbnail: typeof raw.thumbnail === 'string' ? raw.thumbnail : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
  };
}

function normalizeAsset(input: unknown): ProjectAsset | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const kind = raw.kind;
  if (
    kind !== 'text' &&
    kind !== 'ascii' &&
    kind !== 'palette' &&
    kind !== 'data' &&
    kind !== 'image-ascii' &&
    kind !== 'subscene'
  ) {
    return null;
  }
  const now = new Date().toISOString();
  const base = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
    name: typeof raw.name === 'string' && raw.name ? raw.name : 'untitled_asset',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
  };

  if (kind === 'text') {
    return { ...base, kind, text: typeof raw.text === 'string' ? raw.text : '' };
  }
  if (kind === 'ascii') {
    const lines = Array.isArray(raw.lines) ? (raw.lines as unknown[]).map((line) => String(line)) : [];
    return { ...base, kind, lines };
  }
  if (kind === 'palette') {
    const tones = raw.tones;
    if (!tones || typeof tones !== 'object') return null;
    return { ...base, kind, tones: tones as PalettePayload };
  }
  if (kind === 'data') {
    const data = raw.data;
    return { ...base, kind, data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {} };
  }
  if (kind === 'image-ascii') {
    return {
      ...base,
      kind,
      ascii: typeof raw.ascii === 'string' ? raw.ascii : '',
      sourceWidth: typeof raw.sourceWidth === 'number' ? raw.sourceWidth : 0,
      sourceHeight: typeof raw.sourceHeight === 'number' ? raw.sourceHeight : 0,
      cols: typeof raw.cols === 'number' ? raw.cols : 0,
      rows: typeof raw.rows === 'number' ? raw.rows : 0,
      sourcePngBase64: typeof raw.sourcePngBase64 === 'string' ? raw.sourcePngBase64 : undefined,
    };
  }
  // subscene
  return {
    ...base,
    kind,
    sceneId: typeof raw.sceneId === 'string' ? raw.sceneId : '',
  };
}

function normalizePreset(input: unknown): RenderPreset | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<RenderPreset>;
  const target = raw.target;
  const valid: RenderTarget[] = ['me', 'html', 'bundle', 'gif', 'mp4', 'webm', 'svg', 'png-sequence', 'loop-url'];
  if (!target || !valid.includes(target as RenderTarget)) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
    name: typeof raw.name === 'string' && raw.name ? raw.name : 'Untitled preset',
    target: target as RenderTarget,
    options: raw.options && typeof raw.options === 'object' ? raw.options : {},
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

export function makeEmptyProject(name: string, firstSceneDsl: string, firstSceneName: string): Project {
  const now = new Date().toISOString();
  const sceneId = crypto.randomUUID();
  return {
    schema: PROJECT_SCHEMA_ID,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    activeSceneId: sceneId,
    scenes: [
      {
        id: sceneId,
        name: firstSceneName,
        dsl: firstSceneDsl,
        durationMs: 1000,
        createdAt: now,
        updatedAt: now,
      },
    ],
    assets: [],
    renderPresets: [],
    meta: {},
  };
}

export function patchScene(project: Project, sceneId: SceneId, patch: Partial<ProjectScene>): Project {
  const now = new Date().toISOString();
  return {
    ...project,
    updatedAt: now,
    scenes: project.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, ...patch, updatedAt: now } : scene,
    ),
  };
}

export function addScene(project: Project, scene: Omit<ProjectScene, 'id' | 'createdAt' | 'updatedAt'>): Project {
  const now = new Date().toISOString();
  const next: ProjectScene = {
    ...scene,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...project,
    updatedAt: now,
    activeSceneId: next.id,
    scenes: [...project.scenes, next],
  };
}

export function removeScene(project: Project, sceneId: SceneId): Project {
  if (project.scenes.length <= 1) return project; // never let the project go scene-less
  const remaining = project.scenes.filter((scene) => scene.id !== sceneId);
  const nextActive =
    project.activeSceneId === sceneId ? remaining[0]?.id ?? null : project.activeSceneId;
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    scenes: remaining,
    activeSceneId: nextActive,
  };
}

export function renameScene(project: Project, sceneId: SceneId, name: string): Project {
  return patchScene(project, sceneId, { name });
}

export function duplicateScene(project: Project, sceneId: SceneId): Project {
  const source = project.scenes.find((scene) => scene.id === sceneId);
  if (!source) return project;
  return addScene(project, {
    name: `${source.name}_copy`,
    dsl: source.dsl,
    durationMs: source.durationMs,
    thumbnail: source.thumbnail,
  });
}
