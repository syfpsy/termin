import { parseScene } from '../../engine/dsl';
import { Grid, PhosphorBuffer } from '../../engine/grid';
import { evaluateScene } from '../../engine/primitives';
import { renderBufferToCanvas } from '../../engine/renderers/canvasRenderer';
import type { Appearance } from '../../engine/types';

export type StreamRecordingInput = {
  sceneName: string;
  dsl: string;
  appearance: Appearance;
  mimeCandidates: string[];
  width?: number;
  height?: number;
  bitsPerSecond?: number;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
};

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 720;
const DEFAULT_COLS = 96;
const DEFAULT_ROWS = 36;

export function pickSupportedMime(candidates: string[]): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? null;
}

export async function recordSceneStream(input: StreamRecordingInput): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not available in this browser.');
  }
  const mimeType = pickSupportedMime(input.mimeCandidates);
  if (!mimeType) {
    throw new Error(
      `This browser does not support any of: ${input.mimeCandidates.join(', ')}.`,
    );
  }

  const scene = parseScene(input.dsl);
  const tickRate = input.appearance.tickRate;
  const totalFrames = Math.max(1, Math.round((scene.duration / 1000) * tickRate));
  const width = input.width ?? DEFAULT_WIDTH;
  const height = input.height ?? DEFAULT_HEIGHT;
  const frameMs = 1000 / tickRate;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '-10000px auto auto -10000px';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  const grid = new Grid(DEFAULT_COLS, DEFAULT_ROWS);
  const buffer = new PhosphorBuffer(DEFAULT_COLS, DEFAULT_ROWS);

  const stream = canvas.captureStream(tickRate);
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: input.bitsPerSecond ?? 6_000_000,
  });

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.addEventListener('stop', () => resolve());
    recorder.addEventListener('error', () => {
      reject(new Error('MediaRecorder failed.'));
    });
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
  });

  try {
    recorder.start();
    const start = performance.now();
    for (let frame = 0; frame < totalFrames; frame += 1) {
      if (input.signal?.aborted) {
        recorder.stop();
        throw new DOMException('Render aborted.', 'AbortError');
      }
      evaluateScene(scene, grid, frame, tickRate);
      buffer.update(grid, frameMs, input.appearance.decay);
      renderBufferToCanvas(canvas, buffer, input.appearance, {
        width,
        height,
        pixelRatio: 1,
      });
      input.onProgress?.((frame + 1) / totalFrames);
      const target = start + (frame + 1) * frameMs;
      const delay = Math.max(0, target - performance.now());
      await wait(delay);
    }
    recorder.stop();
    await stopped;
    return new Blob(chunks, { type: mimeType.split(';')[0] });
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    canvas.remove();
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
