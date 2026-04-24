import { Code2, Download, FileUp, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  exportBundleJson,
  exportGif,
  exportHtmlEmbed,
  exportLoopUrl,
  exportMeFile,
  exportMp4,
  exportPngSequence,
  exportSvgAnimation,
  exportWebm,
  isMp4ExportSupported,
  isWebmExportSupported,
  readSceneFile,
} from '../director/client';
import { TickClock } from '../engine/clock';
import { parseScene } from '../engine/dsl';
import type { Appearance, PreviewChrome, PreviewMode, ProviderKind, RendererKind, TickRate } from '../engine/types';
import { DEFAULT_APPEARANCE } from '../engine/types';
import { createExportJob, EXPORT_TARGETS, type ExportJob, type ExportTarget } from '../export/queue';
import type { LibraryScene } from '../scenes/library';
import { saveSceneRecord } from '../state/sceneDb';
import type { ModelProviderConfig } from '../state/modelProviders';
import type { DirectorProposal } from '../state/types';
import {
  loadAppearance,
  loadDsl,
  loadModelProviders,
  loadProvider,
  loadRenderer,
  saveAppearance,
  saveDsl,
  saveModelProviders,
  saveProvider,
  saveRenderer,
  loadRecentScenes,
  touchRecentScene,
  type RecentScene,
} from '../state/storage';
import { Button, Label, Panel, Phos, Segmented, SliderRow } from './components';
import { DirectorPanel } from './DirectorPanel';
import { EnginePreview } from './EnginePreview';
import { NotationPanel } from './NotationPanel';
import { SceneLibrary } from './SceneLibrary';
import {
  AdminSurface,
  AssetsSurface,
  EffectDetailSurface,
  EmptySurface,
  ExportSurface,
  LibrarySurface,
  SceneSummaryPanel,
  SettingsSurface,
  StartSurface,
  RecentScenesPanel,
} from './Surfaces';
import { Timeline } from './Timeline';

type AppView = 'author' | 'start' | 'library' | 'effects' | 'assets' | 'export' | 'admin' | 'settings' | 'empty';

const NAV_ITEMS: Array<{ view: AppView; label: string }> = [
  { view: 'author', label: 'author' },
  { view: 'start', label: 'start' },
  { view: 'library', label: 'library' },
  { view: 'effects', label: 'effects' },
  { view: 'assets', label: 'assets' },
  { view: 'export', label: 'export' },
  { view: 'admin', label: 'admin' },
  { view: 'settings', label: 'settings' },
  { view: 'empty', label: 'new' },
];

const EFFECTS = [
  ['type', 'glyph per tick'],
  ['cursor', 'blink duty'],
  ['scan-line', 'row sweep'],
  ['glitch', 'random cells'],
  ['pulse', 'intensity ramp'],
  ['decay-trail', 'path decay'],
  ['dither', 'bayer ramp'],
  ['wave', 'row offset'],
  ['wipe', 'distance reveal'],
  ['loop', 'restart'],
  ['shake', 'row tear'],
  ['flash', 'screen spike'],
] as const;

