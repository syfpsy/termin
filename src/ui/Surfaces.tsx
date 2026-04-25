import {
  ArrowRight,
  Code2,
  Copy,
  Download,
  FileJson,
  GitFork,
  Link2,
  SlidersHorizontal,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { exportBundleJson, exportHtmlEmbed, exportMeFile } from '../director/client';
import { buildLoopUrl, type LoopUrlResult } from '../export/loopUrl';
import { estimateEventDuration, eventTone } from '../engine/dsl';
import type { Appearance, ParsedScene, ProviderKind, RendererKind, TickRate } from '../engine/types';
import { ASSET_CATALOG } from '../assets/catalog';
import { EXPORT_TARGETS, type ExportJob, type ExportTarget } from '../export/queue';
import { SCENE_LIBRARY, type LibraryScene } from '../scenes/library';
import {
  DEFAULT_MODEL_PROVIDERS,
  providerHasUserKey,
  PROVIDER_ORDER,
  type ModelProviderConfig,
} from '../state/modelProviders';
import { Button, Label, Panel, Phos, Segmented, SliderRow } from './components';
import { MiniPreview } from './MiniPreview';

type SharedSurfaceProps = {
  dsl: string;
  scene: ParsedScene;
  appearance: Appearance;
  renderer: RendererKind;
  provider: ProviderKind;
  providerConfigs: Record<ProviderKind, ModelProviderConfig>;
  jobs: ExportJob[];
  animatedProps?: Set<string>;
  onForkScene: (scene: LibraryScene) => void;
  onDslChange: (dsl: string) => void;
  onAppearanceChange: (patch: Partial<Appearance>) => void;
  onRendererChange: (renderer: RendererKind) => void;
  onProviderChange: (provider: ProviderKind) => void;
  onProviderConfigChange?: (config: ModelProviderConfig) => void;
  onCreateJob: (target: ExportTarget) => void;
  onOpenAuthor: () => void;
  onAppearanceKeyframe?: (prop: 'decay' | 'bloom' | 'scanlines' | 'curvature' | 'flicker' | 'chromatic') => void;
};

const EFFECT_DETAILS = [
  { name: 'type', notation: 'at 0ms type "SYSTEM ONLINE" slowly', params: ['speed', 'jitter', 'tone'], note: 'Reveals glyphs by tick; never animates by CSS frame.' },
  { name: 'cursor', notation: 'at 1200ms cursor "_" blink 500ms', params: ['glyph', 'period', 'duty'], note: 'Toggles on the fixed clock and lands after the last reveal.' },
  { name: 'scan-line', notation: 'at 300ms scan-line row 18 400ms', params: ['row', 'duration', 'tone'], note: 'Writes a bright row sweep into the grid; decay does the trail.' },
  { name: 'glitch', notation: 'at 900ms glitch "SYSTEM READY" 80ms burst', params: ['duration', 'density', 'seed'], note: 'Corrupts target glyphs plus nearby cells using deterministic tick noise.' },
  { name: 'pulse', notation: 'at 1200ms pulse "warming phosphor" amber 600ms', params: ['duration', 'tone', 'curve'], note: 'Intensity ramps up and down once, then lets the buffer decay.' },
  { name: 'decay-trail', notation: 'at 0ms trail "*" path(8,25 18,22 48,18) 45ms/step', params: ['path', 'step', 'glyph'], note: 'Writes a moving point; phosphor buffer owns the blur.' },
  { name: 'dither', notation: 'at 0ms dither ramp 0->1 bayer4 900ms', params: ['matrix', 'duration', 'density'], note: 'Uses ordered cells rather than alpha for ramps.' },
  { name: 'wave', notation: 'at 0ms wave "signal carrier" 1200ms', params: ['amplitude', 'period', 'text'], note: 'Offsets glyph rows discretely by sine phase.' },
  { name: 'wipe', notation: 'at 400ms wipe "ARCHIVE RESTORED" diagonal 700ms', params: ['direction', 'duration', 'field'], note: 'Distance-field reveal over a single target.' },
  { name: 'loop', notation: 'at 0ms loop "<<< >>> <<< >>>"', params: ['period', 'phase', 'section'], note: 'Marks repeating material for future seamless loop authoring.' },
  { name: 'shake', notation: 'at 600ms shake "SYSTEM FAULT" 3px 200ms', params: ['amount', 'duration', 'noise'], note: 'Per-tick horizontal row tear.' },
  { name: 'flash', notation: 'at 980ms flash "screen" 80ms', params: ['duration', 'intensity', 'tone'], note: 'Whole-screen spike written into sparse cells.' },
  { name: 'counter', notation: 'at 0ms counter "USERS: " from 0 to 1247 800ms ease-out', params: ['from', 'to', 'duration', 'easing', 'format'], note: 'Animates a number; format:k or format:pct switch the display.' },
];

export function StartSurface({ onForkScene, onOpenAuthor }: Pick<SharedSurfaceProps, 'onForkScene' | 'onOpenAuthor'>) {
  const featured = SCENE_LIBRARY.slice(0, 6);
  const first = SCENE_LIBRARY[0];
  return (
    <section className="surface surface--start">
      <header className="start-signal">
        <Phos size={74}>PHOSPHOR</Phos>
        <p>
          A terminal-art motion design tool. Describe a scene in plain language, edit a small text DSL, scrub the
          timeline like After Effects, and export a self-contained loop you can drop into any web app.
        </p>
        <div className="start-actions">
          <Button tone="prim" icon={<ArrowRight size={14} />} onClick={onOpenAuthor}>
            open studio
          </Button>
          <Button icon={<GitFork size={14} />} onClick={() => onForkScene(first)}>
            fork boot sequence
          </Button>
          <a className="start-docs-link" href="#docs">
            read the docs →
          </a>
        </div>
      </header>

      <div className="promise-grid">
        {[
          {
            label: 'describe motion',
            copy: 'AI director drafts .me notation from plain language; you commit, preview, or rewrite.',
          },
          {
            label: 'edit on a real timeline',
            copy: 'Drag, resize, snap, mute / solo / lock, multi-select, ripple, markers, loop region, history.',
          },
          {
            label: 'animate appearance',
            copy: 'Per-property keyframes with linear / ease-in / ease-out / hold, edited via diamonds on the timeline.',
          },
          {
            label: 'export anywhere',
            copy: '.me, .phosphor.json, HTML, MP4, WebM, GIF, animated SVG, PNG sequence, loop URL — all locally.',
          },
          {
            label: 'drop into your app',
            copy: 'A 28 kB phosphor-player web component plays bundles in any framework.',
          },
          {
            label: 'distinct on purpose',
            copy: 'Phosphor green, amber, cyan, magenta. Bezel CRT framing. No glassmorphism, no AI-slop palette.',
          },
        ].map(({ label, copy }, index) => (
          <Panel key={label} title={`0${index + 1}`} dense>
            <Phos size={28}>{label}</Phos>
            <p className="surface-copy">{copy}</p>
          </Panel>
        ))}
      </div>

      <Panel title="START FROM A SEED" flags={`${SCENE_LIBRARY.length} library scenes`} flush>
        <div className="surface-grid surface-grid--start">
          {featured.map((scene) => (
            <button
              key={scene.id}
              type="button"
              className="scene-card"
              onClick={() => {
                onForkScene(scene);
                onOpenAuthor();
              }}
            >
              <div>
                <Label>{scene.shelf}</Label>
                <Phos size={26}>{scene.name}</Phos>
                <p>{scene.description}</p>
              </div>
              <MiniPreview dsl={scene.dsl} />
              <span>
                <GitFork size={13} /> fork
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <footer className="start-footer">
        <span>built locally · the studio runs in your browser, your director keys never leave it</span>
        <a href="https://github.com/syfpsy/termin" target="_blank" rel="noreferrer">
          github.com/syfpsy/termin
        </a>
      </footer>
    </section>
  );
}

export function DocsSurface() {
  return (
    <section className="surface docs-surface">
      <Panel title="DOCS" flags=".me · bundle · player" flush>
        <div className="docs-layout">
          <nav className="docs-toc" aria-label="Documentation sections">
            <a href="#docs-syntax">.me syntax</a>
            <a href="#docs-bundle">bundle schema</a>
            <a href="#docs-player">web player</a>
            <a href="#docs-keyframes">keyframes</a>
            <a href="#docs-audio">audio</a>
            <a href="#docs-shortcuts">shortcuts</a>
          </nav>
          <article className="docs-body">
            <section id="docs-syntax">
              <Phos size={28} as="h2">.me syntax</Phos>
              <p>
                A scene is a plain text file with one declarative line per event, a header for the scene name and
                duration, and optional comments / markers / property animations.
              </p>
              <pre className="docs-code">{`scene boot_sequence_v3 2.4s
# three status OKs stagger in
at 0ms    type "[OK] phosphor buffer - 240x67 cells" slowly
at 400ms  type "[OK] palette loaded - 6 tones"
at 800ms  type "[OK] clock locked - 30 Hz"

# warming + reveal
at 1200ms pulse "[..] warming phosphor" amber 600ms
at 2000ms glitch "SYSTEM READY" 80ms burst
at 2080ms reveal "> SYSTEM READY"
at 2080ms cursor "_" blink 500ms`}</pre>
              <h3>line types</h3>
              <ul className="docs-list">
                <li><code>scene &lt;name&gt; &lt;duration&gt;</code> — required header. Duration in <code>ms</code> or <code>s</code>.</li>
                <li><code>at &lt;time&gt; &lt;effect&gt; "&lt;target&gt;" &lt;modifiers&gt;</code> — one event.</li>
                <li><code>mark "&lt;name&gt;" &lt;time&gt;</code> — timeline annotation.</li>
                <li><code>prop &lt;name&gt; &lt;time&gt; &lt;value&gt; [&lt;easing&gt;] ...</code> — keyframe animation on an appearance property.</li>
                <li><code># comment</code> — ignored by the engine, preserved through edits.</li>
              </ul>
              <h3>effects</h3>
              <p className="surface-copy">
                <code>type</code>, <code>cursor</code>, <code>scan-line</code>, <code>glitch</code>,
                <code> pulse</code>, <code>decay-trail</code>, <code>dither</code>, <code>wave</code>,
                <code> wipe</code>, <code>loop</code>, <code>shake</code>, <code>flash</code>, <code>reveal</code>.
                See the Effects surface for parameter details.
              </p>
              <h3>flags</h3>
              <p className="surface-copy">
                Drop <code>muted</code>, <code>solo</code>, or <code>locked</code> anywhere in modifiers. Muted
                events skip rendering; solo isolates one or more events when at least one is set; locked prevents
                drag / resize in the editor.
              </p>
              <h3>data binding</h3>
              <p>
                Add a <code>data {`{ ... }`}</code> line to the source and reference values from event targets
                with <code>{`{{path.to.field}}`}</code>. Multiple <code>data</code> lines deep-merge so the
                director can append patches without rewriting. Missing paths are kept verbatim so a typo stays
                visible instead of silently disappearing.
              </p>
              <pre className="docs-code">{`scene status_panel 1.6s
data { "users": 1247, "service": { "online": 5, "name": "auth" } }
at 0ms    type "USERS:{{users}}" slowly
at 600ms  type "ONLINE:{{service.online}}/{{service.name}}"
at 1100ms reveal "> READY"`}</pre>
              <p className="surface-copy">
                Substitution happens at parse time, so editing the data block updates the preview live (and a new
                bundle export carries the substituted text in <code>scene.events</code>).
              </p>
              <h3>counter</h3>
              <p className="surface-copy">
                Animate a number from one value to another. Pair it with <code>{`{{path}}`}</code> in the
                target prefix to show a label that mirrors live data while the digits roll up.
              </p>
              <pre className="docs-code">{`at 0ms counter "USERS: " from 0 to 1247 800ms ease-out
at 0ms counter "LOAD: "  from 0 to 0.87 600ms ease-out format:pct
at 0ms counter "REQ: "   from 0 to 12400 900ms ease-out format:k`}</pre>
              <p className="surface-copy">
                Endpoints can be integers or decimals. Integer pairs ≥ 1000 get a thousands separator;
                <code> format:k</code> renders <code>1.2k</code>, <code>format:pct</code> renders <code>87%</code>.
                Easings: <code>linear</code>, <code>ease-in</code>, <code>ease-out</code>,
                <code> ease-in-out</code>, <code>hold</code>.
              </p>
            </section>

            <section id="docs-bundle">
              <Phos size={28} as="h2">bundle schema</Phos>
              <p>
                Exports use a versioned JSON contract: <code>phosphor.bundle.v1</code> with MIME type{' '}
                <code>application/vnd.phosphor.bundle+json</code>. The bundle keeps both the editable
                <code> scene.source</code> and a compiled <code>scene.events</code> array so device runtimes
                that can't parse the DSL can still play the scene.
              </p>
              <pre className="docs-code">{`{
  "schema": "phosphor.bundle.v1",
  "schemaVersion": 1,
  "createdAt": "2026-04-25T...",
  "runtime": { "engine": "phosphor", "engineVersion": "0.1.0", "minPlayerVersion": "0.1.0" },
  "scene": {
    "name": "boot_sequence_v3",
    "source": "scene boot_sequence_v3 2.4s\\nat 0ms type ...",
    "durationMs": 2880,
    "tickRate": 30,
    "grid": { "cols": 96, "rows": 36 },
    "loop": { "startMs": 0, "endMs": 2880 },
    "events": [{ "atMs": 0, "effect": "type", "target": "[OK] ...", ... }],
    "animations": [{ "property": "bloom", "keyframes": [...] }]
  },
  "appearance": { "decay": 240, "bloom": 1.8, ... },
  "compatibility": { "deterministic": true, "portableRenderer": "canvas" }
}`}</pre>
              <p className="surface-copy">
                Validators are forward-compatible: unknown top-level fields are dropped, unknown
                <code> appearance</code> values clamp to their range, and any <code>schemaVersion</code> other
                than <code>1</code> is rejected with a specific error.
              </p>
              <p>
                Schema URL: <code>/schemas/phosphor.bundle.v1.schema.json</code>.
              </p>
            </section>

            <section id="docs-player">
              <Phos size={28} as="h2">web player</Phos>
              <p>
                Drop <code>&lt;phosphor-player&gt;</code> into any HTML page. The 28 kB single-file build at{' '}
                <code>/phosphor-player.js</code> is a non-React custom element with no external runtime
                dependencies.
              </p>
              <pre className="docs-code">{`<!-- Reference + bundle by URL -->
<script type="module" src="/phosphor-player.js"></script>
<phosphor-player src="/scene.phosphor.json"></phosphor-player>

<!-- Or inline the bundle -->
<phosphor-player>
  <script type="application/vnd.phosphor.bundle+json">
    { "schema": "phosphor.bundle.v1", "...": "..." }
  </script>
</phosphor-player>`}</pre>
              <p className="surface-copy">
                The Export surface generates copy-paste snippets for Web Components, React, Vue, Svelte, an
                iframe pointing at a hosted loop URL, or just the URL itself.
              </p>
              <p>
                Live demo: <a href="/examples/web-player/">/examples/web-player/</a>
              </p>
            </section>

            <section id="docs-keyframes">
              <Phos size={28} as="h2">keyframes</Phos>
              <p>
                Seven Appearance properties animate over the scene: <code>decay</code>, <code>bloom</code>,
                <code> scanlines</code>, <code>curvature</code>, <code>flicker</code>, <code>chromatic</code>,
                <code> sizeScale</code>. Each keyframe has a time, value, and optional easing on the segment
                ending at it.
              </p>
              <pre className="docs-code">{`prop bloom 0ms 1.0 600ms 2.5 ease-out 1200ms 0.8
prop decay 0ms 240 1500ms 600 ease-in-out`}</pre>
              <p className="surface-copy">
                Easings: <code>linear</code> (default), <code>ease-in</code>, <code>ease-out</code>,
                <code> ease-in-out</code>, <code>hold</code>. Click the ◆ next to any appearance slider to drop a
                keyframe at the playhead with the current value.
              </p>
              <h3>per-event keyframes</h3>
              <p>
                Animate a single event's intensity over its window with the <code>event-N</code> target.{' '}
                <code>N</code> is the source line number of the event (visible on the timeline editor as
                <code> line N</code>).
              </p>
              <pre className="docs-code">{`scene fault_alert 1.5s
at 0ms pulse "warming" amber 800ms
prop event-2 intensity 0ms 0.3 800ms 1.0 ease-in`}</pre>
              <p className="surface-copy">
                Today only <code>intensity</code> is animatable per event; it multiplies the cells that primitive
                writes. Unknown events / params silently fall back to the static value so a renamed line never
                breaks rendering.
              </p>
            </section>

            <section id="docs-audio">
              <Phos size={28} as="h2">audio</Phos>
              <p>
                Append <code>sound:&lt;preset&gt;</code> to any event's modifiers to fire a synth voice when the
                event hits during playback.
              </p>
              <pre className="docs-code">{`at 1200ms pulse "warming" amber 600ms sound:beep-high
at 2000ms glitch "SYSTEM READY" 80ms burst sound:click`}</pre>
              <p className="surface-copy">
                Presets: <code>beep-low</code>, <code>beep-high</code>, <code>click</code>, <code>blip</code>,{' '}
                <code>swish</code>, <code>chime</code>. The transport's sound button mutes / unmutes globally.
                Audio only fires during real playback — scrubbing and replay are silent.
              </p>
            </section>

            <section id="docs-shortcuts">
              <Phos size={28} as="h2">keyboard</Phos>
              <p>
                Press <kbd>?</kbd> anywhere to toggle the cheat sheet. Highlights:
              </p>
              <ul className="docs-list">
                <li><kbd>⌘ z</kbd> / <kbd>⌘ shift z</kbd> — undo / redo</li>
                <li><kbd>⌘ a</kbd> — select all events</li>
                <li><kbd>⌘ c</kbd> / <kbd>⌘ x</kbd> / <kbd>⌘ v</kbd> — copy / cut / paste at playhead</li>
                <li><kbd>⌘ shift d</kbd> — split selected event at playhead</li>
                <li><kbd>m</kbd> — drop a marker at the playhead</li>
                <li><kbd>,</kbd> / <kbd>.</kbd> — step the transport ± 1 frame</li>
                <li><kbd>delete</kbd> — remove selected events (rippling if ripple is on)</li>
              </ul>
            </section>
          </article>
        </div>
      </Panel>
    </section>
  );
}

export function LibrarySurface({ onForkScene, onOpenAuthor }: Pick<SharedSurfaceProps, 'onForkScene' | 'onOpenAuthor'>) {
  return (
    <section className="surface">
      <Panel title="SCENE LIBRARY" flags={`${SCENE_LIBRARY.length} starter loops`} flush>
        <div className="surface-grid">
          {SCENE_LIBRARY.map((scene) => (
            <button
              key={scene.id}
              className="scene-card"
              onClick={() => {
                onForkScene(scene);
                onOpenAuthor();
              }}
            >
              <div>
                <Label>{scene.shelf}</Label>
                <Phos size={30}>{scene.name}</Phos>
                <p>{scene.description}</p>
              </div>
              <MiniPreview dsl={scene.dsl} />
              <span>
                <GitFork size={13} /> fork
              </span>
            </button>
          ))}
        </div>
      </Panel>
    </section>
  );
}

export function EffectDetailSurface({ dsl, onDslChange }: Pick<SharedSurfaceProps, 'dsl' | 'onDslChange'>) {
  return (
    <section className="surface effect-detail">
      <Panel title="EFFECT PRIMITIVES" flags="12 shipped" flush>
        <div className="effect-detail-grid">
          <div className="effect-list">
            {EFFECT_DETAILS.map((effect) => (
              <a key={effect.name} href={`#effect-${effect.name}`}>
                <span>{effect.name}</span>
                <small>{effect.params.join(' / ')}</small>
              </a>
            ))}
          </div>
          <div className="effect-docs">
            {EFFECT_DETAILS.map((effect) => (
              <article key={effect.name} id={`effect-${effect.name}`} className="effect-doc">
                <div>
                  <Phos size={30}>{effect.name}</Phos>
                  <p>{effect.note}</p>
                </div>
                <pre>{effect.notation}</pre>
                <div className="param-row">
                  {effect.params.map((param) => (
                    <span key={param}>{param}</span>
                  ))}
                  <Button
                    tone="prim"
                    onClick={() => {
                      onDslChange(`${dsl.trimEnd()}\n${effect.notation}`);
                    }}
                  >
                    insert
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Panel>
    </section>
  );
}

export function AssetsSurface({ appearance, onAppearanceChange }: Pick<SharedSurfaceProps, 'appearance' | 'onAppearanceChange'>) {
  return (
    <section className="surface">
      <Panel title="ASSET MANAGER" flags="fonts / palettes / kits" flush>
        <div className="asset-grid">
          {ASSET_CATALOG.map((asset) => (
            <button
              key={asset.id}
              className="asset-card"
              onClick={() => {
                if (asset.kind === 'font') onAppearanceChange({ font: asset.value as Appearance['font'] });
              }}
              data-active={asset.kind === 'font' && asset.value === appearance.font}
            >
              <Label>{asset.kind}</Label>
              <strong>{asset.name}</strong>
              {asset.kind === 'palette' ? <span className="palette-strip" style={{ background: paletteGradient(asset.value) }} /> : <code>{asset.value}</code>}
              <small>{asset.note}</small>
            </button>
          ))}
        </div>
      </Panel>
    </section>
  );
}

export function ExportSurface({ dsl, scene, appearance, jobs, onCreateJob }: SharedSurfaceProps) {
  return (
    <section className="surface export-surface">
      <Panel title="EXPORT TARGETS" flags="future-proof queue" flush>
        <div className="export-grid">
          <div className="export-targets">
            {EXPORT_TARGETS.map((target) => (
              <button key={target.target} className="export-target" onClick={() => onCreateJob(target.target)}>
                <span>
                  <strong>{target.label}</strong>
                  <small>{target.note}</small>
                </span>
                <em data-ready={target.status === 'ready'}>{target.status}</em>
              </button>
            ))}
          </div>
          <div className="export-actions">
            <Panel title="LOCAL ACTIONS" dense>
              <Button icon={<Code2 size={13} />} tone="prim" onClick={() => exportHtmlEmbed(scene.name, dsl, appearance)}>
                html embed
              </Button>
              <Button icon={<Download size={13} />} tone="prim" onClick={() => exportMeFile(scene.name, dsl)}>
                .me source
              </Button>
              <Button icon={<FileJson size={13} />} tone="prim" onClick={() => exportBundleJson(scene.name, dsl, appearance)}>
                phosphor json
              </Button>
            </Panel>
            <Panel title="QUEUE" flags={`${jobs.length} jobs`} dense flush>
              <div className="queue-list">
                {jobs.length === 0 && <p className="surface-copy">No export jobs yet.</p>}
                {jobs.map((job) => (
                  <div key={job.id} className="queue-job">
                    <span>
                      <strong>{job.label}</strong>
                      <small>{job.note}</small>
                    </span>
                    <em data-status={job.status}>{job.status}</em>
                    <i style={{ width: `${job.progress * 100}%` }} />
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </Panel>
      <EmbedCodeGenerator dsl={dsl} scene={scene} appearance={appearance} />
    </section>
  );
}

type SnippetKind = 'web-component' | 'react' | 'vue' | 'svelte' | 'iframe' | 'loop-url';

const SNIPPET_OPTIONS: Array<{ value: SnippetKind; label: string; note: string }> = [
  { value: 'web-component', label: 'web component', note: 'Drop-in <phosphor-player>. Plain HTML, framework-free.' },
  { value: 'iframe', label: 'iframe', note: 'Embed via /play.html#play=... — works in any CMS that allows iframes.' },
  { value: 'loop-url', label: 'shareable url', note: 'Plain link to /play.html — paste in chat, social, README.' },
  { value: 'react', label: 'react', note: 'JSX wrapper around <phosphor-player> with the bundle inline.' },
  { value: 'vue', label: 'vue 3', note: 'Single-file component template + script setup.' },
  { value: 'svelte', label: 'svelte', note: 'Svelte 4/5 component using onMount.' },
];

type EmbedCodeGeneratorProps = {
  dsl: string;
  scene: SharedSurfaceProps['scene'];
  appearance: SharedSurfaceProps['appearance'];
};

function EmbedCodeGenerator({ dsl, scene, appearance }: EmbedCodeGeneratorProps) {
  const [kind, setKind] = useState<SnippetKind>('web-component');
  const [origin, setOrigin] = useState(() =>
    typeof window !== 'undefined' ? window.location.origin : 'https://termin-peach.vercel.app',
  );
  const [loopUrl, setLoopUrl] = useState<LoopUrlResult | null>(null);
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(
    () => buildEmbedSnippet(kind, { dsl, sceneName: scene.name, appearance, origin, loopUrl }),
    [kind, dsl, scene.name, appearance, origin, loopUrl],
  );

  async function regenerateLoopUrl() {
    const result = await buildLoopUrl({ sceneName: scene.name, dsl, appearance, origin });
    setLoopUrl(result);
  }

  async function copySnippet() {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — user can select-and-copy manually
    }
  }

  const needsLoopUrl = kind === 'iframe' || kind === 'loop-url';

  return (
    <Panel title="EMBED" flags="copy-paste integration" dense>
      <div className="embed-code">
        <div className="embed-code__row">
          <Label>format</Label>
          <Segmented<SnippetKind>
            value={kind}
            onChange={setKind}
            options={SNIPPET_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          />
        </div>
        <p className="surface-copy">{SNIPPET_OPTIONS.find((option) => option.value === kind)?.note}</p>
        <div className="embed-code__row">
          <Label>host origin</Label>
          <input
            className="embed-code__origin"
            type="text"
            value={origin}
            spellCheck={false}
            onChange={(event) => setOrigin(event.target.value)}
            placeholder="https://your-site.com"
          />
        </div>
        {needsLoopUrl && (
          <div className="embed-code__row">
            <Label>loop url</Label>
            <Button icon={<Link2 size={12} />} onClick={() => void regenerateLoopUrl()}>
              {loopUrl ? 'regenerate' : 'generate'}
            </Button>
            {loopUrl && (
              <span className="embed-code__hint">
                {(loopUrl.encodedLength / 1024).toFixed(1)} kB · {loopUrl.compressed ? 'gzip' : 'raw'}
              </span>
            )}
          </div>
        )}
        <pre className="embed-code__snippet" aria-label={`${kind} embed snippet`}>
          {snippet}
        </pre>
        <div className="embed-code__actions">
          <Button tone="prim" icon={<Copy size={12} />} onClick={() => void copySnippet()}>
            {copied ? 'copied' : 'copy snippet'}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function buildEmbedSnippet(
  kind: SnippetKind,
  ctx: { dsl: string; sceneName: string; appearance: SharedSurfaceProps['appearance']; origin: string; loopUrl: LoopUrlResult | null },
): string {
  const playerSrc = `${ctx.origin.replace(/\/$/, '')}/phosphor-player.js`;
  const inlineBundle = JSON.stringify(
    {
      sceneName: ctx.sceneName,
      durationMs: 'TODO',
      note: 'Generated by Phosphor — fork at termin-peach.vercel.app',
    },
    null,
    2,
  );
  void inlineBundle;
  const safeDsl = escapeForScript(ctx.dsl);

  switch (kind) {
    case 'web-component':
      return `<!-- Drop into any HTML page. -->
<script type="module" src="${playerSrc}"></script>
<phosphor-player>
  <script type="application/vnd.phosphor.bundle+json">
${indentJsonBlock(buildClientBundleJson(ctx.sceneName, ctx.dsl, ctx.appearance))}
  </script>
</phosphor-player>`;

    case 'iframe':
      if (!ctx.loopUrl) {
        return `<!-- Click "generate" above to produce a loop URL, then this iframe will use it. -->
<iframe
  src="${ctx.origin.replace(/\/$/, '')}/play.html"
  width="960"
  height="540"
  style="border:0"
></iframe>`;
      }
      return `<iframe
  src="${ctx.loopUrl.url}"
  width="960"
  height="540"
  style="border:0"
  allow="autoplay"
  loading="lazy"
></iframe>`;

    case 'loop-url':
      return ctx.loopUrl?.url ?? '(click "generate" above to produce a loop URL)';

    case 'react':
      return `// React component — pairs with <script type="module" src="/phosphor-player.js"> in your <head>.
import { useEffect, useRef } from 'react';

const SCENE = ${JSON.stringify(ctx.dsl)};

export function ${toComponentName(ctx.sceneName)}() {
  const ref = useRef<HTMLScriptElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.textContent = JSON.stringify({
      schema: 'phosphor.bundle.v1',
      schemaVersion: 1,
      scene: { name: '${ctx.sceneName}', source: SCENE },
      appearance: ${JSON.stringify(ctx.appearance)},
    });
  }, []);
  return (
    <phosphor-player>
      <script ref={ref} type="application/vnd.phosphor.bundle+json" />
    </phosphor-player>
  );
}`;

    case 'vue':
      return `<!-- Vue 3 single-file component. Add <script type="module" src="/phosphor-player.js"> to index.html. -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';
const inlineRef = ref<HTMLScriptElement | null>(null);
const SCENE = ${JSON.stringify(ctx.dsl)};
onMounted(() => {
  if (inlineRef.value) inlineRef.value.textContent = JSON.stringify({
    schema: 'phosphor.bundle.v1',
    schemaVersion: 1,
    scene: { name: '${ctx.sceneName}', source: SCENE },
    appearance: ${JSON.stringify(ctx.appearance)},
  });
});
</script>

<template>
  <phosphor-player>
    <script ref="inlineRef" type="application/vnd.phosphor.bundle+json"></script>
  </phosphor-player>
</template>`;

    case 'svelte':
      return `<!-- Svelte component. Add <script type="module" src="/phosphor-player.js"> to app.html. -->
<script lang="ts">
  import { onMount } from 'svelte';
  let inlineEl: HTMLScriptElement;
  const SCENE = ${JSON.stringify(ctx.dsl)};
  onMount(() => {
    inlineEl.textContent = JSON.stringify({
      schema: 'phosphor.bundle.v1',
      schemaVersion: 1,
      scene: { name: '${ctx.sceneName}', source: SCENE },
      appearance: ${JSON.stringify(ctx.appearance)},
    });
  });
</script>

<phosphor-player>
  <script bind:this={inlineEl} type="application/vnd.phosphor.bundle+json"></script>
</phosphor-player>`;

    default:
      void safeDsl;
      return '';
  }
}

function buildClientBundleJson(sceneName: string, dsl: string, appearance: SharedSurfaceProps['appearance']): string {
  return JSON.stringify(
    {
      schema: 'phosphor.bundle.v1',
      schemaVersion: 1,
      scene: { name: sceneName, source: dsl },
      appearance,
    },
    null,
    2,
  );
}

function indentJsonBlock(json: string, indent = 4): string {
  const pad = ' '.repeat(indent);
  return json
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n');
}

function toComponentName(value: string): string {
  const cleaned = value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
  return cleaned ? `Phosphor${cleaned}` : 'PhosphorScene';
}

function escapeForScript(value: string): string {
  return value.replace(/<\/(script)/gi, '<\\/$1');
}

export function SettingsSurface({
  appearance,
  renderer,
  provider,
  animatedProps,
  onAppearanceChange,
  onRendererChange,
  onProviderChange,
  onAppearanceKeyframe,
}: SharedSurfaceProps) {
  const isAnimated = (prop: string) => Boolean(animatedProps?.has(prop));
  const animateBinding = onAppearanceKeyframe;
  return (
    <section className="surface settings-surface">
      <Panel id="settings-appearance" title="SETTINGS / APPEARANCE" flags="persisted locally">
        <div className="settings-grid">
          <div className="settings-group">
            <Label>preview chrome</Label>
            <Segmented
              value={appearance.chrome}
              onChange={(chrome) => onAppearanceChange({ chrome })}
              options={[
                { value: 'bezel', label: 'bezel' },
                { value: 'flat', label: 'flat' },
                { value: 'none', label: 'none' },
              ]}
            />
          </div>
          <div className="settings-group">
            <Label>preview mode</Label>
            <Segmented
              value={appearance.mode}
              onChange={(mode) => onAppearanceChange({ mode })}
              options={[
                { value: 'color', label: 'color' },
                { value: '1-bit', label: '1-bit' },
              ]}
            />
          </div>
          <div className="settings-group">
            <Label>renderer</Label>
            <Segmented
              value={renderer}
              onChange={onRendererChange}
              options={[
                { value: 'webgl', label: 'webgl' },
                { value: 'canvas', label: 'canvas' },
              ]}
            />
          </div>
          <div className="settings-group">
            <Label>director</Label>
            <Segmented
              value={provider}
              onChange={onProviderChange}
              options={[
                { value: 'anthropic', label: 'anthropic' },
                { value: 'openrouter', label: 'openrouter' },
                { value: 'deepseek', label: 'deepseek' },
                { value: 'openai', label: 'openai' },
                { value: 'mock', label: 'mock' },
              ]}
            />
          </div>
          <div className="settings-group settings-group--wide">
            <Label>typography</Label>
            <Segmented
              value={appearance.font}
              onChange={(font) => onAppearanceChange({ font })}
              options={[
                { value: 'vt323', label: 'VT323' },
                { value: 'jet', label: 'JetBrains' },
                { value: 'plex', label: 'Plex' },
                { value: 'atkinson', label: 'Atkinson' },
                { value: 'fira', label: 'Fira' },
                { value: 'space', label: 'Space' },
              ]}
            />
          </div>
          <SliderRow label="size" value={appearance.sizeScale} min={0.75} max={1.4} step={0.05} display={`${appearance.sizeScale.toFixed(2)}x`} onChange={(sizeScale) => onAppearanceChange({ sizeScale })} />
          <SliderRow
            label="decay"
            value={appearance.decay}
            min={0}
            max={800}
            step={10}
            display={`${appearance.decay}ms`}
            onChange={(decay) => onAppearanceChange({ decay })}
            animatable={Boolean(animateBinding)}
            animated={isAnimated('decay')}
            onAnimateClick={animateBinding ? () => animateBinding('decay') : undefined}
          />
          <SliderRow
            label="bloom"
            value={appearance.bloom}
            min={0}
            max={3}
            step={0.1}
            display={appearance.bloom.toFixed(1)}
            onChange={(bloom) => onAppearanceChange({ bloom })}
            animatable={Boolean(animateBinding)}
            animated={isAnimated('bloom')}
            onAnimateClick={animateBinding ? () => animateBinding('bloom') : undefined}
          />
          <SliderRow
            label="scanlines"
            value={appearance.scanlines}
            min={0}
            max={1}
            step={0.05}
            display={appearance.scanlines.toFixed(2)}
            onChange={(scanlines) => onAppearanceChange({ scanlines })}
            animatable={Boolean(animateBinding)}
            animated={isAnimated('scanlines')}
            onAnimateClick={animateBinding ? () => animateBinding('scanlines') : undefined}
          />
          <SliderRow
            label="curvature"
            value={appearance.curvature}
            min={0}
            max={1}
            step={0.05}
            display={appearance.curvature.toFixed(2)}
            onChange={(curvature) => onAppearanceChange({ curvature })}
            animatable={Boolean(animateBinding)}
            animated={isAnimated('curvature')}
            onAnimateClick={animateBinding ? () => animateBinding('curvature') : undefined}
          />
          <SliderRow
            label="flicker"
            value={appearance.flicker}
            min={0}
            max={1}
            step={0.02}
            display={appearance.flicker.toFixed(2)}
            onChange={(flicker) => onAppearanceChange({ flicker })}
            animatable={Boolean(animateBinding)}
            animated={isAnimated('flicker')}
            onAnimateClick={animateBinding ? () => animateBinding('flicker') : undefined}
          />
          <SliderRow
            label="chromatic"
            value={appearance.chromatic}
            min={0}
            max={1}
            step={0.02}
            display={appearance.chromatic.toFixed(2)}
            onChange={(chromatic) => onAppearanceChange({ chromatic })}
            animatable={Boolean(animateBinding)}
            animated={isAnimated('chromatic')}
            onAnimateClick={animateBinding ? () => animateBinding('chromatic') : undefined}
          />
          <div className="settings-group settings-group--wide">
            <Label>tick rate</Label>
            <Segmented<TickRate>
              value={appearance.tickRate}
              onChange={(tickRate) => onAppearanceChange({ tickRate })}
              options={[
                { value: 24, label: '24' },
                { value: 30, label: '30' },
                { value: 60, label: '60' },
              ]}
            />
          </div>
        </div>
      </Panel>
    </section>
  );
}

export function EmptySurface({ onForkScene, onOpenAuthor }: Pick<SharedSurfaceProps, 'onForkScene' | 'onOpenAuthor'>) {
  return (
    <section className="surface surface--empty">
      <Panel title="NEW SCENE" tone="cyan">
        <div className="empty-layout">
          <SlidersHorizontal size={34} />
          <Phos size={42}>start from signal</Phos>
          <div className="empty-actions">
            <Button tone="prim" onClick={onOpenAuthor}>
              open notation
            </Button>
            <Button onClick={() => onForkScene(SCENE_LIBRARY[0])}>fork boot</Button>
            <Button onClick={() => onForkScene(SCENE_LIBRARY[1])}>fork loop</Button>
          </div>
        </div>
      </Panel>
    </section>
  );
}

export function AdminSurface({
  provider,
  providerConfigs,
  onProviderChange,
  onProviderConfigChange,
}: {
  provider: ProviderKind;
  providerConfigs: Record<ProviderKind, ModelProviderConfig>;
  onProviderChange: (provider: ProviderKind) => void;
  onProviderConfigChange: (config: ModelProviderConfig) => void;
}) {
  return (
    <section className="surface admin-surface">
      <Panel title="ADMIN / MODEL KEYS" flags="stored in this browser only" flush>
        <div className="admin-layout">
          <div className="admin-note">
            <Phos size={34}>bring your own model</Phos>
            <p>
              Keys are saved locally in this browser and sent only with director requests. They are not committed, not stored in the Vercel
              project, and not included in exports.
            </p>
          </div>
          <div className="provider-admin-grid">
            {PROVIDER_ORDER.map((providerKey) => {
              const config = providerConfigs[providerKey];
              const defaults = DEFAULT_MODEL_PROVIDERS[providerKey];
              const isMock = providerKey === 'mock';
              const hasBaseUrl = defaults.baseUrl !== undefined;
              const readiness = isMock ? 'local' : providerHasUserKey(config) ? 'ready' : 'needs key';
              return (
                <article key={providerKey} className="provider-admin-card" data-active={provider === providerKey}>
                  <div className="provider-admin-card__head">
                    <div>
                      <Label>{readiness}</Label>
                      <strong>{config.label}</strong>
                    </div>
                    <Button active={provider === providerKey} onClick={() => onProviderChange(providerKey)}>
                      use
                    </Button>
                  </div>
                  <label className="admin-field">
                    <span>api key</span>
                    <input
                      type="password"
                      value={config.apiKey}
                      disabled={isMock}
                      placeholder={isMock ? 'not required' : 'paste provider key'}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => onProviderConfigChange({ ...config, apiKey: event.target.value })}
                    />
                  </label>
                  <label className="admin-field">
                    <span>model</span>
                    <input
                      type="text"
                      value={config.model}
                      disabled={isMock}
                      spellCheck={false}
                      onChange={(event) => onProviderConfigChange({ ...config, model: event.target.value })}
                    />
                  </label>
                  {hasBaseUrl && (
                    <label className="admin-field">
                      <span>base url</span>
                      <input
                        type="text"
                        value={config.baseUrl ?? ''}
                        spellCheck={false}
                        onChange={(event) => onProviderConfigChange({ ...config, baseUrl: event.target.value })}
                      />
                    </label>
                  )}
                  <p>{config.note}</p>
                  <div className="provider-admin-card__actions">
                    <Button onClick={() => onProviderConfigChange({ ...defaults, apiKey: config.apiKey })}>reset</Button>
                    <Button onClick={() => onProviderConfigChange({ ...config, apiKey: '' })}>clear key</Button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </Panel>
    </section>
  );
}

export function SceneSummaryPanel({ scene }: { scene: ParsedScene }) {
  return (
    <Panel title="SCENE STATE" dense>
      <div className="scene-summary">
        <Phos size={28}>{scene.name}</Phos>
        <span>{(scene.duration / 1000).toFixed(2)}s</span>
        <span>{scene.events.length} events</span>
        <span>{scene.lines.filter((line) => line.kind === 'invalid').length} invalid</span>
        {scene.events.slice(0, 6).map((event) => (
          <small key={event.id} data-tone={eventTone(event)}>
            {event.at}ms / {event.effect} / {estimateEventDuration(event)}ms
          </small>
        ))}
      </div>
    </Panel>
  );
}


function paletteGradient(value: string) {
  const colors = value.split(',');
  const stops = colors.map((color, index) => `${color} ${(index / colors.length) * 100}% ${((index + 1) / colors.length) * 100}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}
