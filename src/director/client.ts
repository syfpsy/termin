import PHOSPHOR_PLAYER_SOURCE from 'virtual:phosphor-player';
import type { DirectorMessage, DirectorProposal } from '../state/types';
import type { Appearance, ProviderKind } from '../engine/types';
import type { ModelProviderConfig } from '../state/modelProviders';
import {
  buildPhosphorBundle,
  bundleFileName,
  htmlFileName,
  isLikelyPhosphorBundleText,
  meFileName,
  parsePhosphorBundleJson,
  PHOSPHOR_BUNDLE_MIME,
  serializePhosphorBundle,
  type PhosphorBundle,
} from '../export/bundle';
import { renderPhosphorEmbedHtml } from '../export/htmlEmbed';
import { renderPngSequenceZip } from '../export/renderWorkers/pngSequence';
import { isWebmExportSupported, renderWebmClip } from '../export/renderWorkers/webm';
import { isMp4ExportSupported, renderMp4Clip } from '../export/renderWorkers/mp4';
import { renderGifClip } from '../export/renderWorkers/gif';
import { buildLoopUrl, type LoopUrlResult } from '../export/loopUrl';
import { renderSvgPoster, svgFileName } from '../export/renderWorkers/svg';

export type DirectorRequest = {
  prompt: string;
  currentDsl: string;
  provider: ProviderKind;
  providerConfig?: Pick<ModelProviderConfig, 'apiKey' | 'model' | 'baseUrl'>;
  history: DirectorMessage[];
};

export async function requestDirector(request: DirectorRequest): Promise<DirectorProposal> {
  const response = await fetch('/api/director', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Director request failed with ${response.status}`);
  }

  const json = (await response.json()) as Omit<DirectorProposal, 'id'>;
  return {
    id: crypto.randomUUID(),
    ...json,
  };
}

export function exportMeFile(sceneName: string, dsl: string) {
  downloadBlob(meFileName(sceneName), dsl, 'text/plain;charset=utf-8');
}

export function exportHtmlEmbed(sceneName: string, dsl: string, appearance: Appearance) {
  const bundle = buildPhosphorBundle({ sceneName, dsl, appearance });
  const html = renderPhosphorEmbedHtml({ bundle, playerSource: PHOSPHOR_PLAYER_SOURCE });
  downloadBlob(htmlFileName(bundle.scene.name), html, 'text/html;charset=utf-8');
}

export function exportBundleJson(sceneName: string, dsl: string, appearance: Appearance) {
  const bundle = buildPhosphorBundle({ sceneName, dsl, appearance });
  downloadBlob(bundleFileName(bundle.scene.name), serializePhosphorBundle(bundle), `${PHOSPHOR_BUNDLE_MIME};charset=utf-8`);
}

export type RenderExportOptions = {
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
};

export async function exportPngSequence(
  sceneName: string,
  dsl: string,
  appearance: Appearance,
  options: RenderExportOptions = {},
) {
  const bundle = buildPhosphorBundle({ sceneName, dsl, appearance });
  const blob = await renderPngSequenceZip({
    sceneName: bundle.scene.name,
    dsl: bundle.scene.source,
    appearance: bundle.appearance,
    onProgress: options.onProgress,
    signal: options.signal,
  });
  downloadBlobObject(`${safeStem(bundle.scene.name)}.png-seq.zip`, blob);
}

export async function exportWebm(
  sceneName: string,
  dsl: string,
  appearance: Appearance,
  options: RenderExportOptions = {},
) {
  if (!isWebmExportSupported()) {
    throw new Error('This browser cannot record WebM. Try Chrome or Firefox.');
  }
  const bundle = buildPhosphorBundle({ sceneName, dsl, appearance });
  const blob = await renderWebmClip({
    sceneName: bundle.scene.name,
    dsl: bundle.scene.source,
    appearance: bundle.appearance,
    onProgress: options.onProgress,
    signal: options.signal,
  });
  downloadBlobObject(`${safeStem(bundle.scene.name)}.webm`, blob);
}

export async function exportMp4(
  sceneName: string,
  dsl: string,
  appearance: Appearance,
  options: RenderExportOptions = {},
) {
  if (!isMp4ExportSupported()) {
    throw new Error('This browser cannot record MP4. Try Chrome, Edge, or Safari 14.1+.');
  }
  const bundle = buildPhosphorBundle({ sceneName, dsl, appearance });
  const blob = await renderMp4Clip({
    sceneName: bundle.scene.name,
    dsl: bundle.scene.source,
    appearance: bundle.appearance,
    onProgress: options.onProgress,
    signal: options.signal,
  });
  downloadBlobObject(`${safeStem(bundle.scene.name)}.mp4`, blob);
}

export async function exportGif(
  sceneName: string,
  dsl: string,
  appearance: Appearance,
  options: RenderExportOptions = {},
) {
  const bundle = buildPhosphorBundle({ sceneName, dsl, appearance });
  const blob = await renderGifClip({
    sceneName: bundle.scene.name,
    dsl: bundle.scene.source,
    appearance: bundle.appearance,
    onProgress: options.onProgress,
    signal: options.signal,
  });
  downloadBlobObject(`${safeStem(bundle.scene.name)}.gif`, blob);
}

export function exportSvgPoster(sceneName: string, dsl: string, appearance: Appearance) {
  const bundle = buildPhosphorBundle({ sceneName, dsl, appearance });
  const svg = renderSvgPoster({
    sceneName: bundle.scene.name,
    dsl: bundle.scene.source,
    appearance: bundle.appearance,
  });
  downloadBlobObject(svgFileName(bundle.scene.name), new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
}

export async function exportLoopUrl(
  sceneName: string,
  dsl: string,
  appearance: Appearance,
): Promise<LoopUrlResult> {
  const result = await buildLoopUrl({ sceneName, dsl, appearance });
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(result.url);
    } catch {
      // Clipboard may be blocked (permissions, insecure context). Caller still has the URL.
    }
  }
  return result;
}

export { isWebmExportSupported, isMp4ExportSupported };

export async function readSceneFile(file: File): Promise<{
  dsl: string;
  appearance?: Appearance;
  bundle?: PhosphorBundle;
}> {
  const text = await file.text();
  const isJson = file.name.endsWith('.json') || isLikelyPhosphorBundleText(text);
  if (!isJson) return { dsl: text };

  const result = parsePhosphorBundleJson(text);
  if (!result.ok || !result.bundle) {
    throw new Error(`Invalid Phosphor bundle: ${result.errors.join(' ')}`);
  }
  return {
    dsl: result.bundle.scene.source,
    appearance: result.bundle.appearance,
    bundle: result.bundle,
  };
}

function downloadBlob(filename: string, content: string, type: string) {
  downloadBlobObject(filename, new Blob([content], { type }));
}

function downloadBlobObject(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