export function App() {
  const [view, setView] = useState<AppView>(() => parseHashView());
  const [dsl, setDsl] = useState(loadDsl);
  const [previewDsl, setPreviewDsl] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<Appearance>(() => ({ ...DEFAULT_APPEARANCE, ...loadAppearance() }));
  const [renderer, setRenderer] = useState<RendererKind>(loadRenderer);
  const [provider, setProvider] = useState<ProviderKind>(loadProvider);
  const [modelProviders, setModelProviders] = useState<Record<ProviderKind, ModelProviderConfig>>(loadModelProviders);
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [recents, setRecents] = useState<RecentScene[]>(loadRecentScenes);
  const [playing, setPlaying] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const activeDsl = previewDsl ?? dsl;
  const scene = useMemo(() => parseScene(activeDsl), [activeDsl]);
  const durationTicks = Math.max(1, Math.ceil((scene.duration / 1000) * appearance.tickRate));
  const clockRef = useRef<TickClock | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => saveDsl(dsl), [dsl]);
  useEffect(() => {
    const parsed = parseScene(dsl);
    setRecents(touchRecentScene(parsed.name, dsl));
    void saveSceneRecord(parsed.name, dsl).catch(() => undefined);
  }, [dsl]);
  useEffect(() => saveAppearance(appearance), [appearance]);
  useEffect(() => saveRenderer(renderer), [renderer]);
  useEffect(() => saveProvider(provider), [provider]);
  useEffect(() => saveModelProviders(modelProviders), [modelProviders]);

  useEffect(() => {
    setTick(0);
  }, [activeDsl, appearance.tickRate]);

  useEffect(() => {
    const onHashChange = () => setView(parseHashView());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const nextHash = view === 'author' ? '' : `#${view}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', `${window.location.pathname}${nextHash}`);
    }
  }, [view]);

  useEffect(() => {
    clockRef.current?.stop();
    if (!playing) return;
    const clock = new TickClock(appearance.tickRate, (count) => {
      setTick((current) => (current + count) % durationTicks);
    });
    clockRef.current = clock;
    clock.start();
    return () => clock.stop();
  }, [appearance.tickRate, durationTicks, playing]);

  function updateAppearance(patch: Partial<Appearance>) {
    setAppearance((current) => ({ ...current, ...patch }));
  }

  function commitProposal(proposal: DirectorProposal) {
    setDsl(proposal.dsl);
    setPreviewDsl(null);
  }

  function previewProposal(proposal: DirectorProposal) {
    setPreviewDsl(proposal.dsl);
  }

  function forkLibraryScene(libraryScene: LibraryScene) {
    setDsl(libraryScene.dsl);
    setPreviewDsl(null);
    setTick(0);
  }

  function createJob(target: ExportTarget) {
    const config = EXPORT_TARGETS.find((item) => item.target === target);
    const ready = config?.status === 'ready';
    const job = createExportJob(target, config?.label ?? target, Boolean(ready));
    setJobs((current) => [job, ...current]);

    if (!ready) return;

    if (target === 'html') {
      exportHtmlEmbed(scene.name, dsl, appearance);
      markJobDone(job.id, 'HTML exported with inline phosphor-player.');
      return;
    }
    if (target === 'me') {
      exportMeFile(scene.name, dsl);
      markJobDone(job.id, 'Plain .me source exported.');
      return;
    }
    if (target === 'bundle-json') {
      exportBundleJson(scene.name, dsl, appearance);
      markJobDone(job.id, 'Phosphor bundle exported.');
      return;
    }
    if (target === 'png-seq') {
      void runAsyncExport(job.id, 'Rendering PNG sequence...', () =>
        exportPngSequence(scene.name, dsl, appearance, {
          onProgress: (ratio) => updateJobProgress(job.id, ratio),
        }),
      );
      return;
    }
    if (target === 'webm') {
      if (!isWebmExportSupported()) {
        markJobBlocked(job.id, 'This browser cannot record WebM. Try Chrome or Firefox.');
        return;
      }
      void runAsyncExport(job.id, 'Recording WebM at scene tick rate...', () =>
        exportWebm(scene.name, dsl, appearance, {
          onProgress: (ratio) => updateJobProgress(job.id, ratio),
        }),
      );
      return;
    }
    if (target === 'mp4') {
      if (!isMp4ExportSupported()) {
        markJobBlocked(job.id, 'This browser cannot record MP4. Try Chrome, Edge, or Safari 14.1+.');
        return;
      }
      void runAsyncExport(job.id, 'Recording MP4 at scene tick rate...', () =>
        exportMp4(scene.name, dsl, appearance, {
          onProgress: (ratio) => updateJobProgress(job.id, ratio),
        }),
      );
      return;
    }
    if (target === 'gif') {
      void runAsyncExport(job.id, 'Rendering GIF with quantized palette...', () =>
        exportGif(scene.name, dsl, appearance, {
          onProgress: (ratio) => updateJobProgress(job.id, ratio),
        }),
      );
      return;
    }
    if (target === 'svg') {
      exportSvgAnimation(scene.name, dsl, appearance);
      markJobDone(job.id, 'Animated SVG exported (SMIL opacity keyframes per cell).');
      return;
    }
    if (target === 'loop-url') {
      setJob(job.id, { status: 'running', progress: 0.3, note: 'Compressing scene into a share URL...' });
      void exportLoopUrl(scene.name, dsl, appearance)
        .then((result) => {
          const kind = result.compressed ? 'gzip' : 'raw';
          const kb = (result.encodedLength / 1024).toFixed(1);
          markJobDone(
            job.id,
            `Loop URL copied to clipboard (${kind}, ${kb} kB fragment).`,
          );
        })
        .catch((error) => {
          markJobBlocked(job.id, error instanceof Error ? error.message : 'Loop URL failed.');
        });
      return;
    }
  }

  function setJob(id: string, patch: Partial<ExportJob>) {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }

  function markJobDone(id: string, note: string) {
    setJob(id, { status: 'done', progress: 1, note });
  }

  function markJobBlocked(id: string, note: string) {
    setJob(id, { status: 'blocked', progress: 0, note });
  }

  function updateJobProgress(id: string, ratio: number) {
    setJob(id, { status: 'running', progress: Math.max(0, Math.min(1, ratio)) });
  }

  async function runAsyncExport(id: string, startNote: string, exec: () => Promise<void>) {
    setJob(id, { status: 'running', progress: 0, note: startNote });
    try {
      await exec();
      markJobDone(id, 'Render complete. File downloaded.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Render failed.';
      markJobBlocked(id, message);
    }
  }

  function updateModelProvider(config: ModelProviderConfig) {
    setModelProviders((current) => ({
      ...current,
      [config.provider]: config,
    }));
  }

  async function importScene(file: File | undefined) {
    if (!file) return;
    try {
      const imported = await readSceneFile(file);
      setDsl(imported.dsl);
      if (imported.appearance) setAppearance(imported.appearance);
      setPreviewDsl(null);
      setImportError(null);
      setTick(0);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed.');
    }
  }

  function openRecent(recent: RecentScene) {
    setDsl(recent.dsl);
    setPreviewDsl(null);
    setTick(0);
    setView('author');
  }

  return (
    <main className={`workspace ${view === 'author' ? '' : 'workspace--surface'}`}>
      <header className="titlebar">
        <div className="brand">
          <span className="brand__mark" />
          <span>PHOSPHOR</span>
        </div>
        <nav className="view-nav" aria-label="Phosphor surfaces">
          {NAV_ITEMS.map((item) => (
            <button key={item.view} className={view === item.view ? 'is-active' : ''} onClick={() => setView(item.view)}>
              {item.label}
            </button>
          ))}
        </nav>
        <span className="titlebar__scene">{scene.name}</span>
        {previewDsl && <span className="preview-badge">previewing proposal</span>}
        {importError && <span className="import-error">{importError}</span>}
        <div className="titlebar__spacer" />
        <Label>mode</Label>
        <strong>AI / vibe</strong>
        <span className="muted">/ notation</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".me,.json,application/json,application/vnd.phosphor.bundle+json,text/plain"
          className="visually-hidden"
          onChange={(event) => {
            void importScene(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
        <Button icon={<FileUp size={13} />} onClick={() => fileInputRef.current?.click()}>
          import
        </Button>
        <Button icon={<Download size={13} />} tone="prim" onClick={() => exportMeFile(scene.name, dsl)}>
          export .me
        </Button>
        <Button icon={<Code2 size={13} />} tone="prim" onClick={() => exportHtmlEmbed(scene.name, dsl, appearance)}>
          html
        </Button>
      </header>

      {view === 'author' ? (
        <>
          <aside className="left-stack">
            <DirectorPanel
              dsl={dsl}
              provider={provider}
              providerConfig={modelProviders[provider]}
              providerConfigs={modelProviders}
              onProviderChange={setProvider}
              onCommit={commitProposal}
              onPreview={previewProposal}
            />
            <NotationPanel
              dsl={dsl}
              scene={parseScene(dsl)}
              onChange={(value) => {
                setDsl(value);
                setPreviewDsl(null);
              }}
            />
          </aside>

          <section className="preview-stage">
            <div className="preview-toolbar">
              <Label>chrome</Label>
              <Segmented<PreviewChrome>
                value={appearance.chrome}
                onChange={(chrome) => updateAppearance({ chrome })}
                options={[
                  { value: 'bezel', label: 'bezel' },
                  { value: 'flat', label: 'flat' },
                  { value: 'none', label: 'none' },
                ]}
              />
              <Label>mode</Label>
              <Segmented<PreviewMode>
                value={appearance.mode}
                onChange={(mode) => updateAppearance({ mode })}
                options={[
                  { value: 'color', label: 'color' },
                  { value: '1-bit', label: '1-bit' },
                ]}
              />
              <Label>renderer</Label>
              <Segmented<RendererKind>
                value={renderer}
                onChange={setRenderer}
                options={[
                  { value: 'webgl', label: 'webgl' },
                  { value: 'canvas', label: 'canvas' },
                ]}
              />
              <Label>tick</Label>
              <Segmented<TickRate>
                value={appearance.tickRate}
                onChange={(tickRate) => updateAppearance({ tickRate })}
                options={[
                  { value: 24, label: '24' },
                  { value: 30, label: '30' },
                  { value: 60, label: '60' },
                ]}
              />
            </div>

            <div className="preview-wrap">
              <EnginePreview scene={scene} appearance={appearance} renderer={renderer} tick={tick} />
            </div>

            <div className="transport">
              <Button icon={<SkipBack size={14} />} onClick={() => setTick(0)} />
              <Button tone="prim" icon={playing ? <Pause size={14} /> : <Play size={14} />} onClick={() => setPlaying((value) => !value)}>
                {playing ? 'pause' : 'play'}
              </Button>
              <Button icon={<SkipForward size={14} />} onClick={() => setTick((current) => Math.min(durationTicks - 1, current + 1))} />
              <Button icon={<RotateCcw size={14} />} active={Boolean(previewDsl)} onClick={() => setPreviewDsl(null)}>
                commit view
              </Button>
              <Phos tone="amber" size={23}>
                {formatTime(tick, appearance.tickRate)}
              </Phos>
              <span className="muted">/ {formatMs(scene.duration)}</span>
              <div className="titlebar__spacer" />
              <Label>tick</Label>
              <Phos size={18}>{tick.toString().padStart(3, '0')}</Phos>
              <span className="muted">/ {durationTicks}</span>
            </div>
          </section>

          <aside className="right-stack">
            <Panel title="PHOSPHOR" dense>
              <SliderRow label="decay" value={appearance.decay} min={0} max={800} step={10} display={`${appearance.decay}ms`} onChange={(decay) => updateAppearance({ decay })} />
              <SliderRow label="bloom" value={appearance.bloom} min={0} max={3} step={0.1} display={appearance.bloom.toFixed(1)} onChange={(bloom) => updateAppearance({ bloom })} />
              <SliderRow
                label="scanlines"
                value={appearance.scanlines}
                min={0}
                max={1}
                step={0.05}
                display={appearance.scanlines.toFixed(2)}
                onChange={(scanlines) => updateAppearance({ scanlines })}
              />
              <SliderRow
                label="curvature"
                value={appearance.curvature}
                min={0}
                max={1}
                step={0.05}
                display={appearance.curvature.toFixed(2)}
                onChange={(curvature) => updateAppearance({ curvature })}
              />
              <SliderRow label="flicker" value={appearance.flicker} min={0} max={1} step={0.02} display={appearance.flicker.toFixed(2)} onChange={(flicker) => updateAppearance({ flicker })} />
              <SliderRow
                label="chromatic"
                value={appearance.chromatic}
                min={0}
                max={1}
                step={0.02}
                display={appearance.chromatic.toFixed(2)}
                onChange={(chromatic) => updateAppearance({ chromatic })}
              />
            </Panel>

            <SceneLibrary onFork={forkLibraryScene} />

            <Panel title="EFFECTS" flags="12 primitives" dense flush className="effects-panel">
              {EFFECTS.map(([name, description]) => {
                const used = scene.events.filter((event) => event.effect === name).length;
                return (
                  <button key={name} className="effect-row" onClick={() => insertEffect(name, tick, appearance.tickRate, setDsl)}>
                    <span className="effect-row__glyph">{glyphFor(name)}</span>
                    <span>
                      <strong>{name}</strong>
                      <small>{description}</small>
                    </span>
                    <em>{used ? `x${used}` : '-'}</em>
                  </button>
                );
              })}
            </Panel>
          </aside>

          <section className="timeline-slot">
            <Timeline scene={scene} tick={tick} rate={appearance.tickRate} onScrub={(nextTick) => setTick(Math.max(0, Math.min(durationTicks - 1, nextTick)))} />
          </section>
        </>
      ) : (
        <section className="surface-stage">
          {view === 'start' && <StartSurface onForkScene={forkLibraryScene} onOpenAuthor={() => setView('author')} />}
          {view === 'library' && <LibrarySurface onForkScene={forkLibraryScene} onOpenAuthor={() => setView('author')} />}
          {view === 'effects' && <EffectDetailSurface dsl={dsl} onDslChange={setDsl} />}
          {view === 'assets' && <AssetsSurface appearance={appearance} onAppearanceChange={updateAppearance} />}
          {view === 'admin' && (
            <AdminSurface
              provider={provider}
              providerConfigs={modelProviders}
              onProviderChange={setProvider}
              onProviderConfigChange={updateModelProvider}
            />
          )}
          {view === 'export' && (
            <ExportSurface
              dsl={dsl}
              scene={scene}
              appearance={appearance}
              renderer={renderer}
              provider={provider}
              providerConfigs={modelProviders}
              jobs={jobs}
              onForkScene={forkLibraryScene}
              onDslChange={setDsl}
              onAppearanceChange={updateAppearance}
              onRendererChange={setRenderer}
              onProviderChange={setProvider}
              onCreateJob={createJob}
              onOpenAuthor={() => setView('author')}
            />
          )}
          {view === 'settings' && (
            <SettingsSurface
              dsl={dsl}
              scene={scene}
              appearance={appearance}
              renderer={renderer}
              provider={provider}
              providerConfigs={modelProviders}
              jobs={jobs}
              onForkScene={forkLibraryScene}
              onDslChange={setDsl}
              onAppearanceChange={updateAppearance}
              onRendererChange={setRenderer}
              onProviderChange={setProvider}
              onCreateJob={createJob}
              onOpenAuthor={() => setView('author')}
            />
          )}
          {view === 'empty' && <EmptySurface onForkScene={forkLibraryScene} onOpenAuthor={() => setView('author')} />}
          <aside className="surface-side">
            <SceneSummaryPanel scene={scene} />
            <RecentScenesPanel recents={recents} onOpen={openRecent} />
          </aside>
        </section>
      )}

      <footer className="statusbar">
        <span className="statusbar__running">running</span>
        <span>
          {appearance.tickRate} Hz - {durationTicks} ticks - 96 x 36 cells
        </span>
        <span className="titlebar__spacer" />
        <span>
          director {provider} - renderer {renderer}
        </span>
      </footer>
    </main>
  );
}

function parseHashView(): AppView {
  const hash = window.location.hash.replace('#', '');
  return NAV_ITEMS.some((item) => item.view === hash) ? (hash as AppView) : 'author';
}

function formatTime(tick: number, rate: number) {
  const ms = Math.round((tick / rate) * 1000);
  return `00:${(ms / 1000).toFixed(3).padStart(6, '0')}`;
}

function formatMs(ms: number) {
  return `00:${(ms / 1000).toFixed(3).padStart(6, '0')}`;
}

function glyphFor(name: string) {
  const glyphs: Record<string, string> = {
    type: 'T',
    cursor: '_',
    'scan-line': '=',
    glitch: '#',
    pulse: 'O',
    'decay-trail': '*',
    dither: '%',
    wave: '~',
    wipe: '/',
    loop: '@',
    shake: '!',
    flash: '+',
  };
  return glyphs[name] ?? '?';
}

function insertEffect(name: string, tick: number, rate: number, setDsl: (updater: (current: string) => string) => void) {
  const at = Math.round((tick / rate) * 1000);
  const line = effectInsertion(name, at);
  setDsl((current) => `${current.trimEnd()}\n${line}`);
}

function effectInsertion(name: string, at: number) {
  const insertions: Record<string, string> = {
    type: `at ${at}ms type "new typed line" slowly`,
    cursor: `at ${at}ms cursor "_" blink 500ms`,
    'scan-line': `at ${at}ms scan-line row 18 400ms`,
    glitch: `at ${at}ms glitch "SYSTEM READY" 80ms burst`,
    pulse: `at ${at}ms pulse "new pulse" amber 600ms`,
    'decay-trail': `at ${at}ms trail "*" path(8,25 14,23 22,22 34,20 48,18 66,16) 45ms/step`,
    dither: `at ${at}ms dither ramp 0->1 bayer4 900ms`,
    wave: `at ${at}ms wave "signal carrier" 1200ms`,
    wipe: `at ${at}ms wipe "WIPE REVEAL" diagonal 500ms`,
    loop: `at ${at}ms loop "<<< >>> <<< >>>"`,
    shake: `at ${at}ms shake "SHAKE" 3px 200ms`,
    flash: `at ${at}ms flash "screen" 80ms`,
  };
  return insertions[name] ?? `at ${at}ms ${name} "new ${name}"`;
}
