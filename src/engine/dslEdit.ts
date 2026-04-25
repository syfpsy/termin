import { estimateEventDuration, isFlagToken, parseFirstDuration } from './dsl';
import { formatPropertyLine } from './keyframes';
import type {
  AnimatableAppearanceProp,
  EasingKind,
  EventFlags,
  PropertyAnimation,
  PropertyKeyframe,
  SceneEvent,
  SceneMarker,
} from './types';

/**
 * Effects whose duration is encoded in the modifiers and is therefore resizable.
 * `type` is excluded — duration is derived from target length × per-char rate.
 */
const RESIZABLE_EFFECTS = new Set([
  'pulse',
  'glitch',
  'flash',
  'scan-line',
  'wipe',
  'shake',
  'wave',
  'dither',
  'cursor',
  'cursor-blink',
]);

export function isResizable(effect: string): boolean {
  return RESIZABLE_EFFECTS.has(effect);
}

export type EventFormatInput = {
  atMs: number;
  effect: string;
  target?: string;
  modifiers?: string;
};

/**
 * Render an event back into a single source line. Always emits time in ms
 * (parser accepts both ms and s; ms is the canonical write form).
 *
 * Note: target text containing `"` is not escaped — the parser cannot read it
 * back cleanly. Callers should sanitize quotes before formatting.
 */
export function formatEventLine(input: EventFormatInput): string {
  const at = `at ${Math.max(0, Math.round(input.atMs))}ms`;
  const parts: string[] = [at, input.effect];
  if (input.target) parts.push(`"${input.target}"`);
  const mods = (input.modifiers ?? '').trim();
  if (mods) parts.push(mods);
  return parts.join(' ');
}

export function eventToLine(event: SceneEvent): string {
  return formatEventLine({
    atMs: event.at,
    effect: event.effect,
    target: event.target,
    modifiers: event.modifiers,
  });
}

export type LineEditResult = { source: string; lineNumber: number | null };

export function replaceLine(source: string, lineNumber: number, replacement: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const index = lineNumber - 1;
  if (index < 0 || index >= lines.length) return source;
  lines[index] = replacement;
  return lines.join('\n');
}

export function removeLine(source: string, lineNumber: number): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const index = lineNumber - 1;
  if (index < 0 || index >= lines.length) return source;
  lines.splice(index, 1);
  return lines.join('\n');
}

export function appendLine(source: string, line: string): LineEditResult {
  const normalized = source.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  const next = normalized.length === 0 ? line : `${normalized}\n${line}`;
  const lineNumber = next.split('\n').length;
  return { source: next, lineNumber };
}

export function clampEventTime(atMs: number, sceneDurationMs: number, snapMs?: number): number {
  let clamped = Math.max(0, Math.min(sceneDurationMs, Math.round(atMs)));
  if (snapMs && snapMs > 0) clamped = Math.round(clamped / snapMs) * snapMs;
  return Math.max(0, Math.min(sceneDurationMs, clamped));
}

export function setDurationModifier(modifiers: string, durationMs: number): string {
  const ms = Math.max(0, Math.round(durationMs));
  const replacement = `${ms}ms`;
  const trimmed = modifiers.trim();
  if (!trimmed) return replacement;
  if (/(\d+(?:\.\d+)?)(ms|s)/.test(trimmed)) {
    return trimmed.replace(/(\d+(?:\.\d+)?)(ms|s)/, replacement);
  }
  return `${trimmed} ${replacement}`;
}

export type MoveEventInput = {
  source: string;
  event: SceneEvent;
  atMs: number;
  sceneDurationMs: number;
  snapMs?: number;
};

export function moveEventInSource(input: MoveEventInput): string {
  const atMs = clampEventTime(input.atMs, input.sceneDurationMs, input.snapMs);
  return replaceLine(
    input.source,
    input.event.line,
    formatEventLine({
      atMs,
      effect: input.event.effect,
      target: input.event.target,
      modifiers: input.event.modifiers,
    }),
  );
}

