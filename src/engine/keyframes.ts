import type { Appearance } from './types';
import {
  ANIMATABLE_APPEARANCE_PROPS,
  type AnimatableAppearanceProp,
  type EasingKind,
  type ParsedScene,
  type PropertyAnimation,
  type PropertyKeyframe,
} from './types';

const APPEARANCE_RANGES: Record<AnimatableAppearanceProp, { min: number; max: number }> = {
  decay: { min: 0, max: 5000 },
  bloom: { min: 0, max: 8 },
  scanlines: { min: 0, max: 1 },
  curvature: { min: 0, max: 1 },
  flicker: { min: 0, max: 1 },
  chromatic: { min: 0, max: 2 },
  sizeScale: { min: 0.5, max: 2 },
};

export function clampAnimatedValue(prop: AnimatableAppearanceProp, value: number): number {
  const range = APPEARANCE_RANGES[prop];
  if (!Number.isFinite(value)) return range.min;
  return Math.max(range.min, Math.min(range.max, value));
}

export function easingProgress(easing: EasingKind, t: number): number {
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

/**
 * Sample a single property animation at `atMs`. The first keyframe defines
 * the value before its time; the last keyframe defines the value after its
 * time. Between keyframes, interpolate using the *target* keyframe's easing
 * (i.e., the easing curve applies to the segment ending at that keyframe).
 */
export function sampleAnimation(animation: PropertyAnimation, atMs: number): number {
  const frames = animation.keyframes;
  if (frames.length === 0) return 0;
  if (atMs <= frames[0].at) return frames[0].value;
  if (atMs >= frames[frames.length - 1].at) return frames[frames.length - 1].value;

  let lo = 0;
  let hi = frames.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1;
    if (frames[mid].at <= atMs) lo = mid;
    else hi = mid;
  }
  const a = frames[lo];
  const b = frames[hi];
  if (atMs <= a.at) return a.value;
  if (atMs >= b.at) return b.value;
  const span = Math.max(1, b.at - a.at);
  const t = (atMs - a.at) / span;
  const eased = easingProgress(b.easing, t);
  return a.value + (b.value - a.value) * eased;
}

/**
 * Compute the effective Appearance for a scene at a given time.
 * Properties with no animation fall back to the base appearance value.
 */
export function sampleAppearance(
  animations: PropertyAnimation[],
  base: Appearance,
  atMs: number,
): Appearance {
  if (animations.length === 0) return base;
  const next: Appearance = { ...base };
  for (const prop of ANIMATABLE_APPEARANCE_PROPS) {
    const animation = animations.find((entry) => entry.property === prop);
    if (!animation) continue;
    const sampled = clampAnimatedValue(prop, sampleAnimation(animation, atMs));
    (next[prop] as number) = sampled;
  }
  return next;
}

export function sampleSceneAppearance(scene: ParsedScene, base: Appearance, atMs: number): Appearance {
  return sampleAppearance(scene.animations, base, atMs);
}

export function formatPropertyLine(animation: Pick<PropertyAnimation, 'property' | 'keyframes'>): string {
  const parts: string[] = ['prop', animation.property];
  for (const frame of animation.keyframes) {
    parts.push(`${Math.round(frame.at)}ms`);
    parts.push(formatKeyframeValue(frame.value));
    if (frame.easing !== 'linear') parts.push(frame.easing);
  }
  return parts.join(' ');
}

function formatKeyframeValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(4)).toString();
}
