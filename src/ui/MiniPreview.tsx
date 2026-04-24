import { useEffect, useRef, useState } from 'react';
import { parseScene } from '../engine/dsl';
import { Grid, PhosphorBuffer } from '../engine/grid';
import { evaluateScene } from '../engine/primitives';
import { renderBufferToCanvas } from '../engine/renderers/canvasRenderer';
import { DEFAULT_APPEARANCE } from '../engine/types';

const THUMB_COLS = 64;
const THUMB_ROWS = 24;
const WIDTH = 288;
const HEIGHT = 162;

export function MiniPreview({ dsl }: { dsl: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = parseScene(dsl);
    const grid = new Grid(THUMB_COLS, THUMB_ROWS);
    const buffer = new PhosphorBuffer(THUMB_COLS, THUMB_ROWS);
    const tickRate = 30;
    const sampleTick = Math.max(1, Math.floor((scene.duration / 1000) * tickRate * 0.62));
    evaluateScene(scene, grid, sampleTick, tickRate);
    buffer.update(grid, 1000 / tickRate, DEFAULT_APPEARANCE.decay);
    renderBufferToCanvas(canvas, buffer, { ...DEFAULT_APPEARANCE, bloom: 1.15, scanlines: 0.45 }, { width: WIDTH, height: HEIGHT });
  }, [dsl, visible]);

  return (
    <div ref={containerRef} className="mini-preview-slot" aria-hidden="true">
      {visible && <canvas className="mini-preview" ref={canvasRef} width={WIDTH} height={HEIGHT} />}
    </div>
  );
}
