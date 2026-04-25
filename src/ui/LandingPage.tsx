import { useEffect, useRef, useState } from 'react';
import { parseScene } from '../engine/dsl';
import { Grid, PhosphorBuffer } from '../engine/grid';
import { evaluateScene } from '../engine/primitives';
import { renderBufferToCanvas } from '../engine/renderers/canvasRenderer';
import { DEFAULT_APPEARANCE } from '../engine/types';
import { TickClock } from '../engine/clock';

// ---------------------------------------------------------------------------
// LoopingPreview — animated canvas that loops a DSL scene at 30 Hz
// ---------------------------------------------------------------------------

const LP_COLS = 64;
const LP_ROWS = 24;

type LoopingPreviewProps = {
  dsl: string;
  width?: number;
  height?: number;
  className?: string;
};

function LoopingPreview({ dsl, width = 288, height = 162, className }: LoopingPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !container) return;

    const scene = parseScene(dsl);
    const tickRate = 30;
    const totalTicks = Math.ceil((scene.duration / 1000) * tickRate) + 5;
    let tick = 0;
    let buffer = new PhosphorBuffer(LP_COLS, LP_ROWS);
    const appearance = { ...DEFAULT_APPEARANCE, bloom: 1.2, scanlines: 0.45, decay: DEFAULT_APPEARANCE.decay };

    const clock = new TickClock(tickRate, (count) => {
      tick += count;
      if (tick > totalTicks) {
        tick = 0;
        buffer = new PhosphorBuffer(LP_COLS, LP_ROWS);
      }
      const grid = new Grid(LP_COLS, LP_ROWS);
      evaluateScene(scene, grid, tick, tickRate);
      buffer.update(grid, 1000 / tickRate, appearance.decay);
      renderBufferToCanvas(canvas, buffer, appearance, { width, height });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          clock.start();
        } else {
          clock.stop();
        }
      },
      { rootMargin: '100px' },
    );
    observer.observe(container);

    return () => {
      clock.stop();
      observer.disconnect();
    };
  }, [dsl, width, height]);

  return (
    <div ref={containerRef} className={`looping-preview-wrap ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="looping-preview"
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DSL scenes for the landing page
// ---------------------------------------------------------------------------

const HERO_DSL = `scene fosfor_boot 7s
at 0ms     type ">" amber 60ms
at 300ms   type "FOSFOR TERMINAL ENGINE v0.2" amber 300ms
at 900ms   type "[OK] grid  : 64x24 cells" 400ms
at 1400ms  type "[OK] clock : 30 Hz discrete" 400ms
at 1900ms  type "[OK] tones : phos amber green red cyan magenta" 400ms
at 2500ms  type "_" amber blink 400ms
at 3000ms  glitch "FOSFOR" 80ms burst
at 3200ms  reveal "FOSFOR" phos
at 3600ms  pulse "FOSFOR" phos 1200ms
at 5000ms  cursor "_" amber blink 400ms`;

const EXAMPLE_DSLS = [
  `scene status_panel 4s
at 0ms     type "SYSTEM STATUS" amber 200ms
at 400ms   scan-line "" 800ms
at 500ms   type "[OK] core   : online" 300ms
at 900ms   type "[OK] memory : 4096 mb" 300ms
at 1300ms  type "[OK] net    : connected" 300ms
at 1800ms  pulse "READY" phos 800ms
at 2800ms  cursor "_" blink 400ms`,

  `scene fault_alert 3s
at 0ms     flash "" red 80ms
at 100ms   type "!! FAULT DETECTED !!" red 200ms
at 500ms   glitch "CORE DUMP" 80ms burst
at 800ms   type ">> trace: 0xDEAD.BEEF" 300ms
at 1200ms  type ">> halting sequence..." 400ms
at 1800ms  pulse "HALT" red 600ms
at 2600ms  cursor "_" red blink 400ms`,

  `scene data_wipe 3.5s
at 0ms     type "SECURE ERASE" amber 200ms
at 400ms   wave "░░░░░░░░░░░░░░░░░░░░░░" 1400ms
at 600ms   type "erasing..." 300ms
at 1400ms  type "zeroing..."  300ms
at 2000ms  wipe "" 600ms
at 2800ms  type "done." phos 200ms`,
];

// ---------------------------------------------------------------------------
// Changelog data
// ---------------------------------------------------------------------------

type ChangelogEntry = {
  version: string;
  date: string;
  tag: string;
  items: string[];
};

const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'v0.2.1',
    date: '2025-04',
    tag: 'current',
    items: [
      'Landing page: animated hero with looping CRT preview, release strip, how-it-works, live examples, pricing',
      'Docs sub-page: accordion with scene syntax, effects reference, tones, sound presets, keyboard shortcuts',
      'Changelog sub-page: versioned release notes with accordion',
      'Auth gate: landing shown to unauthenticated visitors; "Open the app" allows guest studio access',
      'CRT glow / breathe / glitch keyframes added to styles.css',
      'package.json version synced to 0.2.1',
    ],
  },
  {
    version: 'v0.2.0',
    date: '2025-04',
    tag: '',
    items: [
      'Sound library with 20 synthesized presets (beep-high, scan, data-burst, alarm…)',
      'Transition wedge handles for intro/outro easing, fully keyboard-accessible',
      'Left-resize drag + keyboard nudge (Arrow keys) for event start time',
      'Effect picker inline on timeline — click lane, pick effect, no panel needed',
      'Marquee box-select rewritten to use time-range arithmetic (no DOM jitter)',
      'Tone color map extracted to shared tones.ts — single source of truth',
      'Event bars promoted from span[role=button] to native <button>',
    ],
  },
  {
    version: 'v0.1.0',
    date: '2025-01',
    tag: 'initial release',
    items: [
      '13 composable animation primitives (type, cursor, pulse, glitch, wave, wipe…)',
      'DSL notation editor with live parse feedback',
      'Canvas renderer with phosphor glow, bloom, and scanline pass',
      'Keyframe animation for intensity and timing offset per event',
      'AI director panel — describe changes in plain language',
      'Export: HTML embed, .me source, PNG sequence, WebM/MP4, GIF, SVG',
      'Project model with multi-scene support and IndexedDB persistence',
    ],
  },
];

// ---------------------------------------------------------------------------
// Docs data
// ---------------------------------------------------------------------------

type DocsSection = {
  title: string;
  content: React.ReactNode;
};

const DOCS_SECTIONS: DocsSection[] = [
  {
    title: 'Writing a scene',
    content: (
      <>
        <p>A scene starts with a header line, then one event per line:</p>
        <pre className="lp-code">{`scene my_scene 3s
at 0ms    type "HELLO WORLD" amber 300ms
at 800ms  pulse "HELLO WORLD" phos 600ms
at 1600ms cursor "_" blink 400ms`}</pre>
        <p>The <code>at</code> keyword sets when the event fires in milliseconds. Duration (e.g. <code>300ms</code>) controls how long the effect runs.</p>
      </>
    ),
  },
  {
    title: 'Effects reference',
    content: (
      <>
        <p>All 13 primitives and what they do:</p>
        <dl className="lp-effect-list">
          {[
            ['type', 'types the target string glyph-by-glyph'],
            ['reveal', 'fades in all glyphs simultaneously'],
            ['cursor', 'blinking cursor with configurable duty cycle'],
            ['pulse', 'intensity ramp up and down'],
            ['glitch', 'randomises cells in the target region'],
            ['scan-line', 'sweeps a horizontal scan across the grid'],
            ['wave', 'applies a sinusoidal row offset'],
            ['wipe', 'distance-based reveal from a corner'],
            ['decay-trail', 'leaves a phosphor decay trail'],
            ['dither', 'bayer-pattern brightness ramp'],
            ['shake', 'row-tear distortion'],
            ['flash', 'full-screen spike then decay'],
            ['counter', 'rolls up numeric digits'],
          ].map(([name, desc]) => (
            <div key={name}>
              <dt><code>{name}</code></dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
      </>
    ),
  },
  {
    title: 'Tones',
    content: (
      <>
        <p>Six named tones map to phosphor color profiles. Add them as modifiers:</p>
        <pre className="lp-code">{`at 0ms type "ALERT" red 200ms
at 400ms pulse "OK" green 600ms`}</pre>
        <div className="lp-tones">
          {[
            { name: 'phos', color: '#D6F04A' },
            { name: 'amber', color: '#FFA94B' },
            { name: 'green', color: '#7FE093' },
            { name: 'red', color: '#FF6B6B' },
            { name: 'cyan', color: '#7FE3E0' },
            { name: 'magenta', color: '#E77FD9' },
          ].map(({ name, color }) => (
            <span key={name} className="lp-tone-chip" style={{ '--chip-color': color } as React.CSSProperties}>
              {name}
            </span>
          ))}
        </div>
      </>
    ),
  },
  {
    title: 'Sound presets',
    content: (
      <>
        <p>Add <code>sound:&lt;preset&gt;</code> as a modifier on any event:</p>
        <pre className="lp-code">{`at 0ms type "BOOT" amber sound:power-up
at 2000ms flash "" red sound:alarm`}</pre>
        <p>Available presets: <code>beep-low</code>, <code>beep-high</code>, <code>click</code>, <code>blip</code>, <code>swish</code>, <code>chime</code>, <code>scan</code>, <code>data-burst</code>, <code>process</code>, <code>access</code>, <code>alarm</code>, <code>error</code>, <code>power-up</code>, <code>power-down</code>, <code>boot</code>, <code>ping</code>, <code>complete</code>, <code>glitch-noise</code>, <code>static</code>, <code>charge</code>.</p>
      </>
    ),
  },
  {
    title: 'Keyboard shortcuts',
    content: (
      <dl className="lp-shortcut-list">
        {[
          ['space', 'play / pause'],
          [', / .', 'step ±1 frame'],
          ['⌘ Z / ⌘⇧Z', 'undo / redo'],
          ['⌘ A', 'select all events'],
          ['drag bar', 'move event'],
          ['drag right edge', 'resize event'],
          ['drag transition wedge', 'set intro/outro easing'],
          ['Arrow keys', 'nudge ±1 tick (Shift = ±10)'],
          ['⌘ C / ⌘ V', 'copy / paste events'],
          ['Delete / Backspace', 'delete selected'],
          ['M', 'drop marker at playhead'],
          ['?', 'toggle shortcuts overlay'],
        ].map(([key, desc]) => (
          <div key={key}>
            <dt><kbd>{key}</kbd></dt>
            <dd>{desc}</dd>
          </div>
        ))}
      </dl>
    ),
  },
];

// ---------------------------------------------------------------------------
// Sub-pages
// ---------------------------------------------------------------------------

function DocsPage({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="lp-subpage">
      <div className="lp-subpage__header">
        <button className="lp-back" onClick={onBack} type="button">
          ← back
        </button>
        <h2 className="lp-subpage__title">DOCS</h2>
      </div>
      <div className="lp-subpage__body">
        <div className="lp-accordion">
          {DOCS_SECTIONS.map((section, i) => (
            <div key={section.title} className={`lp-accordion__item ${open === i ? 'is-open' : ''}`}>
              <button
                type="button"
                className="lp-accordion__trigger"
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span>{section.title}</span>
                <span className="lp-accordion__chevron" aria-hidden="true">
                  {open === i ? '▲' : '▼'}
                </span>
              </button>
              {open === i && (
                <div className="lp-accordion__body">{section.content}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChangelogPage({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState<number>(0);

  return (
    <div className="lp-subpage">
      <div className="lp-subpage__header">
        <button className="lp-back" onClick={onBack} type="button">
          ← back
        </button>
        <h2 className="lp-subpage__title">RELEASE NOTES</h2>
      </div>
      <div className="lp-subpage__body">
        <div className="lp-accordion">
          {CHANGELOG.map((entry, i) => (
            <div key={entry.version} className={`lp-accordion__item ${open === i ? 'is-open' : ''}`}>
              <button
                type="button"
                className="lp-accordion__trigger"
                aria-expanded={open === i}
                onClick={() => setOpen(i)}
              >
                <span className="lp-changelog__version">
                  {entry.version}
                  {entry.tag === 'current' && <span className="lp-tag lp-tag--current">current</span>}
                </span>
                <span className="lp-changelog__date">{entry.date}</span>
                <span className="lp-accordion__chevron" aria-hidden="true">
                  {open === i ? '▲' : '▼'}
                </span>
              </button>
              {open === i && (
                <ul className="lp-changelog__list">
                  {entry.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main LandingPage
// ---------------------------------------------------------------------------

type Page = 'home' | 'docs' | 'changelog';

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [page, setPage] = useState<Page>('home');

  if (page === 'docs') return <DocsPage onBack={() => setPage('home')} />;
  if (page === 'changelog') return <ChangelogPage onBack={() => setPage('home')} />;

  return (
    <div className="lp">
      {/* Nav */}
      <header className="lp-nav" aria-label="Site navigation">
        <div className="lp-nav__brand">
          <span className="lp-nav__mark" aria-hidden="true" />
          <span className="lp-nav__name">FOSFOR</span>
        </div>
        <nav className="lp-nav__links" aria-label="Landing navigation">
          <button type="button" className="lp-nav__link" onClick={() => setPage('docs')}>
            docs
          </button>
          <button type="button" className="lp-nav__link" onClick={() => setPage('changelog')}>
            changelog
          </button>
        </nav>
        <button type="button" className="lp-cta lp-cta--sm" onClick={onEnter}>
          Open the app →
        </button>
      </header>

      {/* Hero */}
      <section className="lp-hero" aria-label="Hero">
        <div className="lp-hero__left">
          <p className="lp-hero__eyebrow">terminal animation engine</p>
          <h1 className="lp-hero__headline">
            Compose <span className="lp-hero__accent">motion</span><br />
            in ASCII.
          </h1>
          <p className="lp-hero__sub">
            Write scenes in a minimal notation. Watch them play back as
            phosphor-lit terminal animations — in the browser, zero dependencies.
          </p>
          <div className="lp-hero__actions">
            <button type="button" className="lp-cta" onClick={onEnter}>
              Open the app →
            </button>
            <button type="button" className="lp-ghost" onClick={() => setPage('docs')}>
              read docs
            </button>
          </div>
          <p className="lp-hero__free">
            <span className="lp-free-badge">FREE</span>
            No account needed. Runs entirely in your browser.
          </p>
        </div>

        <div className="lp-hero__right">
          <div className="lp-crt-frame" aria-hidden="true">
            <div className="lp-crt-bezel">
              <LoopingPreview dsl={HERO_DSL} width={448} height={252} />
            </div>
            <div className="lp-crt-glow" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* Latest release strip */}
      <div className="lp-release-strip" aria-label="Latest release">
        <span className="lp-release-strip__label">latest</span>
        <span className="lp-release-strip__version">v0.2.1</span>
        <span className="lp-release-strip__items">
          Landing page · Docs · Changelog · Auth gate · CRT glow animations
        </span>
        <button
          type="button"
          className="lp-release-strip__link"
          onClick={() => setPage('changelog')}
        >
          full notes →
        </button>
      </div>

      {/* How it works */}
      <section className="lp-how" aria-label="How it works">
        <h2 className="lp-section-title">HOW IT WORKS</h2>
        <div className="lp-how__steps">
          <div className="lp-step">
            <span className="lp-step__num">01</span>
            <div className="lp-step__body">
              <h3>Write a scene</h3>
              <p>
                Describe your animation in plain notation — when effects fire,
                what they target, how long they run.
              </p>
              <pre className="lp-code">{`scene boot 3s
at 0ms    type "INITIALISING" amber
at 800ms  pulse "READY" phos 600ms`}</pre>
            </div>
          </div>
          <div className="lp-step">
            <span className="lp-step__num">02</span>
            <div className="lp-step__body">
              <h3>See it live</h3>
              <p>
                The engine evaluates your scene tick-by-tick at 30 Hz and renders
                it to canvas with per-cell phosphor glow and decay.
              </p>
              <MiniPreviewInline dsl={`scene boot 3s\nat 0ms type "INITIALISING" amber 400ms\nat 800ms pulse "READY" phos 600ms\nat 1800ms cursor "_" blink 400ms`} />
            </div>
          </div>
          <div className="lp-step">
            <span className="lp-step__num">03</span>
            <div className="lp-step__body">
              <h3>Export anywhere</h3>
              <p>
                Export as a self-contained HTML embed, share via a loop URL,
                or render to GIF / WebM / MP4 — all from the browser.
              </p>
              <pre className="lp-code">{`<!-- one script tag, no dependencies -->
<script src="phosphor-player.js"
  data-scene="..."></script>`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="lp-features" aria-label="Features">
        <h2 className="lp-section-title">WHAT'S INSIDE</h2>
        <div className="lp-features__grid">
          {[
            {
              glyph: 'T',
              title: '13 animation primitives',
              body: 'type, cursor, pulse, glitch, wave, wipe, scan-line, dither, shake, flash, counter and more.',
            },
            {
              glyph: '◆',
              title: 'Keyframe animation',
              body: 'Animate intensity and timing offset per event with a visual timeline editor.',
            },
            {
              glyph: '♫',
              title: '20 sound presets',
              body: 'Pure-synthesis audio via Web Audio — beeps, alarms, data-bursts, boot chimes. No asset files.',
            },
            {
              glyph: '~',
              title: 'AI director',
              body: 'Describe changes in plain language. The AI rewrites your scene notation and previews it before you commit.',
            },
            {
              glyph: '▶',
              title: 'Export everywhere',
              body: 'HTML embed, loop URL, GIF, WebM, MP4, PNG sequence, SVG animation — all client-side.',
            },
            {
              glyph: '#',
              title: 'Runs in the browser',
              body: 'No server. No install. No signup required. Your work is stored locally in IndexedDB.',
            },
          ].map((f) => (
            <div key={f.title} className="lp-feat">
              <span className="lp-feat__glyph" aria-hidden="true">{f.glyph}</span>
              <h3 className="lp-feat__title">{f.title}</h3>
              <p className="lp-feat__body">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live examples */}
      <section className="lp-examples" aria-label="Live examples">
        <h2 className="lp-section-title">LIVE EXAMPLES</h2>
        <div className="lp-examples__grid">
          {EXAMPLE_DSLS.map((dsl, i) => {
            const labels = ['status panel', 'fault alert', 'data wipe'];
            return (
              <div key={i} className="lp-example">
                <span className="lp-example__label">{labels[i]}</span>
                <LoopingPreview dsl={dsl} width={288} height={162} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing */}
      <section className="lp-pricing" aria-label="Pricing">
        <h2 className="lp-section-title">PRICING</h2>
        <div className="lp-pricing__cards">
          <div className="lp-price-card lp-price-card--free">
            <div className="lp-price-card__header">
              <span className="lp-price-card__tier">Free</span>
              <span className="lp-price-card__amount">$0</span>
            </div>
            <ul className="lp-price-card__list">
              <li>All 13 animation primitives</li>
              <li>Full sound library</li>
              <li>Local project storage</li>
              <li>All export formats</li>
              <li>No account required</li>
            </ul>
            <button type="button" className="lp-cta" onClick={onEnter}>
              Open the app →
            </button>
          </div>
          <div className="lp-price-card lp-price-card--cloud">
            <div className="lp-price-card__header">
              <span className="lp-price-card__tier">Cloud</span>
              <span className="lp-price-card__amount">
                <span className="lp-price-card__soon">coming soon</span>
              </span>
            </div>
            <ul className="lp-price-card__list">
              <li>Everything in Free</li>
              <li>Cloud project sync</li>
              <li>Share projects with teammates</li>
              <li>Version history</li>
              <li>Cheaply priced after release</li>
            </ul>
            <button type="button" className="lp-ghost" disabled>
              coming soon
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer" aria-label="Footer">
        <div className="lp-footer__left">
          <span className="lp-nav__mark" aria-hidden="true" />
          <span className="lp-footer__name">FOSFOR</span>
          <span className="lp-footer__copy">terminal animation engine — free, browser-native</span>
        </div>
        <nav className="lp-footer__links" aria-label="Footer navigation">
          <button type="button" className="lp-footer__link" onClick={() => setPage('docs')}>
            docs
          </button>
          <button type="button" className="lp-footer__link" onClick={() => setPage('changelog')}>
            changelog
          </button>
          <button type="button" className="lp-footer__link lp-footer__link--cta" onClick={onEnter}>
            open app →
          </button>
        </nav>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MiniPreviewInline — static single frame, inline in How It Works
// ---------------------------------------------------------------------------

function MiniPreviewInline({ dsl }: { dsl: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const obs = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); obs.disconnect(); } },
      { rootMargin: '200px' },
    );
    obs.observe(container);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = parseScene(dsl);
    const grid = new Grid(LP_COLS, LP_ROWS);
    const buffer = new PhosphorBuffer(LP_COLS, LP_ROWS);
    const tickRate = 30;
    const sampleTick = Math.max(1, Math.floor((scene.duration / 1000) * tickRate * 0.62));
    evaluateScene(scene, grid, sampleTick, tickRate);
    buffer.update(grid, 1000 / tickRate, DEFAULT_APPEARANCE.decay);
    renderBufferToCanvas(canvas, buffer, { ...DEFAULT_APPEARANCE, bloom: 1.15, scanlines: 0.45 }, { width: 288, height: 162 });
  }, [dsl, visible]);

  return (
    <div ref={containerRef} className="mini-preview-slot" aria-hidden="true">
      {visible && <canvas className="mini-preview" ref={canvasRef} width={288} height={162} />}
    </div>
  );
}
