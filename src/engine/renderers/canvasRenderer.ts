import type { Appearance, PhosphorFont } from '../../state/types';
import type { PhosphorBuffer } from '../grid';
import { TONE_HEX, type ToneName } from '../types';

export type CanvasRenderOptions = {
  width: number;
  height: number;
  background?: string;
};

const FONT_STACKS: Record<PhosphorFont, string> = {
  vt323: "'VT323', 'Courier New', monospace",
  plex: "'IBM Plex Mono', ui-monospace, monospace",
  jet: "'JetBrains Mono', ui-monospace, monospace",
  atkinson: "'Atkinson Hyperlegible Mono', ui-monospace, monospace",
  fira: "'Fira Code', ui-monospace, monospace",
  space: "'Space Mono', ui-monospace, monospace",
};

export function renderBufferToCanvas(
  canvas: HTMLCanvasElement,
  buffer: PhosphorBuffer,
  appearance: Appearance,
  options: CanvasRenderOptions,
) {
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.max(1, Math.floor(options.width * dpr));
  const pixelHeight = Math.max(1, Math.floor(options.height * dpr));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  canvas.style.width = `${options.width}px`;
  canvas.style.height = `${options.height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = options.background ?? '#050604';
  ctx.fillRect(0, 0, options.width, options.height);

  const cellWidth = options.width / buffer.cols;
  const cellHeight = options.height / buffer.rows;
  const fontSize = Math.max(8, Math.floor(cellHeight * 1.15 * appearance.sizeScale));

  ctx.font = `${fontSize}px ${FONT_STACKS[appearance.font]}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  buffer.forEach((cell, c, r) => {
    if (cell.intensity <= 0.02 || cell.char === ' ') return;
    const tone = appearance.mode === '1-bit' ? 'phos' : cell.fg;
    const alpha = Math.max(0, Math.min(1, cell.intensity));
    const x = Math.round(c * cellWidth);
    const y = Math.round(r * cellHeight - cellHeight * 0.08);

    ctx.globalAlpha = alpha;
    ctx.shadowColor = colorWithAlpha(tone, 0.55 * alpha);
    ctx.shadowBlur = 2 + appearance.bloom * 3.5;
    ctx.fillStyle = TONE_HEX[tone];
    ctx.fillText(cell.char, x, y);
  });

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function colorWithAlpha(tone: ToneName, alpha: number) {
  const hex = TONE_HEX[tone];
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}
