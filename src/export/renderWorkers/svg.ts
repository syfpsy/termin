import { parseScene } from '../../engine/dsl';
import { Grid, PhosphorBuffer } from '../../engine/grid';
import { evaluateScene } from '../../engine/primitives';
import type { Appearance, ToneName } from '../../engine/types';
import { TONE_HEX } from '../../engine/types';

export type SvgInput = {
  sceneName: string;
  dsl: string;
  appearance: Appearance;
  width?: number;
  height?: number;
};

type SvgCell = {
  c: number;
  r: number;
  char: string;
  tone: ToneName;
  intensity: number;
};

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 720;
const COLS = 96;
const ROWS = 36;

const FONT_STACKS: Record<Appearance['font'], string> = {
  vt323: "'VT323','Courier New',monospace",
  plex: "'IBM Plex Mono',ui-monospace,monospace",
  jet: "'JetBrains Mono',ui-monospace,monospace",
  atkinson: "'Atkinson Hyperlegible Mono',ui-monospace,monospace",
  fira: "'Fira Code',ui-monospace,monospace",
  space: "'Space Mono',ui-monospace,monospace",
};

export function renderSvgPoster(input: SvgInput): string {
  const scene = parseScene(input.dsl);
  const tickRate = input.appearance.tickRate;
  const totalFrames = Math.max(1, Math.round((scene.duration / 1000) * tickRate));
  const width = input.width ?? DEFAULT_WIDTH;
  const height = input.height ?? DEFAULT_HEIGHT;
  const cellWidth = width / COLS;
  const cellHeight = height / ROWS;
  const fontSize = Math.max(8, Math.floor(cellHeight * 1.15 * input.appearance.sizeScale));
  const frameMs = 1000 / tickRate;

  const grid = new Grid(COLS, ROWS);
  const buffer = new PhosphorBuffer(COLS, ROWS);

  let bestFrame: SvgCell[] = [];
  let bestScore = -1;

  for (let frame = 0; frame < totalFrames; frame += 1) {
    evaluateScene(scene, grid, frame, tickRate);
    buffer.update(grid, frameMs, input.appearance.decay);

    const cells: SvgCell[] = [];
    let score = 0;
    buffer.forEach((cell, c, r) => {
      if (cell.intensity <= 0.04 || cell.char === ' ') return;
      cells.push({ c, r, char: cell.char, tone: cell.fg, intensity: cell.intensity });
      score += cell.intensity;
    });
    if (score > bestScore) {
      bestScore = score;
      bestFrame = cells;
    }
  }

  const fontStack = FONT_STACKS[input.appearance.font];
  const use1bit = input.appearance.mode === '1-bit';
  const bloom = input.appearance.bloom;
  const bloomStdDev = (2 + bloom * 3.5).toFixed(2);

  const body = bestFrame
    .map((cell) => {
      const x = (cell.c + 0.5) * cellWidth;
      const y = (cell.r + 0.5) * cellHeight;
      const fill = use1bit ? TONE_HEX.phos : TONE_HEX[cell.tone];
      const opacity = Math.max(0, Math.min(1, cell.intensity)).toFixed(3);
      return `  <text x="${x.toFixed(2)}" y="${y.toFixed(2)}" fill="${fill}" fill-opacity="${opacity}">${escapeXml(cell.char)}</text>`;
    })
    .join('\n');

  const filter = bloom > 0
    ? `  <defs>
    <filter id="bloom" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${bloomStdDev}" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="${fontStack}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central">
${filter}
  <rect width="100%" height="100%" fill="#050604"/>
  <g ${bloom > 0 ? 'filter="url(#bloom)"' : ''}>
${body}
  </g>
</svg>
`;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&apos;';
      default:
        return ch;
    }
  });
}

