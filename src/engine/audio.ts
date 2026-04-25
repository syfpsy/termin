/**
 * Tick-synced audio for Phosphor scenes.
 *
 * Per-event modifier:  sound:<name>
 *   e.g. `at 1200ms pulse "warming" amber 600ms sound:beep-high`
 *
 * The audio module owns a lazily-created shared AudioContext and a small bank
 * of synthesized presets (no asset loading). Sounds fire only during forward
 * playback — scrubbing and engine replays do not trigger audio.
 */

import type { SceneEvent } from './types';

export type SoundPreset =
  | 'beep-low'
  | 'beep-high'
  | 'click'
  | 'blip'
  | 'swish'
  | 'chime';

export const SOUND_PRESETS: SoundPreset[] = ['beep-low', 'beep-high', 'click', 'blip', 'swish', 'chime'];

const SOUND_PREFIX = 'sound:';

type PresetSpec = {
  oscillator: OscillatorType;
  frequency: number;
  glide?: number; // target frequency for portamento
  attack: number;
  hold: number;
  release: number;
  gain: number;
};

const PRESET_SPECS: Record<SoundPreset, PresetSpec> = {
  'beep-low': {
    oscillator: 'square',
    frequency: 220,
    attack: 0.005,
    hold: 0.04,
    release: 0.04,
    gain: 0.18,
  },
  'beep-high': {
    oscillator: 'square',
    frequency: 880,
    attack: 0.003,
    hold: 0.03,
    release: 0.04,
    gain: 0.14,
  },
  click: {
    oscillator: 'triangle',
    frequency: 1600,
    attack: 0.001,
    hold: 0.005,
    release: 0.02,
    gain: 0.16,
  },
  blip: {
    oscillator: 'sine',
    frequency: 1320,
    attack: 0.005,
    hold: 0.03,
    release: 0.06,
    gain: 0.12,
  },
  swish: {
    oscillator: 'sawtooth',
    frequency: 200,
    glide: 1200,
    attack: 0.01,
    hold: 0.04,
    release: 0.18,
    gain: 0.06,
  },
  chime: {
    oscillator: 'triangle',
    frequency: 660,
    attack: 0.003,
    hold: 0.04,
    release: 0.32,
    gain: 0.1,
  },
};

let cachedContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;

export function isSoundPreset(name: string): name is SoundPreset {
  return (SOUND_PRESETS as string[]).includes(name);
}

/** Extract the first `sound:<name>` token from an event's modifiers, if any. */
export function eventSound(event: SceneEvent): SoundPreset | null {
  const tokens = event.modifiers.split(/\s+/);
  for (const token of tokens) {
    if (!token.startsWith(SOUND_PREFIX)) continue;
    const name = token.slice(SOUND_PREFIX.length);
    if (isSoundPreset(name)) return name;
  }
  return null;
}

export function setAudioMuted(value: boolean) {
  muted = value;
  if (masterGain && cachedContext) {
    masterGain.gain.cancelScheduledValues(cachedContext.currentTime);
    masterGain.gain.setValueAtTime(value ? 0 : 1, cachedContext.currentTime);
  }
}

export function isAudioMuted(): boolean {
  return muted;
}

/**
 * Lazily create the shared AudioContext on the first sound. Browsers gate
 * AudioContext until a user gesture; this is fine because sounds only play
 * after the user starts the transport, which itself is a gesture.
 */
function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (cachedContext) return cachedContext;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  cachedContext = new Ctor();
  masterGain = cachedContext.createGain();
  masterGain.gain.setValueAtTime(muted ? 0 : 1, cachedContext.currentTime);
  masterGain.connect(cachedContext.destination);
  return cachedContext;
}

/** Resume the audio context if it was suspended (Safari, Chrome autoplay). */
export async function ensureAudioRunning(): Promise<void> {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // Resume is best-effort; the context will resume on the next user gesture.
    }
  }
}

/** Play a single preset sound. Returns the AudioContext time it was scheduled at. */
export function playSound(name: SoundPreset, when: number = 0): number {
  const ctx = getContext();
  if (!ctx || !masterGain) return 0;
  const spec = PRESET_SPECS[name];
  const startAt = Math.max(ctx.currentTime, ctx.currentTime + when);
  const osc = ctx.createOscillator();
  osc.type = spec.oscillator;
  osc.frequency.setValueAtTime(spec.frequency, startAt);
  if (spec.glide && spec.glide !== spec.frequency) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, spec.glide),
      startAt + spec.attack + spec.hold,
    );
  }
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, startAt);
  env.gain.linearRampToValueAtTime(spec.gain, startAt + spec.attack);
  env.gain.setValueAtTime(spec.gain, startAt + spec.attack + spec.hold);
  env.gain.exponentialRampToValueAtTime(0.0001, startAt + spec.attack + spec.hold + spec.release);
  osc.connect(env);
  env.connect(masterGain);
  osc.start(startAt);
  osc.stop(startAt + spec.attack + spec.hold + spec.release + 0.05);
  return startAt;
}

/**
 * Schedule a flight of events that fire between `fromTickInclusive` and
 * `toTickInclusive` (exclusive of fromTick, inclusive of toTick) at the given
 * tickRate. Events without a `sound:` modifier are skipped.
 *
 * Scheduling uses the AudioContext clock so jitter is sub-millisecond once
 * the context is warmed up.
 */
export function scheduleEventSounds(
  events: SceneEvent[],
  fromTick: number,
  toTick: number,
  tickRate: number,
  baseTickAt?: number,
): void {
  if (toTick < fromTick) return;
  const ctx = getContext();
  if (!ctx || !masterGain || muted) return;
  const fromMs = ((fromTick + 1) * 1000) / tickRate;
  const toMs = (toTick * 1000) / tickRate;
  const reference = baseTickAt ?? ctx.currentTime;
  for (const event of events) {
    if (event.flags.muted) continue;
    if (event.at < fromMs || event.at > toMs) continue;
    const sound = eventSound(event);
    if (!sound) continue;
    const offset = (event.at - fromMs) / 1000;
    const when = Math.max(0, reference - ctx.currentTime + offset);
    playSound(sound, when);
  }
}
