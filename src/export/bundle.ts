import { estimateEventDuration, eventTone, parseScene } from '../engine/dsl';
import { DEFAULT_APPEARANCE, type Appearance, type ParsedScene, type TickRate } from '../engine/types';

export const PHOSPHOR_BUNDLE_SCHEMA_ID = 'phosphor.bundle.v1';
export const PHOSPHOR_BUNDLE_SCHEMA_URL = 'https://phosphor.dev/schemas/phosphor.bundle.v1.json';
export const PHOSPHOR_BUNDLE_MIME = 'application/vnd.phosphor.bundle+json';
export const PHOSPHOR_ENGINE_VERSION = '0.1.0';

export type PhosphorCompiledEvent = {
  id: string;
  line: number;
  atMs: number;
  durationMs: number;
  effect: string;
  target: string;
  modifiers: string;
  tone: string;
  raw: string;
};

export type PhosphorBundle = {
  $schema: typeof PHOSPHOR_BUNDLE_SCHEMA_URL;
  schema: typeof PHOSPHOR_BUNDLE_SCHEMA_ID;
  schemaVersion: 1;
  createdAt: string;
  runtime: {
    engine: 'phosphor';
    engineVersion: string;
    minPlayerVersion: string;
  };
  scene: {
    name: string;
    source: string;
    durationMs: number;
    grid: {
      cols: number;
      rows: number;
    };
    tickRate: TickRate;
    loop: {
      startMs: number;
      endMs: number;
    };
    events: PhosphorCompiledEvent[];
  };
  appearance: Appearance;
  assets: {
    fonts: string[];
    palettes: string[];
  };
  compatibility: {
    deterministic: true;
    portableRenderer: 'canvas';
    notes: string[];
  };
};

export type BundleValidationResult =
  | {
      ok: true;
      bundle: PhosphorBundle;
      errors: [];
    }
  | {
      ok: false;
      bundle?: PhosphorBundle;
      errors: string[];
    };

const GRID = { cols: 96, rows: 36 };
const TICK_RATES: TickRate[] = [24, 30, 60];
const CHROME_VALUES: Appearance['chrome'][] = ['bezel', 'flat', 'none'];
const MODE_VALUES: Appearance['mode'][] = ['color', '1-bit'];
const FONT_VALUES: Appearance['font'][] = ['vt323', 'plex', 'jet', 'atkinson', 'fira', 'space'];

export function buildPhosphorBundle({
  sceneName,
  dsl,
  appearance,
  createdAt = new Date().toISOString(),
}: {
  sceneName?: string;
  dsl: string;
  appearance: Appearance;
  createdAt?: string;
}): PhosphorBundle {
  const source = normalizeDsl(dsl);
  const parsed = parseScene(source);
  const normalizedAppearance = normalizeBundleAppearance(appearance);
  const name = sceneName?.trim() || parsed.name || 'phosphor_scene';

  return {
    $schema: PHOSPHOR_BUNDLE_SCHEMA_URL,
    schema: PHOSPHOR_BUNDLE_SCHEMA_ID,
    schemaVersion: 1,
    createdAt,
    runtime: {
      engine: 'phosphor',
      engineVersion: PHOSPHOR_ENGINE_VERSION,
      minPlayerVersion: PHOSPHOR_ENGINE_VERSION,
    },
    scene: {
      name,
      source,
      durationMs: parsed.duration,
      grid: GRID,
      tickRate: normalizedAppearance.tickRate,
      loop: {
        startMs: 0,
        endMs: parsed.duration,
      },
      events: compileEvents(parsed, normalizedAppearance.tickRate),
    },
    appearance: normalizedAppearance,
    assets: {
      fonts: [normalizedAppearance.font],
      palettes: ['phosphor-6'],
    },
    compatibility: {
      deterministic: true,
      portableRenderer: 'canvas',
      notes: [
        'The scene.source field is the editable .me contract.',
        'The scene.events array is a compiled JSON contract for web players and device runtimes.',
        'Renderers must clamp unknown appearance fields and ignore unknown top-level fields.',
      ],
    },
  };
}

