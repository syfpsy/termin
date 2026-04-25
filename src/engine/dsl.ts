import {
  isAnimatableAppearanceProp,
  isAnimatableEventParam,
  type AnimatableAppearanceProp,
  type AnimatableEventParam,
  type EasingKind,
  type EventFlags,
  type ParsedLine,
  type ParsedScene,
  type PropertyAnimation,
  type PropertyKeyframe,
  type SceneData,
  type SceneEvent,
  type SceneMarker,
} from './types';

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
const PROP_RE = /^prop\s+([a-zA-Z][a-zA-Z0-9-]*)\s+(.+)$/;
const DATA_RE = /^data\s+(\{.*\})\s*$/;
const TEMPLATE_RE = /\{\{\s*([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$0-9][\w$]*)*)\s*\}\}/g;
const QUOTED_RE = /"([^"]*)"/;
const FLAG_TOKENS = new Set(['muted', 'solo', 'locked']);
const EASING_TOKENS = new Set<EasingKind>(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'hold']);

export function parseScene(source: string): ParsedScene {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const parsedLines: ParsedLine[] = [];
  const events: SceneEvent[] = [];
  const markers: SceneMarker[] = [];
  const animations: PropertyAnimation[] = [];
  let data: SceneData = {};
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

    const dataMatch = trimmed.match(DATA_RE);
    if (dataMatch) {
      try {
        const parsed = JSON.parse(dataMatch[1]);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          parsedLines.push({
            kind: 'invalid',
            number,
            raw,
            error: 'data line expects a JSON object literal.',
          });
          return;
        }
        data = deepMergeData(data, parsed as SceneData);
        parsedLines.push({ kind: 'data', number, raw, data: parsed as SceneData });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid JSON.';
        parsedLines.push({ kind: 'invalid', number, raw, error: `Invalid data JSON: ${message}` });
      }
      return;
    }

    const propMatch = trimmed.match(PROP_RE);
    if (propMatch) {
      const target = propMatch[1];
      const rest = propMatch[2];
      const animation = parsePropLine(target, rest, number, raw);
      if ('error' in animation) {
        parsedLines.push({ kind: 'invalid', number, raw, error: animation.error });
        return;
      }
      animations.push(animation);
      parsedLines.push({ kind: 'animation', number, raw, animation });
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
    const rawTarget = quoteMatch?.[1] ?? '';
    const rawModifiers = tail.replace(QUOTED_RE, '').trim().replace(/\s+/g, ' ');
    const flags = extractFlags(rawModifiers);
    const event: SceneEvent = {
      id: `${number}-${effect}-${at}`,
      line: number,
      at,
      effect,
      target: rawTarget,
      modifiers: rawModifiers,
      raw,
      flags,
    };

    events.push(event);
    parsedLines.push({ kind: 'event', number, raw, event });
  });

  // After we've collected all `data` lines (they can appear anywhere in the
  // source), substitute {{path}} placeholders in event targets in-place.
  if (Object.keys(data).length > 0) {
    for (const event of events) {
      event.target = applyTemplate(event.target, data);
    }
  }

  const maxEventTime = events.reduce((max, event) => Math.max(max, event.at + estimateEventDuration(event)), 0);
  const maxKeyframeTime = animations.reduce(
    (max, animation) => Math.max(max, animation.keyframes[animation.keyframes.length - 1]?.at ?? 0),
    0,
  );
  return {
    name,
    duration: Math.max(duration, maxEventTime, maxKeyframeTime, 1000),
    events: events.sort((a, b) => a.at - b.at || a.line - b.line),
    markers: markers.sort((a, b) => a.at - b.at),
    animations,
    data,
    lines: parsedLines,
  };
}

/**
 * Replace every `{{path.to.value}}` token in `text` with the corresponding
 * value from `data`. Missing paths are preserved verbatim so the unrendered
 * placeholder stays visible — easier to debug than a silent blank.
 */