export function renderSvgAnimation(input: SvgInput): string {
  const scene = parseScene(input.dsl);
  const tickRate = input.appearance.tickRate;
  const totalFrames = Math.max(2, Math.round((scene.duration / 1000) * tickRate));

  const width = input.width ?? DEFAULT_WIDTH;
  const height = input.height ?? DEFAULT_HEIGHT;
  const cellWidth = width / COLS;
  const cellHeight = height / ROWS;
  const fontSize = Math.max(8, Math.floor(cellHeight * 1.15 * input.appearance.sizeScale));
  const frameMs = 1000 / tickRate;
  const durationSec = (scene.duration / 1000).toFixed(3);

  const grid = new Grid(COLS, ROWS);
  const buffer = new PhosphorBuffer(COLS, ROWS);

  type TimelineEntry = { frame: number; intensity: number; tone: ToneName };
  const timelines = new Map<string, TimelineEntry[]>();

  for (let frame = 0; frame < totalFrames; frame += 1) {
    evaluateScene(scene, grid, frame, tickRate);
    buffer.update(grid, frameMs, input.appearance.decay);
    buffer.forEach((cell, c, r) => {
      if (cell.char === ' ') return;
      if (cell.intensity <= 0.04) return;
      const key = `${c},${r},${cell.char}`;
      let timeline = timelines.get(key);
      if (!timeline) {
        timeline = [];
        timelines.set(key, timeline);
      }
      const prev = timeline[timeline.length - 1];
      if (!prev) {
        if (frame > 0) timeline.push({ frame: frame - 1, intensity: 0, tone: cell.fg });
        timeline.push({ frame, intensity: cell.intensity, tone: cell.fg });
        return;
      }
      const intensityDelta = Math.abs(prev.intensity - cell.intensity);
      const toneChanged = prev.tone !== cell.fg;
      const gapped = frame - prev.frame > 1;
      if (gapped) {
        timeline.push({ frame: prev.frame + 1, intensity: 0, tone: prev.tone });
        if (frame - 1 > prev.frame + 1) {
          timeline.push({ frame: frame - 1, intensity: 0, tone: cell.fg });
        }
        timeline.push({ frame, intensity: cell.intensity, tone: cell.fg });
      } else if (intensityDelta > 0.05 || toneChanged) {
        timeline.push({ frame, intensity: cell.intensity, tone: cell.fg });
      }
    });
  }

  const fontStack = FONT_STACKS[input.appearance.font];
  const use1bit = input.appearance.mode === '1-bit';
  const bloom = input.appearance.bloom;
  const bloomStdDev = (2 + bloom * 3.5).toFixed(2);

  const parts: string[] = [];
  for (const [key, timeline] of timelines) {
    if (timeline.length === 0) continue;
    const last = timeline[timeline.length - 1];
    if (last.frame < totalFrames - 1) {
      timeline.push({ frame: totalFrames - 1, intensity: 0, tone: last.tone });
    }
    const [cStr, rStr, char] = key.split(',', 3);
    const c = Number(cStr);
    const r = Number(rStr);
    const x = (c + 0.5) * cellWidth;
    const y = (r + 0.5) * cellHeight;

    const dominantTone = pickDominantTone(timeline);
    const fill = use1bit ? TONE_HEX.phos : TONE_HEX[dominantTone];

    const keyTimes: string[] = [];
    const values: string[] = [];
    const denom = Math.max(1, totalFrames - 1);
    for (const entry of timeline) {
      keyTimes.push((entry.frame / denom).toFixed(4));
      values.push(entry.intensity.toFixed(3));
    }

    parts.push(
      `  <text x="${x.toFixed(2)}" y="${y.toFixed(2)}" fill="${fill}" fill-opacity="0">${escapeXml(char)}<animate attributeName="fill-opacity" values="${values.join(';')}" keyTimes="${keyTimes.join(';')}" dur="${durationSec}s" repeatCount="indefinite"/></text>`,
    );
  }

  const filter = bloom > 0
    ? `  <defs>
    <filter id="bloom" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${bloomStdDev}" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="${fontStack}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central">
${filter}
  <rect width="100%" height="100%" fill="#050604"/>
  <g ${bloom > 0 ? 'filter="url(#bloom)"' : ''}>
${parts.join('\n')}
  </g>
</svg>
`;
}

function pickDominantTone(timeline: { intensity: number; tone: ToneName }[]): ToneName {
  const sums = new Map<ToneName, number>();
  for (const entry of timeline) {
    sums.set(entry.tone, (sums.get(entry.tone) ?? 0) + entry.intensity);
  }
  let best: ToneName = 'phos';
  let bestScore = -1;
  for (const [tone, score] of sums) {
    if (score > bestScore) {
      bestScore = score;
      best = tone;
    }
  }
  return best;
}

export function svgFileName(sceneName: string, suffix: 'poster' | 'animated' = 'animated'): string {
  const stem = sceneName
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'phosphor_scene';
  return suffix === 'poster' ? `${stem}.poster.svg` : `${stem}.svg`;
}
