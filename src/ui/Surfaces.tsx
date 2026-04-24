import {
  ArrowRight,
  Code2,
  Download,
  FileJson,
  GitFork,
  SlidersHorizontal,
} from 'lucide-react';
import { exportBundleJson, exportHtmlEmbed, exportMeFile } from '../director/client';
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
import type { RecentScene } from '../state/storage';
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
  onForkScene: (scene: LibraryScene) => void;
  onDslChange: (dsl: string) => void;
  onAppearanceChange: (patch: Partial<Appearance>) => void;
  onRendererChange: (renderer: RendererKind) => void;
  onProviderChange: (provider: ProviderKind) => void;
  onProviderConfigChange?: (config: ModelProviderConfig) => void;
  onCreateJob: (target: ExportTarget) => void;
  onOpenAuthor: () => void;
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
];

export function StartSurface({ onForkScene, onOpenAuthor }: Pick<SharedSurfaceProps, 'onForkScene' | 'onOpenAuthor'>) {
  const first = SCENE_LIBRARY[0];
  return (
    <section className="surface surface--start">
      <div className="start-signal">
        <Phos size={74}>PHOSPHOR</Phos>
        <p>Terminal motion engine. Vibe-code a scene, inspect the notation, tune the phosphor, then export the loop.</p>
        <div className="start-actions">
          <Button tone="prim" icon={<ArrowRight size={14} />} onClick={onOpenAuthor}>
            open author
          </Button>
          <Button icon={<GitFork size={14} />} onClick={() => onForkScene(first)}>
            fork boot
          </Button>
        </div>
      </div>
      <div className="promise-grid">
        {['describe motion', 'commit notation', 'render phosphor'].map((label, index) => (
          <Panel key={label} title={`0${index + 1}`} dense>
            <Phos size={34}>{label}</Phos>
            <p className="surface-copy">
              {index === 0 && 'Director drafts valid .me syntax from plain language.'}
              {index === 1 && 'Parsed lines stay readable and invalid lines never block preview.'}
              {index === 2 && 'Canvas and WebGL consume the same decay buffer.'}
            </p>
          </Panel>
        ))}
      </div>
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
    </section>
  );
}

export function SettingsSurface({
  appearance,
  renderer,
  provider,
  onAppearanceChange,
  onRendererChange,
  onProviderChange,
}: SharedSurfaceProps) {
  return (
    <section className="surface settings-surface">
      <Panel title="SETTINGS / APPEARANCE" flags="persisted locally">
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
          <SliderRow label="decay" value={appearance.decay} min={0} max={800} step={10} display={`${appearance.decay}ms`} onChange={(decay) => onAppearanceChange({ decay })} />
          <SliderRow label="bloom" value={appearance.bloom} min={0} max={3} step={0.1} display={appearance.bloom.toFixed(1)} onChange={(bloom) => onAppearanceChange({ bloom })} />
          <SliderRow label="scanlines" value={appearance.scanlines} min={0} max={1} step={0.05} display={appearance.scanlines.toFixed(2)} onChange={(scanlines) => onAppearanceChange({ scanlines })} />
          <SliderRow label="curvature" value={appearance.curvature} min={0} max={1} step={0.05} display={appearance.curvature.toFixed(2)} onChange={(curvature) => onAppearanceChange({ curvature })} />
          <SliderRow label="flicker" value={appearance.flicker} min={0} max={1} step={0.02} display={appearance.flicker.toFixed(2)} onChange={(flicker) => onAppearanceChange({ flicker })} />
          <SliderRow label="chromatic" value={appearance.chromatic} min={0} max={1} step={0.02} display={appearance.chromatic.toFixed(2)} onChange={(chromatic) => onAppearanceChange({ chromatic })} />
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

export function RecentScenesPanel({ recents, onOpen }: { recents: RecentScene[]; onOpen: (recent: RecentScene) => void }) {
  return (
    <Panel title="RECENT" flags={`${recents.length}`} dense flush>
      <div className="recent-list">
        {recents.length === 0 && <p className="surface-copy">No saved recent scenes.</p>}
        {recents.map((recent) => (
          <button key={recent.id} onClick={() => onOpen(recent)}>
            <strong>{recent.name}</strong>
            <small>{new Date(recent.updatedAt).toLocaleString()}</small>
          </button>
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