export function serializePhosphorBundle(bundle: PhosphorBundle) {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export function validatePhosphorBundle(input: unknown): BundleValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ['Bundle must be a JSON object.'] };

  if (input.schema !== PHOSPHOR_BUNDLE_SCHEMA_ID) errors.push(`schema must be ${PHOSPHOR_BUNDLE_SCHEMA_ID}.`);
  if (input.schemaVersion !== 1) errors.push('schemaVersion must be 1.');

  const scene = isRecord(input.scene) ? input.scene : undefined;
  if (!scene) errors.push('scene object is required.');

  const source = typeof scene?.source === 'string' ? normalizeDsl(scene.source) : '';
  if (!source) errors.push('scene.source must contain .me notation.');
  if (!Array.isArray(scene?.events)) errors.push('scene.events array is required for portable runtimes.');

  const parsed = parseScene(source || 'scene invalid 1s');
  const invalidLines = parsed.lines.filter((line) => line.kind === 'invalid');
  if (invalidLines.length > 0) {
    errors.push(`scene.source contains ${invalidLines.length} invalid line(s).`);
  }

  const appearance = normalizeBundleAppearance(isRecord(input.appearance) ? input.appearance : {});
  const name = typeof scene?.name === 'string' && scene.name.trim() ? scene.name.trim() : parsed.name;
  const createdAt = typeof input.createdAt === 'string' && input.createdAt ? input.createdAt : new Date().toISOString();

  const bundle = buildPhosphorBundle({
    sceneName: name,
    dsl: source,
    appearance,
    createdAt,
  });

  if (errors.length) return { ok: false, bundle, errors };
  return { ok: true, bundle, errors: [] };
}

export function parsePhosphorBundleJson(text: string): BundleValidationResult {
  try {
    return validatePhosphorBundle(JSON.parse(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON.';
    return { ok: false, errors: [message] };
  }
}

export function isLikelyPhosphorBundleText(text: string) {
  return text.includes(PHOSPHOR_BUNDLE_SCHEMA_ID) || text.includes(PHOSPHOR_BUNDLE_MIME);
}

export function bundleFileName(sceneName: string) {
  return `${safeFileStem(sceneName || 'phosphor_scene')}.phosphor.json`;
}

export function meFileName(sceneName: string) {
  return `${safeFileStem(sceneName || 'phosphor_scene')}.me`;
}

export function htmlFileName(sceneName: string) {
  return `${safeFileStem(sceneName || 'phosphor_scene')}.html`;
}

export function normalizeBundleAppearance(input: Partial<Appearance>): Appearance {
  return {
    chrome: oneOf(input.chrome, CHROME_VALUES, DEFAULT_APPEARANCE.chrome),
    decay: clampNumber(input.decay, 0, 5000, DEFAULT_APPEARANCE.decay),
    bloom: clampNumber(input.bloom, 0, 8, DEFAULT_APPEARANCE.bloom),
    scanlines: clampNumber(input.scanlines, 0, 1, DEFAULT_APPEARANCE.scanlines),
    curvature: clampNumber(input.curvature, 0, 1, DEFAULT_APPEARANCE.curvature),
    flicker: clampNumber(input.flicker, 0, 1, DEFAULT_APPEARANCE.flicker),
    chromatic: clampNumber(input.chromatic, 0, 2, DEFAULT_APPEARANCE.chromatic),
    font: oneOf(input.font, FONT_VALUES, DEFAULT_APPEARANCE.font),
    sizeScale: clampNumber(input.sizeScale, 0.5, 2, DEFAULT_APPEARANCE.sizeScale),
    mode: oneOf(input.mode, MODE_VALUES, DEFAULT_APPEARANCE.mode),
    tickRate: oneOf(input.tickRate, TICK_RATES, DEFAULT_APPEARANCE.tickRate),
  };
}

function compileEvents(scene: ParsedScene, tickRate: TickRate): PhosphorCompiledEvent[] {
  return scene.events.map((event) => ({
    id: event.id,
    line: event.line,
    atMs: event.at,
    durationMs: estimateEventDuration(event, tickRate),
    effect: event.effect,
    target: event.target,
    modifiers: event.modifiers,
    tone: eventTone(event),
    raw: event.raw,
  }));
}

function normalizeDsl(dsl: string) {
  return dsl.replace(/\r\n/g, '\n').trimEnd();
}

function safeFileStem(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'phosphor_scene';
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function oneOf<T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
