/**
 * Render presets are a *global* concept on Phosphor — the user accumulates
 * render settings (codec, fps, palette, dimensions) once and applies them
 * to any project. They live in localStorage today and will sync to the
 * cloud library when the account layer ships.
 *
 * This is intentionally separate from `Project.renderPresets` (which we
 * keep for backwards compatibility with the schema). Future work merges
 * the two: project-local overrides shadow the global pool.
 */

import type { RenderPreset, RenderPresetOptions, RenderTarget } from './projectSchema';

const STORAGE_KEY = 'phosphor.render.presets';

export type RenderPresetCreate = {
  name: string;
  target: RenderTarget;
  options?: RenderPresetOptions;
};

export function listRenderPresets(): RenderPreset[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as RenderPreset[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPreset);
  } catch {
    return [];
  }
}

export function saveRenderPresets(presets: RenderPreset[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function addRenderPreset(input: RenderPresetCreate): RenderPreset[] {
  const all = listRenderPresets();
  const next: RenderPreset = {
    id: crypto.randomUUID(),
    name: input.name.trim() || 'Untitled preset',
    target: input.target,
    options: input.options ?? {},
    createdAt: new Date().toISOString(),
  };
  const merged = [...all, next];
  saveRenderPresets(merged);
  return merged;
}

export function removeRenderPreset(id: string): RenderPreset[] {
  const next = listRenderPresets().filter((preset) => preset.id !== id);
  saveRenderPresets(next);
  return next;
}

export function renameRenderPreset(id: string, name: string): RenderPreset[] {
  if (!name.trim()) return listRenderPresets();
  const next = listRenderPresets().map((preset) =>
    preset.id === id ? { ...preset, name: name.trim() } : preset,
  );
  saveRenderPresets(next);
  return next;
}

function isValidPreset(value: unknown): value is RenderPreset {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<RenderPreset>;
  if (typeof v.id !== 'string' || !v.id) return false;
  if (typeof v.name !== 'string') return false;
  if (typeof v.target !== 'string') return false;
  return true;
}
