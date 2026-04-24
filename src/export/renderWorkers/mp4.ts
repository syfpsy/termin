import type { Appearance } from '../../engine/types';
import { pickSupportedMime, recordSceneStream } from './recordStream';

export type Mp4Input = {
  sceneName: string;
  dsl: string;
  appearance: Appearance;
  width?: number;
  height?: number;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
  bitsPerSecond?: number;
};

const MP4_MIMES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1.64001F',
  'video/mp4',
];

export function isMp4ExportSupported(): boolean {
  return pickSupportedMime(MP4_MIMES) !== null;
}

export async function renderMp4Clip(input: Mp4Input): Promise<Blob> {
  return recordSceneStream({ ...input, mimeCandidates: MP4_MIMES });
}
