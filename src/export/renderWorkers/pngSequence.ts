import type { Appearance } from '../../engine/types';
import { renderFrameSequence } from './frames';
import { buildStoreZip, type ZipEntry } from '../zipStore';

export type PngSequenceInput = {
  sceneName: string;
  dsl: string;
  appearance: Appearance;
  width?: number;
  height?: number;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
};

export async function renderPngSequenceZip(input: PngSequenceInput): Promise<Blob> {
  const entries: ZipEntry[] = [];
  const modified = new Date();
  const prefix = safeStem(input.sceneName);

  await renderFrameSequence({
    dsl: input.dsl,
    appearance: input.appearance,
    width: input.width,
    height: input.height,
    onProgress: input.onProgress,
    signal: input.signal,
    async onFrame(canvas, frame, total) {
      const blob = await canvasToBlob(canvas, 'image/png');
      const data = new Uint8Array(await blob.arrayBuffer());
      const padded = String(frame).padStart(String(total - 1).length, '0');
      entries.push({ name: `${prefix}/${prefix}_${padded}.png`, data, modified });
    },
  });

  const manifest = {
    scene: input.sceneName,
    frameCount: entries.length,
    tickRate: input.appearance.tickRate,
    width: input.width ?? 960,
    height: input.height ?? 720,
    generatedAt: modified.toISOString(),
  };
  entries.push({
    name: `${prefix}/manifest.json`,
    data: new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`),
    modified,
  });

  const archive = buildStoreZip(entries);
  const ab = new ArrayBuffer(archive.byteLength);
  new Uint8Array(ab).set(archive);
  return new Blob([ab], { type: 'application/zip' });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error(`Canvas export to ${type} failed.`));
      else resolve(blob);
    }, type);
  });
}

function safeStem(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'phosphor_scene'
  );
}
