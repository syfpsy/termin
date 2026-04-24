import { useEffect, useMemo, useRef, useState } from 'react';
import { evaluateScene } from '../engine/primitives';
import { Grid, PhosphorBuffer } from '../engine/grid';
import type { Appearance, ParsedScene, RendererKind } from '../engine/types';
import { renderBufferToCanvas } from '../engine/renderers/canvasRenderer';
import { WebGlPhosphorRenderer } from '../engine/renderers/webglRenderer';

const COLS = 96;
const ROWS = 36;

type EnginePreviewProps = {
  scene: ParsedScene;
  appearance: Appearance;
  renderer: RendererKind;
  tick: number;
};

export function EnginePreview({ scene, appearance, renderer, tick }: EnginePreviewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef(new Grid(COLS, ROWS));
  const bufferRef = useRef(new PhosphorBuffer(COLS, ROWS));
  const webglRef = useRef<WebGlPhosphorRenderer | null>(null);
  const lastTickRef = useRef(-1);
  const fingerprintRef = useRef('');
  const [size, setSize] = useState({ width: 640, height: 420 });
  const [error, setError] = useState<string | null>(null);

  const fingerprint = useMemo(
    () => `${scene.lines.map((line) => line.raw).join('\n')}|${appearance.tickRate}`,
    [scene, appearance.tickRate],
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
      evaluateScene(scene, grid, nextTick, appearance.tickRate);
      buffer.update(grid, dt, appearance.decay);
    }
    lastTickRef.current = tick;

    try {
      setError(null);
      if (renderer === 'webgl') {
        if (!webglRef.current) webglRef.current = new WebGlPhosphorRenderer(canvas);
        webglRef.current.render(buffer, appearance, size.width, size.height, tick * dt);
      } else {
        webglRef.current = null;
        renderBufferToCanvas(canvas, buffer, appearance, size);
      }
    } catch (renderError) {
      webglRef.current = null;
      const message = renderError instanceof Error ? renderError.message : 'Renderer failed.';
      setError(message);
      renderBufferToCanvas(canvas, buffer, appearance, size);
    }
  }, [appearance, fingerprint, renderer, scene, size, tick]);

  return (
    <div ref={frameRef} className={`crt crt--${appearance.chrome}`}>
      <canvas ref={canvasRef} className="crt__canvas" aria-label="Phosphor scene preview" />
      <div className="crt__scan" style={{ opacity: appearance.scanlines }} />
      {appearance.chrome === 'bezel' && <div className="crt__curve" />}
      {error && <div className="crt__error">{error}</div>}
    </div>
  );
}
