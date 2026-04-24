import { useEffect, useRef } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
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
  }, [dsl]);

  return <canvas className="mini-preview" ref={canvasRef} width={WIDTH} height={HEIGHT} aria-hidden="true" />;
}
