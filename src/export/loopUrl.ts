import {
  buildPhosphorBundle,
  serializePhosphorBundle,
  type PhosphorBundle,
} from './bundle';
import type { Appearance } from '../engine/types';

export type LoopUrlInput = {
  sceneName: string;
  dsl: string;
  appearance: Appearance;
  origin?: string;
};

export type LoopUrlResult = {
  url: string;
  bytes: number;
  encodedLength: number;
  compressed: boolean;
};

const PLAY_PATH = '/play.html';
const FRAGMENT_KEY = 'play';

export async function buildLoopUrl(input: LoopUrlInput): Promise<LoopUrlResult> {
  const bundle = buildPhosphorBundle({
    sceneName: input.sceneName,
    dsl: input.dsl,
    appearance: input.appearance,
  });
  return buildLoopUrlFromBundle(bundle, input.origin);
}

export async function buildLoopUrlFromBundle(
  bundle: PhosphorBundle,
  origin?: string,
): Promise<LoopUrlResult> {
  const serialized = serializePhosphorBundle(bundle);
  const raw = new TextEncoder().encode(serialized);

  const { bytes: payload, compressed } = await maybeCompress(raw);
  const encoded = base64UrlEncode(payload);
  const prefix = compressed ? 'gz.' : 'raw.';
  const resolvedOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const url = `${resolvedOrigin}${PLAY_PATH}#${FRAGMENT_KEY}=${prefix}${encoded}`;

  return {
    url,
    bytes: raw.byteLength,
    encodedLength: encoded.length,
    compressed,
  };
}

export type DecodedLoopFragment =
  | { ok: true; json: string; compressed: boolean }
  | { ok: false; error: string };

export async function decodeLoopFragment(fragment: string): Promise<DecodedLoopFragment> {
  const hash = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  const params = new URLSearchParams(hash);
  const raw = params.get(FRAGMENT_KEY);
  if (!raw) return { ok: false, error: 'Missing play fragment.' };

  const dotIndex = raw.indexOf('.');
  if (dotIndex < 0) return { ok: false, error: 'Malformed play fragment: missing prefix.' };

  const prefix = raw.slice(0, dotIndex);
  const payload = raw.slice(dotIndex + 1);
  if (prefix !== 'gz' && prefix !== 'raw') {
    return { ok: false, error: `Unknown encoding prefix "${prefix}".` };
  }

  try {
    const bytes = base64UrlDecode(payload);
    const data = prefix === 'gz' ? await decompressGzip(bytes) : bytes;
    const json = new TextDecoder().decode(data);
    return { ok: true, json, compressed: prefix === 'gz' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to decode payload.' };
  }
}

async function maybeCompress(data: Uint8Array): Promise<{ bytes: Uint8Array; compressed: boolean }> {
  if (typeof CompressionStream === 'undefined') {
    return { bytes: data, compressed: false };
  }
  try {
    const stream = new Blob([toArrayBuffer(data)]).stream().pipeThrough(new CompressionStream('gzip'));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    if (compressed.byteLength >= data.byteLength) {
      return { bytes: data, compressed: false };
    }
    return { bytes: compressed, compressed: true };
  } catch {
    return { bytes: data, compressed: false };
  }
}

async function decompressGzip(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot decompress gzip loop URLs.');
  }
  const stream = new Blob([toArrayBuffer(data)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return ab;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const pad = value.length % 4;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + (pad ? '='.repeat(4 - pad) : '');
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
