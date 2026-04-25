import { parseScene } from '../engine/dsl';
import { Grid, PhosphorBuffer } from '../engine/grid';
import { sampleSceneAppearance } from '../engine/keyframes';
import { evaluateScene } from '../engine/primitives';
import { renderBufferToCanvas } from '../engine/renderers/canvasRenderer';
import type { Appearance, ParsedScene } from '../engine/types';
import { validatePhosphorBundle, type PhosphorBundle } from '../export/bundle';

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 720;

export class PhosphorPlayerElement extends HTMLElement {
  static observedAttributes = ['src'];

  private readonly shadowRootRef: ShadowRoot;
  private readonly canvas: HTMLCanvasElement;
  private readonly status: HTMLDivElement;
  private readonly grid = new Grid(96, 36);
  private readonly buffer = new PhosphorBuffer(96, 36);
  private readonly resizeObserver: ResizeObserver;
  private bundle: PhosphorBundle | null = null;
  private scene: ParsedScene | null = null;
  private appearance: Appearance | null = null;
  private animationFrame = 0;
  private startedAt = 0;
  private lastTick = -1;
  private width = DEFAULT_WIDTH;
  private height = DEFAULT_HEIGHT;

  constructor() {
    super();
    this.shadowRootRef = this.attachShadow({ mode: 'open' });
    this.canvas = document.createElement('canvas');
    this.status = document.createElement('div');
    this.status.setAttribute('part', 'status');
    this.canvas.setAttribute('part', 'canvas');
    this.canvas.setAttribute('aria-label', 'Phosphor scene');
    this.shadowRootRef.innerHTML = `
      <style>
        :host {
          display: block;
          contain: content;
          position: relative;
          background: #050604;
          color: #d6f04a;
          inline-size: 100%;
          min-block-size: 120px;
          aspect-ratio: 4 / 3;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }
        canvas {
          display: block;
          inline-size: 100%;
          block-size: 100%;
          background: #050604;
        }
        [part="status"] {
          position: absolute;
          inset-inline: 8px;
          inset-block-end: 8px;
          color: #ffa94b;
          font-size: 11px;
          pointer-events: none;
        }
        :host([hidden]) {
          display: none;
        }
      </style>
    `;
    this.shadowRootRef.append(this.canvas, this.status);
    this.resizeObserver = new ResizeObserver(() => this.resize());
  }

  connectedCallback() {
    this.resizeObserver.observe(this);
    void this.loadFromElement();
  }

  disconnectedCallback() {
    this.resizeObserver.disconnect();
    cancelAnimationFrame(this.animationFrame);
  }

  attributeChangedCallback() {
    if (this.isConnected) void this.loadFromElement();
  }

  async loadBundle(input: unknown) {
    const result = validatePhosphorBundle(input);
    if (!result.ok || !result.bundle) {
      this.showError(`Invalid Phosphor bundle: ${result.errors.join(' ')}`);
      return;
    }
    this.bundle = result.bundle;
    this.scene = parseScene(result.bundle.scene.source);
    this.appearance = result.bundle.appearance;
    this.startedAt = performance.now();
    this.lastTick = -1;
    this.buffer.reset();
    this.status.textContent = '';
    this.play();
  }

  private async loadFromElement() {
    const src = this.getAttribute('src');
    if (src) {
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        await this.loadBundle(await response.json());
      } catch (error) {
        this.showError(error instanceof Error ? error.message : 'Failed to load bundle.');
      }
      return;
    }

    const script = this.querySelector('script[type="application/vnd.phosphor.bundle+json"], script[type="application/json"]');
    if (!script?.textContent) {
      this.showError('Missing Phosphor bundle. Use src or an inline JSON script.');
      return;
    }

    try {
      await this.loadBundle(JSON.parse(script.textContent));
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Invalid inline bundle JSON.');
    }
  }

  private resize() {
    const rect = this.getBoundingClientRect();
    this.width = Math.max(1, Math.floor(rect.width || DEFAULT_WIDTH));
    this.height = Math.max(1, Math.floor(rect.height || DEFAULT_HEIGHT));
  }

  private play() {
    cancelAnimationFrame(this.animationFrame);
    const render = (now: number) => {
      this.render(now);
      this.animationFrame = requestAnimationFrame(render);
    };
    this.animationFrame = requestAnimationFrame(render);
  }

  private render(now: number) {
    if (!this.bundle || !this.scene || !this.appearance) return;

    const loopStart = Math.max(0, this.bundle.scene.loop.startMs);
    const duration = Math.max(1, this.bundle.scene.loop.endMs - loopStart);
    const playbackMs = loopStart + ((now - this.startedAt) % duration);
    const tick = Math.floor((playbackMs / 1000) * this.appearance.tickRate);
    const dt = 1000 / this.appearance.tickRate;

    if (tick <= this.lastTick) {
      this.buffer.reset();
      this.lastTick = -1;
    }

    for (let nextTick = this.lastTick + 1; nextTick <= tick; nextTick += 1) {
      const atMs = (nextTick * 1000) / this.appearance.tickRate;
      const sampled = sampleSceneAppearance(this.scene, this.appearance, atMs);
      evaluateScene(this.scene, this.grid, nextTick, this.appearance.tickRate);
      this.buffer.update(this.grid, dt, sampled.decay);
    }

    this.lastTick = tick;
    const renderAppearance = sampleSceneAppearance(this.scene, this.appearance, playbackMs);
    renderBufferToCanvas(this.canvas, this.buffer, renderAppearance, {
      width: this.width,
      height: this.height,
    });
  }

  private showError(message: string) {
    cancelAnimationFrame(this.animationFrame);
    this.status.textContent = message;
  }
}

if (!customElements.get('phosphor-player')) {
  customElements.define('phosphor-player', PhosphorPlayerElement);
}