export type ResizeEventInput = {
  source: string;
  event: SceneEvent;
  durationMs: number;
};

export function resizeEventInSource(input: ResizeEventInput): string {
  if (!isResizable(input.event.effect)) return input.source;
  const safeDuration = Math.max(20, Math.round(input.durationMs));
  return replaceLine(
    input.source,
    input.event.line,
    formatEventLine({
      atMs: input.event.at,
      effect: input.event.effect,
      target: input.event.target,
      modifiers: setDurationModifier(input.event.modifiers, safeDuration),
    }),
  );
}

export function deleteEventInSource(source: string, event: SceneEvent): string {
  return removeLine(source, event.line);
}

export type PatchEventInput = {
  source: string;
  event: SceneEvent;
  patch: Partial<{ atMs: number; effect: string; target: string; modifiers: string }>;
  sceneDurationMs?: number;
  snapMs?: number;
};

export function patchEventInSource(input: PatchEventInput): string {
  const atMs = input.patch.atMs ?? input.event.at;
  const clamped = input.sceneDurationMs
    ? clampEventTime(atMs, input.sceneDurationMs, input.snapMs)
    : Math.max(0, Math.round(atMs));
  return replaceLine(
    input.source,
    input.event.line,
    formatEventLine({
      atMs: clamped,
      effect: input.patch.effect ?? input.event.effect,
      target: sanitizeTarget(input.patch.target ?? input.event.target),
      modifiers: input.patch.modifiers ?? input.event.modifiers,
    }),
  );
}

export type AddEventInput = {
  source: string;
  atMs: number;
  effect: string;
  target?: string;
  modifiers?: string;
  sceneDurationMs: number;
  snapMs?: number;
};

export function addEventToSource(input: AddEventInput): LineEditResult {
  const atMs = clampEventTime(input.atMs, input.sceneDurationMs, input.snapMs);
  return appendLine(
    input.source,
    formatEventLine({
      atMs,
      effect: input.effect,
      target: sanitizeTarget(input.target ?? ''),
      modifiers: input.modifiers ?? '',
    }),
  );
}

export function defaultEventTemplate(effect: string, atMs: number): EventFormatInput {
  const presets: Record<string, Omit<EventFormatInput, 'atMs'>> = {
    type: { effect: 'type', target: 'NEW EVENT', modifiers: 'slowly' },
    cursor: { effect: 'cursor', target: '_', modifiers: 'blink 500ms' },
    'scan-line': { effect: 'scan-line', target: '', modifiers: 'row 18 400ms' },
    glitch: { effect: 'glitch', target: 'SYSTEM READY', modifiers: '80ms burst' },
    pulse: { effect: 'pulse', target: 'pulse', modifiers: 'amber 600ms' },
    'decay-trail': { effect: 'decay-trail', target: '*', modifiers: 'path(8,25 22,22 48,18) 45ms/step' },
    dither: { effect: 'dither', target: 'ramp 0->1', modifiers: 'bayer4 900ms' },
    wave: { effect: 'wave', target: 'signal carrier', modifiers: '1200ms' },
    wipe: { effect: 'wipe', target: 'WIPE REVEAL', modifiers: 'diagonal 500ms' },
    loop: { effect: 'loop', target: '<<< >>>', modifiers: '' },
    shake: { effect: 'shake', target: 'SHAKE', modifiers: '3px 200ms' },
    flash: { effect: 'flash', target: 'screen', modifiers: '80ms' },
    reveal: { effect: 'reveal', target: '> NEW REVEAL', modifiers: '' },
  };
  const preset = presets[effect] ?? { effect, target: 'new', modifiers: '' };
  return { ...preset, atMs };
}

export function inferDisplayDuration(event: SceneEvent, tickRate = 30): number {
  return parseFirstDuration(event.modifiers) ?? estimateEventDuration(event, tickRate);
}

