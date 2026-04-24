import { estimateEventDuration, parseFirstDuration } from './dsl';
import type { SceneEvent } from './types';

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
