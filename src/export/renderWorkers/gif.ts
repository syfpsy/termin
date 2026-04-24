import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import type { Appearance } from '../../engine/types';
import { renderFrameSequence } from './frames';

export type GifInput = {
  sceneName: string;
  dsl: string;
  appearance: Appearance;
  width?: number;
  height?: number;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
  paletteSize?: 16 | 32 | 64 | 128 | 256;
};

const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 360;

export async function renderGifClip(input: GifInput): Promise<Blob> {
  const width = input.width ?? DEFAULT_WIDTH;
  const height = input.height ?? DEFAULT_HEIGHT;
  const delayMs = Math.round(1000 / input.appearance.tickRate);
  const paletteSize = input.paletteSize ?? 64;

  const encoder = GIFEncoder();

  await renderFrameSequence({
    dsl: input.dsl,
    appearance: input.appearance,
    width,
    height,
    pixelRatio: 1,
    onProgress: input.onProgress,
    signal: input.signal,
    onFrame(canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('GIF export requires a 2D canvas context.');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const rgba = new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);
      const palette = quantize(rgba, paletteSize, { format: 'rgba4444' });
      const indexed = applyPalette(rgba, palette, 'rgba4444');
      encoder.writeFrame(indexed, canvas.width, canvas.height, { palette, delay: delayMs });
    },
  });

  encoder.finish();
  const bytes = encoder.bytes();
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new Blob([ab], { type: 'image/gif' });
}