function sanitizeTarget(target: string): string {
  return target.replace(/"/g, '').replace(/\s+/g, ' ').trim();
}

export type FlagName = keyof EventFlags;

export function setFlagInModifiers(modifiers: string, flag: FlagName, value: boolean): string {
  const tokens = modifiers.split(/\s+/).filter(Boolean);
  const without = tokens.filter((token) => token !== flag);
  return value ? [...without, flag].join(' ').trim() : without.join(' ').trim();
}

export function setEventFlagInSource(
  source: string,
  event: SceneEvent,
  flag: FlagName,
  value: boolean,
): string {
  const nextModifiers = setFlagInModifiers(event.modifiers, flag, value);
  return replaceLine(
    source,
    event.line,
    formatEventLine({
      atMs: event.at,
      effect: event.effect,
      target: event.target,
      modifiers: nextModifiers,
    }),
  );
}

export type SplitInput = {
  source: string;
  event: SceneEvent;
  atMs: number;
  sceneDurationMs: number;
};

/**
 * Split a duration-bearing event at `atMs`. The original line is shortened to
 * end at the cut point; a new event line is appended starting at the cut with
 * the remainder of the duration.
 */
export function splitEventAtMs(input: SplitInput): LineEditResult {
  if (!isResizable(input.event.effect)) return { source: input.source, lineNumber: null };
  const totalDuration = inferDisplayDuration(input.event, 30);
  const cutMs = clampEventTime(input.atMs, input.sceneDurationMs);
  const offset = cutMs - input.event.at;
  if (offset <= MIN_SPLIT_OFFSET || totalDuration - offset <= MIN_SPLIT_OFFSET) {
    return { source: input.source, lineNumber: null };
  }

  const firstHalf = replaceLine(
    input.source,
    input.event.line,
    formatEventLine({
      atMs: input.event.at,
      effect: input.event.effect,
      target: input.event.target,
      modifiers: setDurationModifier(input.event.modifiers, offset),
    }),
  );
  return appendLine(
    firstHalf,
    formatEventLine({
      atMs: cutMs,
      effect: input.event.effect,
      target: input.event.target,
      modifiers: setDurationModifier(input.event.modifiers, totalDuration - offset),
    }),
  );
}

const MIN_SPLIT_OFFSET = 30;

export type MultiMoveInput = {
  source: string;
  events: SceneEvent[];
  deltaMs: number;
  sceneDurationMs: number;
  snapMs?: number;
};

export function moveEventsInSource(input: MultiMoveInput): string {
  if (input.events.length === 0) return input.source;
  // Clamp delta so no event under it goes negative or past the scene end.
  const minAt = input.events.reduce((m, e) => Math.min(m, e.at), Number.POSITIVE_INFINITY);
  const maxAt = input.events.reduce((m, e) => Math.max(m, e.at), 0);
  const minAllowed = -minAt;
  const maxAllowed = input.sceneDurationMs - maxAt;
  const clampedDelta = Math.max(minAllowed, Math.min(maxAllowed, input.deltaMs));

  let next = input.source;
  for (const event of input.events) {
    const targetMs = clampEventTime(event.at + clampedDelta, input.sceneDurationMs, input.snapMs);
    next = replaceLine(
      next,
      event.line,
      formatEventLine({
        atMs: targetMs,
        effect: event.effect,
        target: event.target,
        modifiers: event.modifiers,
      }),
    );
  }
  return next;
}

/**
 * Delete multiple events. Sort descending by line so subsequent removals
 * don't disturb the indices of earlier ones.
 */
export function deleteEventsInSource(source: string, events: SceneEvent[]): string {
  const sorted = [...events].sort((a, b) => b.line - a.line);
  let next = source;
  for (const event of sorted) {
    next = removeLine(next, event.line);
  }
  return next;
}

export type RescaleInput = {
  source: string;
  events: SceneEvent[];
  fromStart: number;
  fromEnd: number;
  toStart: number;
  toEnd: number;
  sceneDurationMs: number;
  snapMs?: number;
};

/**
 * Map each event's `at` from one window to another linearly. Events fully
 * outside the source window are unchanged.
 */
export function rescaleEventsInSource(input: RescaleInput): string {
  const fromSpan = Math.max(1, input.fromEnd - input.fromStart);
  const toSpan = input.toEnd - input.toStart;
  let next = input.source;
  for (const event of input.events) {
    if (event.at < input.fromStart || event.at > input.fromEnd) continue;
    const ratio = (event.at - input.fromStart) / fromSpan;
    const targetMs = clampEventTime(input.toStart + ratio * toSpan, input.sceneDurationMs, input.snapMs);
    next = replaceLine(
      next,
      event.line,
      formatEventLine({
        atMs: targetMs,
        effect: event.effect,
        target: event.target,
        modifiers: event.modifiers,
      }),
    );
  }
  return next;
}

export type MarkerAddInput = {
  source: string;
  name: string;
  atMs: number;
  sceneDurationMs: number;
};

export function addMarkerToSource(input: MarkerAddInput): LineEditResult {
  const at = clampEventTime(input.atMs, input.sceneDurationMs);
  const safeName = input.name.replace(/"/g, '').slice(0, 80) || 'marker';
  return appendLine(input.source, `mark "${safeName}" ${at}ms`);
}

export function deleteMarkerInSource(source: string, marker: SceneMarker): string {
  return removeLine(source, marker.line);
}

export function moveMarkerInSource(
  source: string,
  marker: SceneMarker,
  atMs: number,
  sceneDurationMs: number,
): string {
  const at = clampEventTime(atMs, sceneDurationMs);
  return replaceLine(source, marker.line, `mark "${marker.name.replace(/"/g, '')}" ${at}ms`);
}

export function renameMarkerInSource(source: string, marker: SceneMarker, name: string): string {
  const safeName = name.replace(/"/g, '').slice(0, 80) || marker.name;
  return replaceLine(source, marker.line, `mark "${safeName}" ${marker.at}ms`);
}

/**
 * Strip flag tokens (muted/solo/locked) from modifiers — used when pasting
 * events so the new copy starts in a neutral state.
 */
export function stripFlagsFromModifiers(modifiers: string): string {
  return modifiers
    .split(/\s+/)
    .filter((token) => token && !isFlagToken(token))
    .join(' ');
}

export type PasteInput = {
  source: string;
  fragment: string;
  atMs: number;
  sceneDurationMs: number;
  snapMs?: number;
};

/**
 * Paste a clipboard fragment of `.me` event lines starting at `atMs`.
 * The earliest event in the fragment lands at `atMs`; later ones preserve
 * their relative offsets.
 */
export function pasteEventLines(input: PasteInput): { source: string; insertedLines: number[] } {
  const lines = input.fragment.replace(/\r\n/g, '\n').split('\n');
  const eventLines: Array<{ at: number; effect: string; target: string; modifiers: string }> = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^at\s+(\d+(?:\.\d+)?)(ms|s)\s+([a-zA-Z][a-zA-Z0-9-]*)\s*(.*)$/);
    if (!match) continue;
    const [, value, unit, effect, tail] = match;
    const at = unit === 's' ? Math.round(Number(value) * 1000) : Math.round(Number(value));
    const quote = tail.match(/"([^"]*)"/);
    const target = quote?.[1] ?? '';
    const modifiers = tail.replace(/"[^"]*"/, '').trim().replace(/\s+/g, ' ');
    eventLines.push({ at, effect, target, modifiers });
  }
  if (eventLines.length === 0) return { source: input.source, insertedLines: [] };

  const baseAt = eventLines.reduce((min, line) => Math.min(min, line.at), Number.POSITIVE_INFINITY);
  let next = input.source;
  const insertedLines: number[] = [];
  for (const line of eventLines) {
    const offset = line.at - baseAt;
    const at = clampEventTime(input.atMs + offset, input.sceneDurationMs, input.snapMs);
    const formatted = formatEventLine({
      atMs: at,
      effect: line.effect,
      target: sanitizeTarget(line.target),
      modifiers: stripFlagsFromModifiers(line.modifiers),
    });
    const result = appendLine(next, formatted);
    next = result.source;
    if (result.lineNumber !== null) insertedLines.push(result.lineNumber);
  }
  return { source: next, insertedLines };
}

