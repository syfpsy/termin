import { parseScene } from '../../engine/dsl';
import { Grid, PhosphorBuffer } from '../../engine/grid';
import { evaluateScene } from '../../engine/primitives';
import { renderBufferToCanvas } from '../../engine/renderers/canvasRenderer';
import type { Appearance } from '../../engine/types';

export type FrameRenderOptions = {
  dsl: string;
  appearance: Appearance;
  width?: number;
  height?: number;
  pixelRatio?: number;
  cols?: number;
  rows?: number;
  onFrame: (canvas: HTMLCanvasElement, frame: number, totalFrames: number) => Promise<void> | void;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
};

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 720;
const DEFAULT_COLS = 96;
const DEFAULT_ROWS = 36;

export async function renderFrameSequence(options: FrameRenderOptions): Promise<void> {
  const scene = parseScene(options.dsl);
  const tickRate = options.appearance.tickRate;
  const totalFrames = Math.max(1, Math.round((scene.duration / 1000) * tickRate));
  const cols = options.cols ?? DEFAULT_COLS;
  const rows = options.rows ?? DEFAULT_ROWS;
  const grid = new Grid(cols, rows);
  const buffer = new PhosphorBuffer(cols, rows);
  const dt = 1000 / tickRate;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '-10000px auto auto -10000px';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  try {
    for (let frame = 0; frame < totalFrames; frame += 1) {
      if (options.signal?.aborted) throw new DOMException('Render aborted.', 'AbortError');
      evaluateScene(scene, grid, frame, tickRate);
      buffer.update(grid, dt, options.appearance.decay);
      renderBufferToCanvas(canvas, buffer, options.appearance, {
        width: options.width ?? DEFAULT_WIDTH,
        height: options.height ?? DEFAULT_HEIGHT,
        pixelRatio: options.pixelRatio ?? 1,
      });
      await options.onFrame(canvas, frame, totalFrames);
      options.onProgress?.((frame + 1) / totalFrames);
    }
  } finally {
    canvas.remove();
  }
}
