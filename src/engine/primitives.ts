import { parseFirstDuration } from './dsl';
import type { Grid } from './grid';
import { sampleEventParam } from './keyframes';
import type { ParsedScene, SceneEvent, ToneName } from './types';

type PrimitiveContext = {
  grid: Grid;
  scene: ParsedScene;
  timeMs: number;
  tick: number;
  tickRate: number;
  layout: SceneLayout;
  /** Per-event multiplier on every cell write. 1.0 means no animation override. */
  intensityScale: number;
};

type SceneLayout = {
  x: number;
  rowsByEvent: Map<string, number>;
  rowsByTarget: Map<string, number>;
  fallbackCursorRow: number;
};

const GLITCH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&$*@░▒▓█<>?/\\';
const DITHER_PATTERN = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function evaluateScene(scene: ParsedScene, grid: Grid, tick: number, tickRate: number) {
  grid.clear();
  const timeMs = Math.round((tick * 1000) / tickRate);
  const layout = buildLayout(scene, grid.rows);

  grid.writeText(4, 1, `PHOSPHOR / ${scene.name}`, 'inkDim', 0.45);

  const ctx: PrimitiveContext = { grid, scene, timeMs, tick, tickRate, layout, intensityScale: 1 };
  const hasSolo = scene.events.some((event) => event.flags.solo && !event.flags.muted);
  for (const event of scene.events) {
    if (timeMs < event.at) continue;
    if (event.flags.muted) continue;
    if (hasSolo && !event.flags.solo) continue;
    ctx.intensityScale = sampleEventParam(scene.animations, event.line, 'intensity', timeMs, 1);
    applyPrimitive(event, ctx);
  }
  ctx.intensityScale = 1;
}