export function eventsToFragment(events: SceneEvent[]): string {
  return events
    .map((event) =>
      formatEventLine({
        atMs: event.at,
        effect: event.effect,
        target: event.target,
        modifiers: stripFlagsFromModifiers(event.modifiers),
      }),
    )
    .join('\n');
}

/** Replace an animation's source line with the given keyframes. */
export function rewriteAnimationLine(
  source: string,
  animation: PropertyAnimation,
  keyframes: PropertyKeyframe[],
): string {
  const sorted = [...keyframes].sort((a, b) => a.at - b.at);
  return replaceLine(
    source,
    animation.line,
    formatPropertyLine({ property: animation.property, keyframes: sorted }),
  );
}

export function deleteAnimationInSource(source: string, animation: PropertyAnimation): string {
  return removeLine(source, animation.line);
}

export type CreateAnimationInput = {
  source: string;
  property: AnimatableAppearanceProp;
  keyframes: PropertyKeyframe[];
};

export function appendAnimation(input: CreateAnimationInput): LineEditResult {
  if (input.keyframes.length === 0) return { source: input.source, lineNumber: null };
  const sorted = [...input.keyframes].sort((a, b) => a.at - b.at);
  return appendLine(
    input.source,
    formatPropertyLine({ property: input.property, keyframes: sorted }),
  );
}

