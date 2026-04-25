import type { ProjectAsset } from './projectSchema';

/**
 * Turn an asset into one or more `.me` source fragments to insert at a
 * given playhead time. The exact text depends on the asset kind:
 *
 * - text   → a single `at <ms>ms type "<text>"` line (slowly cadence)
 * - ascii  → one `type` per line, staggered 200ms apart, on a fixed row
 * - data   → handled separately (apply to the whole scene, see below)
 * - palette → handled separately (applies to scene appearance)
 * - subscene → reserved for the deferred pre-comp playback
 */
export function assetToEventLines(asset: ProjectAsset, atMs: number): string[] {
  const safeAt = Math.max(0, Math.round(atMs));
  if (asset.kind === 'text') {
    const text = sanitizeQuoted(asset.text);
    return [`at ${safeAt}ms type "${text}" slowly`];
  }
  if (asset.kind === 'ascii') {
    return asset.lines.map((line, index) => {
      const text = sanitizeQuoted(line);
      const time = safeAt + index * 200;
      return `at ${time}ms type "${text}"`;
    });
  }
  if (asset.kind === 'image-ascii') {
    // Treat the rendered ascii as multi-line ascii art.
    return asset.ascii
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line, index) => {
        const text = sanitizeQuoted(line);
        const time = safeAt + index * 100;
        return `at ${time}ms type "${text}"`;
      });
  }
  return [];
}

/**
 * Inserts one or more `at` lines into a scene source, preserving the
 * `scene` header (line 0) and any existing `data {}` lines (always at
 * the top). The new lines are appended to the end so existing line
 * references in the editor stay stable.
 */
export function insertEventLinesIntoSource(source: string, lines: string[]): string {
  if (lines.length === 0) return source;
  const trimmed = source.replace(/\s+$/, '');
  return `${trimmed}\n${lines.join('\n')}\n`;
}

/**
 * Replace the existing `data { ... }` block in a scene source with a
 * fresh JSON payload. If no data line exists, inject one immediately
 * after the `scene` header. Returns the updated source.
 */
export function applyDataAssetToSource(source: string, data: Record<string, unknown>): string {
  const json = JSON.stringify(data);
  const dataLine = `data ${json}`;
  const lines = source.split('\n');
  const sceneLineIndex = lines.findIndex((line) => /^\s*scene\b/.test(line));
  const insertIndex = sceneLineIndex >= 0 ? sceneLineIndex + 1 : 0;

  // Remove every existing data line, regardless of position.
  const withoutData = lines.filter((line) => !/^\s*data\s*\{/.test(line));
  // Recompute the insert index after removal (we know the scene line
  // is still present at sceneLineIndex if it ever was).
  const newSceneIndex = sceneLineIndex >= 0
    ? withoutData.findIndex((line) => /^\s*scene\b/.test(line))
    : -1;
  const finalIndex = newSceneIndex >= 0 ? newSceneIndex + 1 : 0;
  withoutData.splice(finalIndex, 0, dataLine);
  return withoutData.join('\n');
}

function sanitizeQuoted(text: string): string {
  // The `.me` parser expects double-quoted strings; the safest sanitization
  // is to strip embedded quotes and collapse newlines/tabs to single spaces.
  return text.replace(/"/g, '').replace(/\s+/g, ' ').trim();
}

/** Short, human-readable preview line for the asset bin row. */
export function assetPreview(asset: ProjectAsset): string {
  if (asset.kind === 'text') return truncate(asset.text, 36);
  if (asset.kind === 'ascii') return `${asset.lines.length} line${asset.lines.length === 1 ? '' : 's'}`;
  if (asset.kind === 'palette') {
    return `${Object.keys(asset.tones).length} tones`;
  }
  if (asset.kind === 'data') return truncate(JSON.stringify(asset.data), 36);
  if (asset.kind === 'image-ascii') return `${asset.cols}×${asset.rows}`;
  if (asset.kind === 'subscene') return `→ ${asset.sceneId.slice(0, 6)}`;
  return '';
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}
