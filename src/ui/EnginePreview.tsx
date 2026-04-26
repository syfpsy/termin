import { useEffect, useMemo, useRef, useState } from 'react';
import { evaluateScene } from '../engine/primitives';
import { Grid, PhosphorBuffer } from '../engine/grid';
import { sampleSceneAppearance } from '../engine/keyframes';
import type { Appearance, ParsedScene, RendererKind } from '../engine/types';
import { renderBufferToCanvas } from '../engine/renderers/canvasRenderer';
import { WebGlPhosphorRenderer } from '../engine/renderers/webglRenderer';

export const PREVIEW_COLS = 96;
export const PREVIEW_ROWS = 36;
const COLS = PREVIEW_COLS;
const ROWS = PREVIEW_ROWS;

type EnginePreviewProps = {
  scene: ParsedScene;
  appearance: Appearance;
  renderer: RendererKind;
  tick: number;
  onionSkin?: boolean;
};

export function EnginePreview({ scene, appearance, renderer, tick, onionSkin = false }: EnginePreviewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onionPrevRef = useRef<HTMLCanvasElement | null>(null);
  const onionNextRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef(new Grid(COLS, ROWS));
  const bufferRef = useRef(new PhosphorBuffer(COLS, ROWS));
  const onionGridRef = useRef(new Grid(COLS, ROWS));
  const onionBufferRef = useRef(new PhosphorBuffer(COLS, ROWS));
  const webglRef = useRef<WebGlPhosphorRenderer | null>(null);
  const lastTickRef = useRef(-1);
  const fingerprintRef = useRef('');
  const [size, setSize] = useState({ width: 640, height: 420 });
  const [error, setError] = useState<string | null>(null);

  const fingerprint = useMemo(
    () => `${scene.lines.map((line) => line.raw).join('\n')}|${appearance.tickRate}`,
    [scene, appearance.tickRate],
  );

  const liveAppearance = useMemo(
    () => sampleSceneAppearance(scene, appearance, (tick * 1000) / appearance.tickRate),
    [appearance, scene, tick],
  );

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const buffer = bufferRef.current;
    const grid = gridRef.current;
    const dt = 1000 / appearance.tickRate;
    const needsReplay = fingerprintRef.current !== fingerprint || tick <= lastTickRef.current;

    if (needsReplay) {
      buffer.reset();
      lastTickRef.current = -1;
      fingerprintRef.current = fingerprint;
    }

    const start = needsReplay ? 0 : lastTickRef.current + 1;
    for (let nextTick = start; nextTick <= tick; nextTick += 1) {
      const tickAtMs = (nextTick * 1000) / appearance.tickRate;
      const sampled = sampleSceneAppearance(scene, appearance, tickAtMs);
      evaluateScene(scene, grid, nextTick, appearance.tickRate);
      buffer.update(grid, dt, sampled.decay);
    }
    lastTickRef.current = tick;

    const currentMs = (tick * 1000) / appearance.tickRate;
    const renderedAppearance = sampleSceneAppearance(scene, appearance, currentMs);

    try {
      setError(null);
      if (renderer === 'webgl') {
        if (!webglRef.current) webglRef.current = new WebGlPhosphorRenderer(canvas);
        webglRef.current.render(buffer, renderedAppearance, size.width, size.height, tick * dt);
      } else {
        webglRef.current = null;
        renderBufferToCanvas(canvas, buffer, renderedAppearance, size);
      }
    } catch (renderError) {
      webglRef.current = null;
      const message = renderError instanceof Error ? renderError.message : 'Renderer failed.';
      setError(message);
      renderBufferToCanvas(canvas, buffer, renderedAppearance, size);
    }

    if (onionSkin) {
      const prevCanvas = onionPrevRef.current;
      const nextCanvas = onionNextRef.current;
      const onionGrid = onionGridRef.current;
      const onionBuffer = onionBufferRef.current;
      const dim: Appearance = { ...renderedAppearance, bloom: renderedAppearance.bloom * 0.4 };

      if (prevCanvas && tick > 0) {
        onionBuffer.reset();
        const onionStart = Math.max(0, tick - 6);
        for (let i = onionStart; i < tick; i += 1) {
          const ms = (i * 1000) / appearance.tickRate;
          const sampled = sampleSceneAppearance(scene, appearance, ms);
          evaluateScene(scene, onionGrid, i, appearance.tickRate);
          onionBuffer.update(onionGrid, dt, sampled.decay);
        }
        renderBufferToCanvas(prevCanvas, onionBuffer, dim, size);
      } else if (prevCanvas) {
        const ctx = prevCanvas.getContext('2d');
        ctx?.clearRect(0, 0, prevCanvas.width, prevCanvas.height);
      }

      if (nextCanvas) {
        onionBuffer.reset();
        const lookahead = Math.min(durationTicksFor(scene, appearance.tickRate), tick + 6);
        for (let i = 0; i <= lookahead; i += 1) {
          const ms = (i * 1000) / appearance.tickRate;
          const sampled = sampleSceneAppearance(scene, appearance, ms);
          evaluateScene(scene, onionGrid, i, appearance.tickRate);
          onionBuffer.update(onionGrid, dt, sampled.decay);
        }
        renderBufferToCanvas(nextCanvas, onionBuffer, dim, size);
      }
    }
  }, [appearance, fingerprint, onionSkin, renderer, scene, size, tick]);

  return (
    <div ref={frameRef} className={`crt crt--${appearance.chrome}`}>
      {onionSkin && (
        <>
          <canvas ref={onionPrevRef} className="crt__onion crt__onion--prev" aria-hidden="true" />
          <canvas ref={onionNextRef} className="crt__onion crt__onion--next" aria-hidden="true" />
        </>
      )}
      <canvas ref={canvasRef} className="crt__canvas" aria-label="Phosphor scene preview" />
      <div className="crt__scan" style={{ opacity: liveAppearance.scanlines }} />
      {appearance.chrome === 'bezel' && <div className="crt__curve" />}
      {error && <div className="crt__error">{error}</div>}
    </div>
  );
}

function durationTicksFor(scene: ParsedScene, tickRate: number): number {
  return Math.max(1, Math.ceil((scene.duration / 1000) * tickRate));
}
