import type { EventFlags, ParsedLine, ParsedScene, SceneEvent, SceneMarker } from './types';

export const DEFAULT_DSL = `scene boot_sequence_v3 2.4s
# three status OKs stagger in, typed one glyph per tick
at 0ms    type "[OK] phosphor buffer - 240x67 cells" slowly
at 400ms  type "[OK] palette loaded - 6 tones"
at 800ms  type "[OK] clock locked - 30 Hz"

# warming beat - amber pulse that breathes for 600ms
at 1200ms pulse "[..] warming phosphor" amber 600ms

# glitch + land the system ready
at 2000ms glitch "SYSTEM READY" 80ms burst
at 2080ms reveal "> SYSTEM READY"
at 2080ms cursor "_" blink 500ms`;

const SCENE_RE = /^scene\s+([a-zA-Z0-9_-]+)\s+(\d+(?:\.\d+)?(?:ms|s))\s*$/;
const EVENT_RE = /^at\s+(\d+(?:\.\d+)?(?:ms|s))\s+([a-zA-Z][a-zA-Z0-9-]*)\s*(.*)$/;
const MARKER_RE = /^mark\s+"([^"]*)"\s+(\d+(?:\.\d+)?(?:ms|s))\s*$/;
const QUOTED_RE = /"([^"]*)"/;
const FLAG_TOKENS = new Set(['muted', 'solo', 'locked']);

export function parseScene(source: string): ParsedScene {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const parsedLines: ParsedLine[] = [];
  const events: SceneEvent[] = [];
  const markers: SceneMarker[] = [];
  let name = 'untitled_scene';
  let duration = 2400;

  lines.forEach((raw, index) => {
    const number = index + 1;
    const trimmed = raw.trim();

    if (!trimmed) {
      parsedLines.push({ kind: 'blank', number, raw });
      return;
    }

    if (trimmed.startsWith('#')) {
      parsedLines.push({ kind: 'comment', number, raw });
      return;
    }

    const sceneMatch = trimmed.match(SCENE_RE);
    if (sceneMatch) {
      name = sceneMatch[1];
      duration = parseTime(sceneMatch[2]) ?? duration;
      parsedLines.push({ kind: 'scene', number, raw, name, duration });
      return;
    }

    const markerMatch = trimmed.match(MARKER_RE);
    if (markerMatch) {
      const at = parseTime(markerMatch[2]);
      if (at === null) {
        parsedLines.push({ kind: 'invalid', number, raw, error: `Invalid marker time: ${markerMatch[2]}` });
        return;
      }
      const marker: SceneMarker = {
        id: `mark-${number}-${at}`,
        line: number,
        name: markerMatch[1],
        at,
        raw,
      };
      markers.push(marker);
      parsedLines.push({ kind: 'marker', number, raw, marker });
      return;
    }

    const eventMatch = trimmed.match(EVENT_RE);
    if (!eventMatch) {
      parsedLines.push({
        kind: 'invalid',
        number,
        raw,
        error: 'Expected: at 1200ms effect "target" modifiers',
      });
      return;
    }

    const [, timeToken, effect, tail] = eventMatch;
    const at = parseTime(timeToken);
    if (at === null) {
      parsedLines.push({ kind: 'invalid', number, raw, error: `Invalid time anchor: ${timeToken}` });
      return;
    }

    const quoteMatch = tail.match(QUOTED_RE);
    const target = quoteMatch?.[1] ?? '';
    const rawModifiers = tail.replace(QUOTED_RE, '').trim().replace(/\s+/g, ' ');
    const flags = extractFlags(rawModifiers);
    const event: SceneEvent = {
      id: `${number}-${effect}-${at}`,
      line: number,
      at,
      effect,
      target,
      modifiers: rawModifiers,
      raw,
      flags,
    };

    events.push(event);
    parsedLines.push({ kind: 'event', number, raw, event });
  });

  const maxEventTime = events.reduce((max, event) => Math.max(max, event.at + estimateEventDuration(event)), 0);
  return {
    name,
    duration: Math.max(duration, maxEventTime, 1000),
    events: events.sort((a, b) => a.at - b.at || a.line - b.line),
    markers: markers.sort((a, b) => a.at - b.at),
    lines: parsedLines,
  };
}

export function extractFlags(modifiers: string): EventFlags {
  const tokens = new Set(modifiers.split(/\s+/).filter(Boolean));
  return {
    muted: tokens.has('muted'),
    solo: tokens.has('solo'),
    locked: tokens.has('locked'),
  };
}

export function isFlagToken(token: string): boolean {
  return FLAG_TOKENS.has(token);
}

export function parseTime(token: string): number | null {
  const match = token.trim().match(/^(\d+(?:\.\d+)?)(ms|s)$/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return match[2] === 's' ? Math.round(value * 1000) : Math.round(value);
}

export function parseFirstDuration(modifiers: string): number | null {
  const match = modifiers.match(/(\d+(?:\.\d+)?(?:ms|s))/);
  return match ? parseTime(match[1]) : null;
}

export function estimateEventDuration(event: SceneEvent, tickRate = 30): number {
  if (event.effect === 'type') {
    const ticksPerChar = event.modifiers.includes('slowly') ? 2 : 1;
    return Math.ceil((event.target.length * ticksPerChar * 1000) / tickRate);
  }
  if (
    event.effect === 'pulse' ||
    event.effect === 'glitch' ||
    event.effect === 'flash' ||
    event.effect === 'scan-line' ||
    event.effect === 'wipe' ||
    event.effect === 'shake'
  ) {
    return parseFirstDuration(event.modifiers) ?? 160;
  }
  if (event.effect === 'trail' || event.effect === 'decay-trail') return parseTrailDuration(event.modifiers) ?? 600;
  if (event.effect === 'dither' || event.effect === 'wave') return parseFirstDuration(event.modifiers) ?? 1000;
  if (event.effect === 'cursor' || event.effect === 'cursor-blink') {
    return 800;
  }
  if (event.effect === 'loop') return 1000;
  return 120;
}

export function eventTone(event: SceneEvent) {
  if (event.modifiers.includes('amber')) return 'amber';
  if (event.modifiers.includes('red')) return 'red';
  if (event.modifiers.includes('cyan')) return 'cyan';
  if (event.modifiers.includes('magenta')) return 'magenta';
  if (event.target.startsWith('[OK]')) return 'green';
  if (event.effect === 'glitch') return 'magenta';
  if (event.effect === 'scan-line' || event.effect === 'wave') return 'cyan';
  if (event.effect === 'shake' || event.effect === 'flash') return 'red';
  if (event.effect === 'loop') return 'green';
  return 'phos';
}

function parseTrailDuration(modifiers: string) {
  const step = modifiers.match(/(\d+(?:\.\d+)?(?:ms|s))\/step/);
  const stepDuration = step ? parseTime(step[1]) : null;
  if (!stepDuration) return null;
  const points = modifiers.match(/path\(([^)]*)\)/)?.[1]?.trim();
  if (!points) return stepDuration;
  return points.split(/\s+/).filter(Boolean).length * stepDuration;
}
