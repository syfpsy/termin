import type { Appearance } from '../../engine/types';
import { pickSupportedMime, recordSceneStream } from './recordStream';

export type WebmInput = {
  sceneName: string;
  dsl: string;
  appearance: Appearance;
  width?: number;
  height?: number;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
  bitsPerSecond?: number;
};

const WEBM_MIMES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

export function isWebmExportSupported(): boolean {
  return pickSupportedMime(WEBM_MIMES) !== null;
}

export async function renderWebmClip(input: WebmInput): Promise<Blob> {
  return recordSceneStream({ ...input, mimeCandidates: WEBM_MIMES });
}