export function addKeyframeToAnimation(
  source: string,
  animation: PropertyAnimation,
  keyframe: PropertyKeyframe,
): string {
  // If a keyframe already exists at this exact time, replace it.
  const existing = animation.keyframes.findIndex((frame) => frame.at === keyframe.at);
  const next =
    existing >= 0
      ? animation.keyframes.map((frame, index) => (index === existing ? keyframe : frame))
      : [...animation.keyframes, keyframe];
  return rewriteAnimationLine(source, animation, next);
}

export function removeKeyframe(
  source: string,
  animation: PropertyAnimation,
  index: number,
): string {
  if (index < 0 || index >= animation.keyframes.length) return source;
  const next = animation.keyframes.filter((_, i) => i !== index);
  if (next.length === 0) return deleteAnimationInSource(source, animation);
  return rewriteAnimationLine(source, animation, next);
}

export function moveKeyframe(
  source: string,
  animation: PropertyAnimation,
  index: number,
  atMs: number,
  sceneDurationMs: number,
  snapMs?: number,
): string {
  if (index < 0 || index >= animation.keyframes.length) return source;
  const clamped = clampEventTime(atMs, sceneDurationMs, snapMs);
  const next = animation.keyframes.map((frame, i) =>
    i === index ? { ...frame, at: clamped } : frame,
  );
  return rewriteAnimationLine(source, animation, next);
}

export function setKeyframeValue(
  source: string,
  animation: PropertyAnimation,
  index: number,
  value: number,
): string {
  if (index < 0 || index >= animation.keyframes.length) return source;
  const next = animation.keyframes.map((frame, i) => (i === index ? { ...frame, value } : frame));
  return rewriteAnimationLine(source, animation, next);
}

export function setKeyframeEasing(
  source: string,
  animation: PropertyAnimation,
  index: number,
  easing: EasingKind,
): string {
  if (index < 0 || index >= animation.keyframes.length) return source;
  const next = animation.keyframes.map((frame, i) => (i === index ? { ...frame, easing } : frame));
  return rewriteAnimationLine(source, animation, next);
}
