export type ToneName =
  | 'phos'
  | 'phosDim'
  | 'amber'
  | 'amberDim'
  | 'green'
  | 'red'
  | 'cyan'
  | 'magenta'
  | 'ink'
  | 'inkDim'
  | 'inkMuted'
  | 'inkFaint'
  | 'ink2';

export type PreviewChrome = 'bezel' | 'flat' | 'none';
export type PreviewMode = 'color' | '1-bit';
export type TickRate = 24 | 30 | 60;
export type RendererKind = 'canvas' | 'webgl';
export type ProviderKind = 'mock' | 'anthropic' | 'openrouter' | 'deepseek' | 'openai';

export type Appearance = {
  chrome: PreviewChrome;
  decay: number;
  bloom: number;
  scanlines: number;
  curvature: number;
  flicker: number;
  chromatic: number;
  font: 'vt323' | 'plex' | 'jet' | 'atkinson' | 'fira' | 'space';
  sizeScale: number;
  mode: PreviewMode;
  tickRate: TickRate;
};

export type EffectName =
  | 'type'
  | 'cursor'
  | 'cursor-blink'
  | 'scan-line'
  | 'glitch'
  | 'pulse'
  | 'trail'
  | 'decay-trail'
  | 'dither'
  | 'wave'
  | 'wipe'
  | 'loop'
  | 'shake'
  | 'flash'
  | 'reveal'
  | string;

export type EventFlags = {
  muted: boolean;
  solo: boolean;
  locked: boolean;
};

export type SceneEvent = {
  id: string;
  line: number;
  at: number;
  effect: EffectName;
  target: string;
  modifiers: string;
  raw: string;
  flags: EventFlags;
};

export type SceneMarker = {
  id: string;
  line: number;
  name: string;
  at: number;
  raw: string;
};

export type EasingKind = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold';

export type PropertyKeyframe = {
  /** Time in milliseconds from scene start. */
  at: number;
  value: number;
  /**
   * Easing applied to the segment that ends at this keyframe (i.e., how the
   * value transitions from the previous keyframe's value to this keyframe's
   * value). The easing on the first keyframe is unused.
   */
  easing: EasingKind;
};

/**
 * The set of appearance properties that participate in keyframe animation.
 * Limited to numeric scalar fields so sampling stays simple. Color/font/mode
 * remain static — animate via tone modifiers on individual events instead.
 */
export type AnimatableAppearanceProp =
  | 'decay'
  | 'bloom'
  | 'scanlines'
  | 'curvature'
  | 'flicker'
  | 'chromatic'
  | 'sizeScale';

export type AnimatableEventParam = 'intensity';

export type PropertyAnimation = {
  id: string;
  line: number;
  property: AnimatableAppearanceProp | AnimatableEventParam;
  /** When non-null, this animation targets a specific event (by source line number). */
  eventLine: number | null;
  keyframes: PropertyKeyframe[];
  raw: string;
};

export const ANIMATABLE_APPEARANCE_PROPS: AnimatableAppearanceProp[] = [
  'decay',
  'bloom',
  'scanlines',
  'curvature',
  'flicker',
  'chromatic',
  'sizeScale',
];

export const ANIMATABLE_EVENT_PARAMS: AnimatableEventParam[] = ['intensity'];

export function isAnimatableAppearanceProp(name: string): name is AnimatableAppearanceProp {
  return (ANIMATABLE_APPEARANCE_PROPS as string[]).includes(name);
}

export function isAnimatableEventParam(name: string): name is AnimatableEventParam {
  return (ANIMATABLE_EVENT_PARAMS as string[]).includes(name);
}

export type ParsedLine =
  | {
      kind: 'blank' | 'comment';
      number: number;
      raw: string;
    }
  | {
      kind: 'scene';
      number: number;
      raw: string;
      name: string;
      duration: number;
    }
  | {
      kind: 'event';
      number: number;
      raw: string;
      event: SceneEvent;
    }
  | {
      kind: 'marker';
      number: number;
      raw: string;
      marker: SceneMarker;
    }
  | {
      kind: 'animation';
      number: number;
      raw: string;
      animation: PropertyAnimation;
    }
  | {
      kind: 'invalid';
      number: number;
      raw: string;
      error: string;
    };

export type ParsedScene = {
  name: string;
  duration: number;
  events: SceneEvent[];
  markers: SceneMarker[];
  animations: PropertyAnimation[];
  lines: ParsedLine[];
};

export type GridCell = {
  char: string;
  fg: ToneName;
  bg: ToneName | 'transparent';
  intensity: number;
};

export type BufferCell = GridCell;

export const DEFAULT_APPEARANCE: Appearance = {
  chrome: 'bezel',
  decay: 240,
  bloom: 1.8,
  scanlines: 0.7,
  curvature: 0.35,
  flicker: 0.12,
  chromatic: 0,
  font: 'vt323',
  sizeScale: 1,
  mode: 'color',
  tickRate: 30,
};

export const TONE_HEX: Record<ToneName, string> = {
  phos: '#D6F04A',
  phosDim: '#8aa028',
  amber: '#FFA94B',
  amberDim: '#a86a2a',
  green: '#7FE093',
  red: '#FF6B6B',
  cyan: '#7FE3E0',
  magenta: '#E77FD9',
  ink: '#CDDDA0',
  inkDim: '#7A8F56',
  inkMuted: '#4a5834',
  inkFaint: '#2f3a22',
  ink2: '#FFC985',
};
