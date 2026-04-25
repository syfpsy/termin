import { parseScene } from '../engine/dsl';
import { listProjects, readLegacyScenes, saveProject } from './projectDb';
import { makeEmptyProject, type Project, type ProjectScene } from './projectSchema';

const ACTIVE_PROJECT_KEY = 'phosphor.active.project';
const LEGACY_DSL_KEY = 'phosphor.scene.dsl';
const LEGACY_RECENTS_KEY = 'phosphor.recents';

type LegacyRecent = { id: string; name: string; dsl: string; updatedAt: number };

/**
 * Find the active project. If none exists, build one from legacy state
 * (localStorage DSL + recent scenes ring + orphan IndexedDB scenes).
 *
 * Idempotent: calling it twice returns the same project. Safe to call on
 * every app boot — the migration cost is paid once.
 */
export async function loadOrInitActiveProject(seedDsl: string): Promise<Project> {
  const stored = readActiveProjectId();
  if (stored) {
    const projects = await listProjects();
    const found = projects.find((project) => project.id === stored);
    if (found) return found;
    const fallback = projects[0];
    if (fallback) {
      writeActiveProjectId(fallback.id);
      return fallback;
    }
  }

  const projects = await listProjects();
  if (projects.length > 0) {
    const newest = projects[0];
    writeActiveProjectId(newest.id);
    return newest;
  }

  const migrated = await buildProjectFromLegacy(seedDsl);
  await saveProject(migrated);
  writeActiveProjectId(migrated.id);
  return migrated;
}

export function readActiveProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_PROJECT_KEY);
}

export function writeActiveProjectId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id) window.localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  else window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
}

async function buildProjectFromLegacy(seedDsl: string): Promise<Project> {
  const project = makeEmptyProject('My project', seedDsl, deriveSceneName(seedDsl));

  const recents = readLegacyRecents();
  const legacyScenes = await readLegacyScenes();
  const seen = new Set([sceneSignature(seedDsl)]);
  const extras: ProjectScene[] = [];

  for (const recent of recents) {
    const sig = sceneSignature(recent.dsl);
    if (seen.has(sig)) continue;
    seen.add(sig);
    extras.push(toProjectScene(recent.name, recent.dsl, recent.updatedAt));
  }

  for (const scene of legacyScenes) {
    const sig = sceneSignature(scene.dsl);
    if (seen.has(sig)) continue;
    seen.add(sig);
    extras.push(toProjectScene(scene.name, scene.dsl, scene.updatedAt));
  }

  if (extras.length > 0) {
    project.scenes = [...project.scenes, ...extras];
  }

  // Cache duration on the active scene so the project panel can show it.
  const active = project.scenes.find((scene) => scene.id === project.activeSceneId);
  if (active) active.durationMs = inferDurationMs(active.dsl);

  return project;
}

function readLegacyRecents(): LegacyRecent[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(LEGACY_RECENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LegacyRecent[];
    return Array.isArray(parsed)
      ? parsed.filter((r) => r && typeof r.dsl === 'string' && typeof r.name === 'string' && r.dsl.trim())
      : [];
  } catch {
    return [];
  }
}

function toProjectScene(name: string, dsl: string, updatedAt: number | string): ProjectScene {
  const iso =
    typeof updatedAt === 'number' ? new Date(updatedAt).toISOString() : new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: deriveSceneName(dsl, name),
    dsl,
    durationMs: inferDurationMs(dsl),
    createdAt: iso,
    updatedAt: iso,
  };
}

function deriveSceneName(dsl: string, fallback?: string): string {
  try {
    const scene = parseScene(dsl);
    if (scene.name) return scene.name;
  } catch {
    // ignore — fall through
  }
  return fallback?.trim() || 'untitled_scene';
}

function inferDurationMs(dsl: string): number {
  try {
    const scene = parseScene(dsl);
    return scene.duration > 0 ? scene.duration : 1000;
  } catch {
    return 1000;
  }
}

function sceneSignature(dsl: string): string {
  // Hash the trimmed DSL so two scenes with cosmetic whitespace differences
  // do not get duplicated during migration.
  let hash = 0;
  const trimmed = dsl.trim();
  for (let i = 0; i < trimmed.length; i += 1) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

/** Drop the legacy keys after a successful migration so we do not double-import. */
export function clearLegacyState(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LEGACY_DSL_KEY);
  window.localStorage.removeItem(LEGACY_RECENTS_KEY);
}