/** Clamp + scale an intensity value by the active per-event multiplier. */
function scaled(intensity: number, ctx: PrimitiveContext): number {
  const value = intensity * ctx.intensityScale;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function applyPrimitive(event: SceneEvent, ctx: PrimitiveContext) {
  switch (event.effect) {
    case 'type':
      drawType(event, ctx);
      break;
    case 'pulse':
      drawPulse(event, ctx);
      break;
    case 'glitch':
      drawGlitch(event, ctx);
      break;
    case 'reveal':
      drawReveal(event, ctx);
      break;
    case 'cursor':
    case 'cursor-blink':
      drawCursor(event, ctx);
      break;
    case 'scan-line':
      drawScanLine(event, ctx);
      break;
    case 'trail':
    case 'decay-trail':
      drawDecayTrail(event, ctx);
      break;
    case 'dither':
      drawDither(event, ctx);
      break;
    case 'wave':
      drawWave(event, ctx);
      break;
    case 'wipe':
      drawWipe(event, ctx);
      break;
    case 'loop':
      drawLoop(event, ctx);
      break;
    case 'shake':
      drawShake(event, ctx);
      break;
    case 'flash':
      drawFlash(event, ctx);
      break;
    case 'counter':
      drawCounter(event, ctx);
      break;
    default:
      drawUnknown(event, ctx);
  }
}

function drawType(event: SceneEvent, ctx: PrimitiveContext) {
  const elapsedTicks = Math.max(0, Math.floor(((ctx.timeMs - event.at) * ctx.tickRate) / 1000));
  const ticksPerChar = event.modifiers.includes('slowly') ? 2 : 1;
  const visible = Math.min(event.target.length, Math.floor(elapsedTicks / ticksPerChar) + 1);
  const text = event.target.slice(0, visible);
  ctx.grid.writeText(ctx.layout.x, rowForEvent(event, ctx.layout), text, toneForEvent(event), scaled(1, ctx));
}

function drawPulse(event: SceneEvent, ctx: PrimitiveContext) {
  const duration = parseFirstDuration(event.modifiers) ?? 600;
  const elapsed = ctx.timeMs - event.at;
  if (elapsed > duration) return;
  const phase = Math.max(0, Math.min(1, elapsed / duration));
  const intensity = Math.sin(phase * Math.PI);
  ctx.grid.writeText(ctx.layout.x, rowForEvent(event, ctx.layout), event.target, toneForEvent(event), scaled(intensity, ctx));
}

function drawGlitch(event: SceneEvent, ctx: PrimitiveContext) {
  const duration = parseFirstDuration(event.modifiers) ?? 80;
  const elapsed = ctx.timeMs - event.at;
  if (elapsed > duration) return;

  const rng = mulberry32((event.at + 1) * 1009 + ctx.tick * 9176);
  const chars = event.target.split('').map((char, index) => {
    if (char === ' ') return char;
    return rng() > 0.55 ? GLITCH_CHARS[Math.floor(rng() * GLITCH_CHARS.length)] : char;
  });

  const row = rowForEvent(event, ctx.layout);
  ctx.grid.writeText(ctx.layout.x, row, chars.join(''), 'magenta', scaled(1, ctx));

  const burstCells = 18;
  for (let i = 0; i < burstCells; i += 1) {
    const c = Math.floor(rng() * ctx.grid.cols);
    const r = Math.max(3, Math.min(ctx.grid.rows - 2, row + Math.floor(rng() * 9) - 4));
    const ch = GLITCH_CHARS[Math.floor(rng() * GLITCH_CHARS.length)];
    const tone: ToneName = rng() > 0.6 ? 'cyan' : rng() > 0.35 ? 'magenta' : 'red';
    ctx.grid.set(c, r, ch, tone, scaled(0.45 + rng() * 0.55, ctx));
  }
}

function drawReveal(event: SceneEvent, ctx: PrimitiveContext) {
  ctx.grid.writeText(ctx.layout.x, rowForEvent(event, ctx.layout), event.target, toneForEvent(event), scaled(1, ctx));
}

function drawCursor(event: SceneEvent, ctx: PrimitiveContext) {
  const period = parseFirstDuration(event.modifiers) ?? 500;
  const elapsed = ctx.timeMs - event.at;
  const phase = (elapsed % period) / period;
  if (phase > 0.5) return;

  const row = ctx.layout.fallbackCursorRow;
  const relatedText = lastVisibleTargetBefore(ctx.scene, event.at);
  const c = ctx.layout.x + Math.min(relatedText.length + 1, ctx.grid.cols - ctx.layout.x - 2);
  ctx.grid.set(c, row, event.target || '_', 'ink', scaled(1, ctx));
}

function drawScanLine(event: SceneEvent, ctx: PrimitiveContext) {
  const duration = parseFirstDuration(event.modifiers) ?? 400;
  const elapsed = ctx.timeMs - event.at;
  if (elapsed > duration) return;
  const explicitRow = event.modifiers.match(/row\s+(\d+)/)?.[1];
  const progress = Math.max(0, Math.min(1, elapsed / duration));
  const row = explicitRow ? Number(explicitRow) : Math.floor(progress * (ctx.grid.rows - 1));
  for (let c = 0; c < ctx.grid.cols; c += 1) {
    const char = c % 2 === 0 ? '─' : ' ';
    ctx.grid.set(c, row, char, 'cyan', scaled(0.95, ctx));
    if (row > 0) ctx.grid.set(c, row - 1, char, 'cyan', scaled(0.2, ctx));
  }
}

function drawDecayTrail(event: SceneEvent, ctx: PrimitiveContext) {
  const points = parsePathPoints(event.modifiers, ctx.grid);
  if (!points.length) return;
  const stepMs = parseStepDuration(event.modifiers) ?? 30;
  const elapsed = ctx.timeMs - event.at;
  const index = Math.min(points.length - 1, Math.floor(elapsed / stepMs));
  if (elapsed > points.length * stepMs) return;
  const point = points[index];
  ctx.grid.set(point.x, point.y, event.target || '*', toneForEvent(event), scaled(1, ctx));
}

function drawDither(event: SceneEvent, ctx: PrimitiveContext) {
  const duration = parseFirstDuration(event.modifiers) ?? 1000;
  const elapsed = ctx.timeMs - event.at;
  if (elapsed > duration) return;
  const progress = Math.max(0, Math.min(1, elapsed / duration));
  const yStart = Math.max(4, rowForEvent(event, ctx.layout) - 1);
  const height = 7;
  const width = Math.min(ctx.grid.cols - ctx.layout.x - 6, 46);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const threshold = (DITHER_PATTERN[y % 4][x % 4] + 1) / 17;
      if (threshold <= progress) {
        const char = threshold > 0.75 ? '█' : threshold > 0.5 ? '▓' : threshold > 0.25 ? '▒' : '░';
        ctx.grid.set(ctx.layout.x + x, yStart + y, char, 'phos', scaled(0.35 + progress * 0.65, ctx));
      }
    }
  }
}

function drawWave(event: SceneEvent, ctx: PrimitiveContext) {
  const duration = parseFirstDuration(event.modifiers) ?? 2000;
  const elapsed = ctx.timeMs - event.at;
  if (elapsed > duration) return;
  const phase = (elapsed / duration) * Math.PI * 2;
  const text = event.target || '~~~~~~~~ PHOSPHOR CARRIER ~~~~~~~~';
  const row = rowForEvent(event, ctx.layout);
  for (let i = 0; i < text.length; i += 1) {
    const y = row + Math.round(Math.sin(phase + i * 0.45) * 2);
    ctx.grid.set(ctx.layout.x + i, y, text[i], 'cyan', scaled(0.85, ctx));
  }
}