export function applyTemplate(text: string, data: SceneData): string {
  if (!text || Object.keys(data).length === 0) return text;
  return text.replace(TEMPLATE_RE, (match, path: string) => {
    const value = lookupPath(data, path);
    if (value === undefined || value === null) return match;
    return formatTemplateValue(value);
  });
}

function lookupPath(root: SceneData, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = root;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function formatTemplateValue(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value.toFixed(4)).toString();
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return JSON.stringify(value);
}

function deepMergeData(base: SceneData, patch: SceneData): SceneData {
  const next: SceneData = { ...base };
  for (const key of Object.keys(patch)) {
    const baseVal = (base as Record<string, unknown>)[key];
    const patchVal = (patch as Record<string, unknown>)[key];
    if (
      baseVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal) &&
      patchVal &&
      typeof patchVal === 'object' &&
      !Array.isArray(patchVal)
    ) {
      (next as Record<string, unknown>)[key] = deepMergeData(
        baseVal as SceneData,
        patchVal as SceneData,
      );
    } else {
      (next as Record<string, unknown>)[key] = patchVal;
    }
  }
  return next;
}

function parsePropLine(
  target: string,
  rest: string,
  lineNumber: number,
  raw: string,
): PropertyAnimation | { error: string } {
  // Scene-level animation: target is an animatable appearance property.
  if (isAnimatableAppearanceProp(target)) {
    const keyframes = parseKeyframeList(rest);
    if (keyframes.length === 0) {
      return { error: 'Expected at least one <time> <value> pair after the property name.' };
    }
    return {
      id: `prop-${lineNumber}-${target}`,
      line: lineNumber,
      property: target,
      eventLine: null,
      keyframes,
      raw,
    };
  }

  // Per-event animation: target like "event-3" with the param as the first token of `rest`.
  const eventMatch = target.match(/^event-(\d+)$/);
  if (eventMatch) {
    const eventLine = Number(eventMatch[1]);
    if (!Number.isFinite(eventLine) || eventLine <= 0) {
      return { error: `Invalid event line: ${target}` };
    }
    const tokens = rest.trim().split(/\s+/).filter(Boolean);
    const param = tokens[0];
    if (!param) {
      return { error: `Expected an animatable parameter after ${target}.` };
    }
    if (!isAnimatableEventParam(param)) {
      return { error: `Unknown event parameter: ${param}. Available: intensity.` };
    }
    const keyframes = parseKeyframeList(tokens.slice(1).join(' '));
    if (keyframes.length === 0) {
      return { error: 'Expected at least one <time> <value> pair after the parameter name.' };
    }
    return {
      id: `prop-${lineNumber}-event-${eventLine}-${param}`,
      line: lineNumber,
      property: param as AnimatableEventParam,
      eventLine,
      keyframes,
      raw,
    };
  }

  return { error: `Unknown animatable target: ${target}. Use an appearance property or event-<line>.` };
}

function parseKeyframeList(rest: string): PropertyKeyframe[] {
  const tokens = rest.split(/\s+/).filter(Boolean);
  const keyframes: PropertyKeyframe[] = [];
  let i = 0;
  while (i < tokens.length) {
    const timeToken = tokens[i];
    const at = parseTime(timeToken);
    if (at === null) return [];
    const valueToken = tokens[i + 1];
    if (valueToken === undefined) return [];
    const value = Number(valueToken);
    if (!Number.isFinite(value)) return [];
    let easing: EasingKind = 'linear';
    let consumed = 2;
    const maybeEasing = tokens[i + 2];
    if (maybeEasing && EASING_TOKENS.has(maybeEasing as EasingKind)) {
      easing = maybeEasing as EasingKind;
      consumed = 3;
    }
    keyframes.push({ at, value, easing });
    i += consumed;
  }
  // Ensure ascending time and dedupe identical times by keeping the last entry.
  keyframes.sort((a, b) => a.at - b.at);
  return keyframes;
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
  if (event.effect === 'counter') return parseFirstDuration(event.modifiers) ?? 800;
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