function drawWipe(event: SceneEvent, ctx: PrimitiveContext) {
  const duration = parseFirstDuration(event.modifiers) ?? 400;
  const elapsed = ctx.timeMs - event.at;
  if (elapsed > duration) return drawReveal(event, ctx);
  const progress = Math.max(0, Math.min(1, elapsed / duration));
  const row = rowForEvent(event, ctx.layout);
  const text = event.target || 'WIPE';
  for (let i = 0; i < text.length; i += 1) {
    const distance = (i + row * 0.35) / (text.length + ctx.grid.rows * 0.35);
    if (distance <= progress) ctx.grid.set(ctx.layout.x + i, row, text[i], toneForEvent(event), scaled(1, ctx));
  }
}

function drawLoop(event: SceneEvent, ctx: PrimitiveContext) {
  const elapsed = ctx.timeMs - event.at;
  const phase = (elapsed % 1000) / 1000;
  const frames = ['◢◣', '◣◤', '◤◥', '◥◢'];
  const frame = frames[Math.floor(phase * frames.length) % frames.length];
  const text = event.target || `${frame.repeat(10)} LOOP ${frame.repeat(10)}`;
  ctx.grid.writeText(ctx.layout.x, rowForEvent(event, ctx.layout), text, 'green', scaled(0.7 + Math.sin(phase * Math.PI * 2) * 0.25, ctx));
}

function drawShake(event: SceneEvent, ctx: PrimitiveContext) {
  const duration = parseFirstDuration(event.modifiers) ?? 200;
  const elapsed = ctx.timeMs - event.at;
  if (elapsed > duration) return;
  const rng = mulberry32(event.at * 41 + ctx.tick * 131);
  const amount = Number(event.modifiers.match(/(\d+)px/)?.[1] ?? 3);
  const row = rowForEvent(event, ctx.layout);
  const offset = Math.round((rng() * 2 - 1) * amount);
  ctx.grid.writeText(Math.max(0, ctx.layout.x + offset), row, event.target || 'SHAKE', 'red', scaled(1, ctx));
}

function drawFlash(event: SceneEvent, ctx: PrimitiveContext) {
  const duration = parseFirstDuration(event.modifiers) ?? 80;
  const elapsed = ctx.timeMs - event.at;
  if (elapsed > duration) return;
  const intensity = 1 - elapsed / duration;
  for (let r = 0; r < ctx.grid.rows; r += 1) {
    for (let c = 0; c < ctx.grid.cols; c += 1) {
      if ((c + r) % 5 === 0) ctx.grid.set(c, r, ' ', 'phos', scaled(intensity * 0.35, ctx));
    }
  }
}

function drawUnknown(event: SceneEvent, ctx: PrimitiveContext) {
  const label = `${event.effect} ${event.target}`.trim();
  ctx.grid.writeText(ctx.layout.x, rowForEvent(event, ctx.layout), label, 'inkDim', scaled(0.65, ctx));
}

const COUNTER_FROM_RE = /\bfrom\s+(-?\d+(?:\.\d+)?)/;
const COUNTER_TO_RE = /\bto\s+(-?\d+(?:\.\d+)?)/;
const COUNTER_EASING_RE = /\b(linear|ease-in-out|ease-in|ease-out|hold)\b/;
const COUNTER_FORMAT_RE = /\bformat:(\w+)/;

function drawCounter(event: SceneEvent, ctx: PrimitiveContext) {
  const fromMatch = event.modifiers.match(COUNTER_FROM_RE);
  const toMatch = event.modifiers.match(COUNTER_TO_RE);
  const from = fromMatch ? Number(fromMatch[1]) : 0;
  const to = toMatch ? Number(toMatch[1]) : from;
  const duration = parseFirstDuration(event.modifiers) ?? 800;
  const easingMatch = event.modifiers.match(COUNTER_EASING_RE);
  const easing = (easingMatch?.[1] ?? 'ease-out') as
    | 'linear'
    | 'ease-in'
    | 'ease-out'
    | 'ease-in-out'
    | 'hold';
  const formatMatch = event.modifiers.match(COUNTER_FORMAT_RE);
  const format = formatMatch?.[1];

  const elapsed = ctx.timeMs - event.at;
  const t = duration > 0 ? Math.max(0, Math.min(1, elapsed / duration)) : 1;
  const eased = applyCounterEasing(easing, t);
  const value = from + (to - from) * eased;

  const text = `${event.target}${formatCounterValue(value, from, to, format)}`;
  ctx.grid.writeText(
    ctx.layout.x,
    rowForEvent(event, ctx.layout),
    text,
    toneForEvent(event),
    scaled(1, ctx),
  );
}

function applyCounterEasing(
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold',
  t: number,
): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  switch (easing) {
    case 'linear':
      return t;
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return 1 - (1 - t) * (1 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    case 'hold':
      return 0;
    default:
      return t;
  }
}

function formatCounterValue(value: number, from: number, to: number, format: string | undefined): string {
  if (format === 'k' || format === 'thousands') {
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
    return formatCounterRaw(value, from, to);
  }
  if (format === 'pct' || format === 'percent') {
    const pct = value * 100;
    return `${pct.toFixed(Math.abs(pct - Math.round(pct)) < 0.05 ? 0 : 1)}%`;
  }
  return formatCounterRaw(value, from, to);
}

function formatCounterRaw(value: number, from: number, to: number): string {
  const integerEndpoints = Number.isInteger(from) && Number.isInteger(to);
  const display = integerEndpoints ? Math.round(value) : Number(value.toFixed(2));
  const absMax = Math.max(Math.abs(from), Math.abs(to));
  if (integerEndpoints && absMax >= 1000) {
    return display.toLocaleString('en-US');
  }
  return display.toString();
}

function buildLayout(scene: ParsedScene, rows: number): SceneLayout {
  const rowsByEvent = new Map<string, number>();
  const rowsByTarget = new Map<string, number>();
  let row = 5;
  let fallbackCursorRow = row;

  for (const event of scene.events) {
    if (event.effect === 'cursor' || event.effect === 'cursor-blink' || event.effect === 'flash' || event.effect === 'scan-line') continue;

    const targetKey = stableTargetKey(event);
    const existingRow = rowsByTarget.get(targetKey);
    const eventRow = existingRow ?? row;
    rowsByEvent.set(event.id, eventRow);
    rowsByTarget.set(targetKey, eventRow);
    fallbackCursorRow = eventRow;

    if (existingRow === undefined) row = Math.min(row + 3, rows - 4);
  }

  return {
    x: 6,
    rowsByEvent,
    rowsByTarget,
    fallbackCursorRow,
  };
}

function rowForEvent(event: SceneEvent, layout: SceneLayout) {
  return layout.rowsByEvent.get(event.id) ?? layout.rowsByTarget.get(stableTargetKey(event)) ?? layout.fallbackCursorRow;
}

function stableTargetKey(event: SceneEvent) {
  return event.target.replace(/^[>\s]+/, '').trim().toLowerCase() || `${event.effect}-${event.line}`;
}

function lastVisibleTargetBefore(scene: ParsedScene, at: number) {
  const candidates = scene.events.filter((event) => event.at <= at && event.target && event.effect !== 'cursor');
  return candidates[candidates.length - 1]?.target ?? '';
}

function toneForEvent(event: SceneEvent): ToneName {
  if (event.modifiers.includes('amber')) return 'amber';
  if (event.modifiers.includes('cyan')) return 'cyan';
  if (event.modifiers.includes('red')) return 'red';
  if (event.modifiers.includes('magenta')) return 'magenta';
  if (event.target.startsWith('[OK]')) return 'green';
  if (event.effect === 'glitch') return 'magenta';
  if (event.effect === 'scan-line' || event.effect === 'wave') return 'cyan';
  if (event.effect === 'shake' || event.effect === 'flash') return 'red';
  if (event.effect === 'loop') return 'green';
  return 'phos';
}

function parsePathPoints(modifiers: string, grid: Grid) {
  const raw = modifiers.match(/path\(([^)]*)\)/)?.[1];
  if (!raw) {
    return Array.from({ length: 18 }, (_, i) => ({
      x: Math.min(grid.cols - 2, 6 + i * 2),
      y: Math.floor(grid.rows * 0.58 + Math.sin(i * 0.75) * 5),
    }));
  }
  return raw
    .split(/\s+/)
    .map((point) => {
      const [x, y] = point.split(',').map(Number);
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    })
    .filter((point): point is { x: number; y: number } => Boolean(point));
}

function parseStepDuration(modifiers: string) {
  const match = modifiers.match(/(\d+(?:\.\d+)?(?:ms|s))\/step/);
  if (!match) return null;
  const token = match[1];
  const value = Number(token.replace(/[a-z]/g, ''));
  if (!Number.isFinite(value)) return null;
  return token.endsWith('s') ? value * 1000 : value;
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
