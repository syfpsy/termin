import { Code2, Download, FileUp, Pause, Play, Redo2, RotateCcw, SkipBack, SkipForward, Undo2, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ensureAudioRunning, isAudioMuted, setAudioMuted, scheduleEventSounds } from '../engine/audio';
import { TickClock } from '../engine/clock';
import { parseScene } from '../engine/dsl';
import {
  addEventToSource,
  addKeyframeToAnimation,
  addMarkerToSource,
  appendAnimation,
  defaultEventTemplate,
  deleteAnimationInSource,
  deleteEventInSource,
  deleteEventsInSource,
  deleteMarkerInSource,
  eventsToFragment,
  moveEventInSource,
  moveEventsInSource,
  moveKeyframe as moveKeyframeOp,
  pasteEventLines,
  patchEventInSource,
  removeKeyframe as removeKeyframeOp,
  rescaleEventsInSource,
  resizeEventInSource,
  setEventFlagInSource,
  setKeyframeEasing as setKeyframeEasingOp,
  setKeyframeValue as setKeyframeValueOp,
  splitEventAtMs,
  type FlagName,
} from '../engine/dslEdit';
import type {
  AnimatableAppearanceProp,
  Appearance,
  EasingKind,
  PropertyAnimation,
  ProviderKind,
  RendererKind,
  SceneEvent,
  SceneMarker,
  TickRate,
} from '../engine/types';
import { DEFAULT_APPEARANCE } from '../engine/types';
import { createExportJob, EXPORT_TARGETS, type ExportJob, type ExportTarget } from '../export/queue';
import type { LibraryScene } from '../scenes/library';
import type { ModelProviderConfig } from '../state/modelProviders';
import type { DirectorProposal } from '../state/types';
import {
  loadAppearance,
  loadModelProviders,
  loadProvider,
  loadRenderer,
  saveAppearance,
  saveModelProviders,
  saveProvider,
  saveRenderer,
} from '../state/storage';
import { saveProject as persistProject } from '../state/projectDb';
import {
  addAsset,
  addScene,
  duplicateScene as duplicateProjectScene,
  makeEmptyProject,
  patchAsset,
  patchScene,
  removeAsset,
  removeScene,
  renameAsset,
  renameScene,
  type Project,
  type ProjectAsset,
  type ProjectAssetBody,
  type SceneId,
} from '../state/projectSchema';
import {
  applyDataAssetToSource,
  assetToEventLines,
  insertEventLinesIntoSource,
} from '../state/assetUtils';
import { clearLegacyState, loadOrInitActiveProject, writeActiveProjectId } from '../state/projectMigration';
import { readProjectFile, writeProjectFile, PROJECT_FILE_MIME } from '../export/projectFile';
import { DEFAULT_DSL } from '../engine/dsl';
import type { Session } from '@supabase/supabase-js';
import {
  getCurrentSession,
  isSupabaseConfigured,
  onAuthStateChange,
  signOut,
} from '../state/authState';
import { Button, Label, Panel, Phos, Splitter } from './components';
import { DirectorPanel } from './DirectorPanel';
import { EnginePreview } from './EnginePreview';
import { NotationPanel } from './NotationPanel';
import { SceneLibrary } from './SceneLibrary';
import {
  AdminSurface,
  AssetsSurface,
  DocsSurface,
  EffectDetailSurface,
  EmptySurface,
  ExportSurface,
  LibrarySurface,
  SceneSummaryPanel,
  SettingsSurface,
  StartSurface,
} from './Surfaces';
import { ProjectPanel } from './ProjectPanel';
import { AssetPanel } from './AssetPanel';
import { EffectControlsPanel } from './EffectControlsPanel';
import { TitlebarMenu } from './TitlebarMenu';
import { CloudPanel } from './CloudPanel';
import { Timeline } from './Timeline';

type AppView =
  | 'author'
  | 'start'
  | 'library'
  | 'effects'
  | 'assets'
  | 'export'
  | 'docs'
  | 'admin'
  | 'settings'
  | 'empty';

const NAV_ITEMS: Array<{ view: AppView; label: string }> = [
  { view: 'author', label: 'author' },
  { view: 'start', label: 'start' },
  { view: 'library', label: 'library' },
  { view: 'effects', label: 'effects' },
  { view: 'assets', label: 'assets' },
  { view: 'export', label: 'export' },
  { view: 'docs', label: 'docs' },
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
  ['counter', 'roll up digits'],
] as const;

const VIEWPORT_LOCK_QUERY = '(max-width: 759px), (max-height: 519px)';

export function App() {
  const [view, setView] = useState<AppView>(() => parseHashView());
  const [project, setProject] = useState<Project | null>(null);
  const [dsl, setDsl] = useState<string>(DEFAULT_DSL);
  const [previewDsl, setPreviewDsl] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [appearance, setAppearance] = useState<Appearance>(() => ({ ...DEFAULT_APPEARANCE, ...loadAppearance() }));
  const [renderer, setRenderer] = useState<RendererKind>(loadRenderer);
  const [provider, setProvider] = useState<ProviderKind>(loadProvider);
  const [modelProviders, setModelProviders] = useState<Record<ProviderKind, ModelProviderConfig>>(loadModelProviders);
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [playing, setPlaying] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [viewportTooSmall, setViewportTooSmall] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(VIEWPORT_LOCK_QUERY).matches,
  );
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(() => new Set());
  const [timelineUnits, setTimelineUnits] = useState<'frame' | 'ms'>('frame');
  const [helpOpen, setHelpOpen] = useState(false);
  const [audioMuted, setAudioMutedState] = useState(false);
  const [rippleEdit, setRippleEdit] = useState(false);
  const [loopRegion, setLoopRegion] = useState<{ startMs: number; endMs: number } | null>(null);
  const [onionSkin, setOnionSkin] = useState(false);
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [colLeftPx, setColLeftPx] = useState(() => loadLayoutDim('colLeft', 320, 220, 600));
  const [colRightPx, setColRightPx] = useState(() => loadLayoutDim('colRight', 270, 200, 600));
  const [rowTimelinePx, setRowTimelinePx] = useState(() => loadLayoutDim('rowTimeline', 184, 120, 720));
  const clipboardRef = useRef<string>('');
  const activeDsl = previewDsl ?? dsl;
  const scene = useMemo(() => parseScene(activeDsl), [activeDsl]);
  const durationTicks = Math.max(1, Math.ceil((scene.duration / 1000) * appearance.tickRate));
  const clockRef = useRef<TickClock | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const commitDsl = useCallback(
    (next: string) => {
      if (next === dsl) return;
      setPast((prev) => [...prev, dsl].slice(-100));
      setFuture([]);
      setDsl(next);
      setPreviewDsl(null);
    },
    [dsl],
  );

  const undo = useCallback(() => {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setFuture((future) => [dsl, ...future].slice(0, 100));
      setDsl(previous);
      setPreviewDsl(null);
      return prev.slice(0, -1);
    });
  }, [dsl]);

  const jumpHistory = useCallback(
    (stepsBack: number) => {
      if (stepsBack <= 0) return;
      setPast((prevPast) => {
        if (prevPast.length === 0) return prevPast;
        const step = Math.min(stepsBack, prevPast.length);
        const target = prevPast[prevPast.length - step];
        // Items being undone in order from oldest to newest:
        //   prevPast[len - step + 1], ..., prevPast[len - 1], current dsl
        // They go onto the future stack newest-first, so reverse before prepending.
        const undone = prevPast.slice(prevPast.length - step + 1).concat(dsl);
        setFuture((future) => [...undone.reverse(), ...future].slice(0, 100));
        setDsl(target);
        setPreviewDsl(null);
        return prevPast.slice(0, prevPast.length - step);
      });
    },
    [dsl],
  );

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setPast((past) => [...past, dsl].slice(-100));
      setDsl(next);
      setPreviewDsl(null);
      return prev.slice(1);
    });
  }, [dsl]);

  // Boot: load (or migrate) the active project, then seed the editor.
  useEffect(() => {
    let cancelled = false;
    const seed = (typeof window !== 'undefined' && window.localStorage.getItem('phosphor.scene.dsl')) || DEFAULT_DSL;
    loadOrInitActiveProject(seed)
      .then((loaded) => {
        if (cancelled) return;
        setProject(loaded);
        const active = loaded.scenes.find((s) => s.id === loaded.activeSceneId);
        setDsl(active?.dsl ?? loaded.scenes[0]?.dsl ?? DEFAULT_DSL);
        clearLegacyState();
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.warn('Phosphor project load failed:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Global auth listener — single source of truth for the signed-in
  // session. The CloudPanel and the new account panel both read from
  // this state instead of running their own listeners.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    void getCurrentSession().then((current) => {
      if (!cancelled) setSession(current);
    });
    const unsub = onAuthStateChange((next) => {
      setSession(next);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Sync the active scene's dsl back into the project (debounced) and persist.
  useEffect(() => {
    if (!project || !project.activeSceneId) return;
    const active = project.scenes.find((s) => s.id === project.activeSceneId);
    if (!active || active.dsl === dsl) return;
    const handle = window.setTimeout(() => {
      const parsed = parseScene(dsl);
      const next = patchScene(project, project.activeSceneId!, {
        dsl,
        name: parsed.name || active.name,
        durationMs: parsed.duration > 0 ? parsed.duration : active.durationMs,
      });
      setProject(next);
      void persistProject(next).catch((error) => {
        // eslint-disable-next-line no-console
        console.warn('Phosphor project save failed:', error);
      });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [dsl, project]);

  useEffect(() => saveAppearance(appearance), [appearance]);
  useEffect(() => saveRenderer(renderer), [renderer]);
  useEffect(() => saveProvider(provider), [provider]);
  useEffect(() => saveModelProviders(modelProviders), [modelProviders]);
  useEffect(() => saveLayoutDim('colLeft', colLeftPx), [colLeftPx]);
  useEffect(() => saveLayoutDim('colRight', colRightPx), [colRightPx]);
  useEffect(() => saveLayoutDim('rowTimeline', rowTimelinePx), [rowTimelinePx]);

  const resizeColLeft = useCallback((delta: number) => {
    setColLeftPx((current) => clamp(current + delta, 220, 600));
  }, []);
  const resizeColRight = useCallback((delta: number) => {
    setColRightPx((current) => clamp(current - delta, 200, 600));
  }, []);
  const resizeTimelineRow = useCallback((delta: number) => {
    setRowTimelinePx((current) => clamp(current - delta, 120, 720));
  }, []);

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
    setAudioMuted(audioMuted);
  }, [audioMuted]);

  useEffect(() => {
    const mql = window.matchMedia(VIEWPORT_LOCK_QUERY);
    const handler = (event: MediaQueryListEvent) => setViewportTooSmall(event.matches);
    mql.addEventListener('change', handler);
    setViewportTooSmall(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const selectedEvents = useMemo(
    () => scene.events.filter((event) => selectedEventIds.has(event.id)),
    [scene.events, selectedEventIds],
  );
  const selectedEvent = selectedEvents[0] ?? null;
  const tickMs = 1000 / appearance.tickRate;

  const selectOne = useCallback((id: string | null) => {
    setSelectedEventIds(id ? new Set([id]) : new Set());
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedEventIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectMany = useCallback((ids: string[], replace = true) => {
    setSelectedEventIds((current) => {
      const next = replace ? new Set<string>() : new Set(current);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    clockRef.current?.stop();
    if (!playing) return;
    if (!isAudioMuted()) void ensureAudioRunning();
    const clock = new TickClock(appearance.tickRate, (count) => {
      setTick((current) => {
        let next: number;
        if (loopRegion) {
          const startTick = Math.floor((loopRegion.startMs / 1000) * appearance.tickRate);
          const endTick = Math.max(startTick + 1, Math.ceil((loopRegion.endMs / 1000) * appearance.tickRate));
          if (current < startTick || current >= endTick) {
            next = startTick;
          } else {
            const span = endTick - startTick;
            next = startTick + ((current - startTick + count) % span);
          }
        } else {
          next = (current + count) % durationTicks;
        }
        // Schedule audio for events whose at-time falls in (current, next].
        // Wrapping (next < current) is handled by scheduling in two halves.
        if (!isAudioMuted() && scene.events.length > 0 && next !== current) {
          if (next > current) {
            scheduleEventSounds(scene.events, current, next, appearance.tickRate);
          } else {
            const lastTick = (loopRegion
              ? Math.ceil((loopRegion.endMs / 1000) * appearance.tickRate)
              : durationTicks) - 1;
            scheduleEventSounds(scene.events, current, lastTick, appearance.tickRate);
            scheduleEventSounds(scene.events, -1, next, appearance.tickRate);
          }
        }
        return next;
      });
    });
    clockRef.current = clock;
    clock.start();
    return () => clock.stop();
  }, [appearance.tickRate, durationTicks, loopRegion, playing, scene.events]);

  function updateAppearance(patch: Partial<Appearance>) {
    setAppearance((current) => ({ ...current, ...patch }));
  }

  function commitProposal(proposal: DirectorProposal) {
    commitDsl(proposal.dsl);
  }

  function previewProposal(proposal: DirectorProposal) {
    setPreviewDsl(proposal.dsl);
  }

  function forkLibraryScene(libraryScene: LibraryScene) {
    commitDsl(libraryScene.dsl);
    setTick(0);
    selectOne(null);
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
    setImportError(null);
    // Project file: detect by extension. Round-tripped through ZIP+JSON.
    if (file.name.toLowerCase().endsWith('.phosphor.proj') || file.type === 'application/vnd.phosphor.project+zip') {
      try {
        const buffer = new Uint8Array(await file.arrayBuffer());
        const result = readProjectFile(buffer);
        if (!result.ok) {
          setImportError(result.error);
          return;
        }
        const opened = result.project;
        applyProject(opened);
        writeActiveProjectId(opened.id);
        const active = opened.scenes.find((s) => s.id === opened.activeSceneId) ?? opened.scenes[0];
        if (active) {
          setDsl(active.dsl);
          setPreviewDsl(null);
          setPast([]);
          setFuture([]);
          setSelectedEventIds(new Set());
          setTick(0);
        }
        setView('author');
      } catch (error) {
        setImportError(error instanceof Error ? error.message : 'Project import failed.');
      }
      return;
    }
    try {
      const imported = await readSceneFile(file);
      commitDsl(imported.dsl);
      if (imported.appearance) setAppearance(imported.appearance);
      selectOne(null);
      setTick(0);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed.');
    }
  }

  function exportProjectFile() {
    if (!project) return;
    const flushed = flushActiveScene(project) ?? project;
    const bytes = writeProjectFile(flushed).bytes;
    const filename = writeProjectFile(flushed).filename;
    triggerProjectDownload(bytes, filename);
  }

  // Save the current dsl into the active scene before mutating the project.
  // Returns the freshly-merged project so callers can chain mutations.
  function flushActiveScene(input: Project | null = project): Project | null {
    if (!input || !input.activeSceneId) return input;
    const active = input.scenes.find((s) => s.id === input.activeSceneId);
    if (!active || active.dsl === dsl) return input;
    const parsed = parseScene(dsl);
    return patchScene(input, input.activeSceneId, {
      dsl,
      name: parsed.name || active.name,
      durationMs: parsed.duration > 0 ? parsed.duration : active.durationMs,
    });
  }

  function applyProject(next: Project): void {
    setProject(next);
    void persistProject(next).catch((error) => {
      // eslint-disable-next-line no-console
      console.warn('Phosphor project save failed:', error);
    });
  }

  function selectSceneById(id: SceneId) {
    if (!project || project.activeSceneId === id) return;
    const flushed = flushActiveScene(project) ?? project;
    const switched: Project = { ...flushed, activeSceneId: id, updatedAt: new Date().toISOString() };
    const target = switched.scenes.find((s) => s.id === id);
    if (!target) return;
    applyProject(switched);
    setDsl(target.dsl);
    setPreviewDsl(null);
    setPast([]);
    setFuture([]);
    setSelectedEventIds(new Set());
    setTick(0);
    setView('author');
  }

  function addEmptyScene() {
    if (!project) return;
    const flushed = flushActiveScene(project) ?? project;
    const next = addScene(flushed, {
      name: 'untitled_scene',
      dsl: 'scene untitled_scene 1.6s\n# new scene — describe the motion in .me notation\nat 0ms type "READY" slowly',
      durationMs: 1600,
    });
    applyProject(next);
    const newScene = next.scenes[next.scenes.length - 1];
    if (newScene) {
      setDsl(newScene.dsl);
      setPreviewDsl(null);
      setPast([]);
      setFuture([]);
      setSelectedEventIds(new Set());
      setTick(0);
      setView('author');
    }
  }

  function renameSceneById(id: SceneId, name: string) {
    if (!project) return;
    const flushed = flushActiveScene(project) ?? project;
    applyProject(renameScene(flushed, id, name));
  }

  function duplicateSceneById(id: SceneId) {
    if (!project) return;
    const flushed = flushActiveScene(project) ?? project;
    const next = duplicateProjectScene(flushed, id);
    applyProject(next);
    const dup = next.scenes[next.scenes.length - 1];
    if (dup) selectSceneById(dup.id);
  }

  function deleteSceneById(id: SceneId) {
    if (!project) return;
    if (project.scenes.length <= 1) return;
    const wasActive = project.activeSceneId === id;
    const flushed = wasActive ? project : flushActiveScene(project) ?? project;
    const next = removeScene(flushed, id);
    applyProject(next);
    if (wasActive && next.activeSceneId) {
      const target = next.scenes.find((s) => s.id === next.activeSceneId);
      if (target) {
        setDsl(target.dsl);
        setPreviewDsl(null);
        setPast([]);
        setFuture([]);
        setSelectedEventIds(new Set());
        setTick(0);
      }
    }
  }

  function renameProject(name: string) {
    if (!project) return;
    const flushed = flushActiveScene(project) ?? project;
    applyProject({ ...flushed, name, updatedAt: new Date().toISOString() });
  }

  function handleNewProject() {
    if (!project) return;
    const name = window.prompt('New project name', 'Untitled project');
    if (!name || !name.trim()) return;
    // Flush current state before swapping out so we don't lose pending edits.
    flushActiveScene(project);
    const fresh = makeEmptyProject(name.trim(), DEFAULT_DSL, 'untitled_scene');
    applyProject(fresh);
    writeActiveProjectId(fresh.id);
    const active = fresh.scenes[0];
    if (active) {
      setDsl(active.dsl);
      setPreviewDsl(null);
      setPast([]);
      setFuture([]);
      setSelectedEventIds(new Set());
      setTick(0);
      setView('author');
    }
  }

  /** Replace the active project with one fetched from Supabase. */
  function loadProjectFromCloud(next: Project) {
    flushActiveScene(project);
    applyProject(next);
    writeActiveProjectId(next.id);
    const active = next.scenes.find((s) => s.id === next.activeSceneId) ?? next.scenes[0];
    if (active) {
      setDsl(active.dsl);
      setPreviewDsl(null);
      setPast([]);
      setFuture([]);
      setSelectedEventIds(new Set());
      setTick(0);
      setView('author');
    }
  }

  /* ---------- assets ---------- */

  function addAssetToProject(body: ProjectAssetBody, name: string) {
    if (!project) return;
    const flushed = flushActiveScene(project) ?? project;
    applyProject(addAsset(flushed, body, name));
  }

  function renameAssetInProject(assetId: string, name: string) {
    if (!project) return;
    const flushed = flushActiveScene(project) ?? project;
    applyProject(renameAsset(flushed, assetId, name));
  }

  function removeAssetFromProject(assetId: string) {
    if (!project) return;
    const flushed = flushActiveScene(project) ?? project;
    applyProject(removeAsset(flushed, assetId));
  }

  function patchAssetInProject(assetId: string, body: ProjectAssetBody) {
    if (!project) return;
    const flushed = flushActiveScene(project) ?? project;
    applyProject(patchAsset(flushed, assetId, body));
  }

  /**
   * Insert an asset into the active scene at the playhead time.
   * Text/ASCII/image-ASCII produce `at <ms>ms type` lines; palette
   * mutates appearance; data injects (or replaces) the `data {}` line.
   */
  function applyAssetAtPlayhead(asset: ProjectAsset) {
    if (!project) return;
    const playheadMs = Math.round((tick / appearance.tickRate) * 1000);

    if (asset.kind === 'palette') {
      // Cosmetic only — palette drives the renderer tones via CSS vars
      // future work. For now, mark on the project so we can pick it up
      // when palette tokens are wired into the engine.
      applyProject({
        ...project,
        meta: { ...project.meta, lastAppliedPaletteId: asset.id } as Project['meta'],
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if (asset.kind === 'data') {
      const next = applyDataAssetToSource(dsl, asset.data);
      commitDsl(next);
      return;
    }

    const fragments = assetToEventLines(asset, playheadMs);
    if (fragments.length === 0) return;
    const next = insertEventLinesIntoSource(dsl, fragments);
    commitDsl(next);
  }

  function applyAssetByIdAtMs(assetId: string, atMs: number) {
    if (!project) return;
    const asset = project.assets.find((a) => a.id === assetId);
    if (!asset) return;
    if (asset.kind === 'palette') {
      applyProject({
        ...project,
        meta: { ...project.meta, lastAppliedPaletteId: asset.id } as Project['meta'],
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    if (asset.kind === 'data') {
      const next = applyDataAssetToSource(dsl, asset.data);
      commitDsl(next);
      return;
    }
    const fragments = assetToEventLines(asset, atMs);
    if (fragments.length === 0) return;
    const next = insertEventLinesIntoSource(dsl, fragments);
    commitDsl(next);
  }

  const moveEvent = useCallback(
    (event: SceneEvent, atMs: number) => {
      const next = moveEventInSource({
        source: dsl,
        event,
        atMs,
        sceneDurationMs: scene.duration,
        snapMs: 1000 / appearance.tickRate,
      });
      commitDsl(next);
    },
    [appearance.tickRate, commitDsl, dsl, scene.duration],
  );

  const resizeEvent = useCallback(
    (event: SceneEvent, durationMs: number) => {
      const next = resizeEventInSource({ source: dsl, event, durationMs });
      commitDsl(next);
    },
    [commitDsl, dsl],
  );

  const deleteEvent = useCallback(
    (event: SceneEvent) => {
      const next = deleteEventInSource(dsl, event);
      commitDsl(next);
      selectOne(null);
    },
    [commitDsl, dsl, selectOne],
  );

  const patchEvent = useCallback(
    (event: SceneEvent, patch: Partial<{ atMs: number; effect: string; target: string; modifiers: string }>) => {
      const next = patchEventInSource({
        source: dsl,
        event,
        patch,
        sceneDurationMs: scene.duration,
      });
      commitDsl(next);
    },
    [commitDsl, dsl, scene.duration],
  );

  const addEventAt = useCallback(
    (atMs: number, effect: string) => {
      const template = defaultEventTemplate(effect, atMs);
      const { source: next, lineNumber } = addEventToSource({
        source: dsl,
        atMs,
        effect: template.effect,
        target: template.target,
        modifiers: template.modifiers,
        sceneDurationMs: scene.duration,
        snapMs: 1000 / appearance.tickRate,
      });
      commitDsl(next);
      const reparsed = parseScene(next);
      const inserted = reparsed.events.find((evt) => evt.line === lineNumber);
      if (inserted) selectOne(inserted.id);
    },
    [appearance.tickRate, commitDsl, dsl, scene.duration, selectOne],
  );

  const moveEvents = useCallback(
    (events: SceneEvent[], deltaMs: number) => {
      if (events.length === 0) return;
      const next = moveEventsInSource({
        source: dsl,
        events,
        deltaMs,
        sceneDurationMs: scene.duration,
        snapMs: tickMs,
      });
      commitDsl(next);
    },
    [commitDsl, dsl, scene.duration, tickMs],
  );

  const deleteEvents = useCallback(
    (events: SceneEvent[]) => {
      if (events.length === 0) return;
      let next = deleteEventsInSource(dsl, events);
      if (rippleEdit) {
        // Ripple: shift later events left to close the gap, by the deleted span
        const minAt = events.reduce((m, e) => Math.min(m, e.at), Number.POSITIVE_INFINITY);
        const span = events.reduce((m, e) => Math.max(m, e.at + 1), 0) - minAt;
        const reparsed = parseScene(next);
        const after = reparsed.events.filter((e) => e.at > minAt);
        if (after.length > 0 && span > 0) {
          next = moveEventsInSource({
            source: next,
            events: after,
            deltaMs: -span,
            sceneDurationMs: reparsed.duration,
            snapMs: tickMs,
          });
        }
      }
      commitDsl(next);
      setSelectedEventIds(new Set());
    },
    [commitDsl, dsl, rippleEdit, tickMs],
  );

  const setEventFlag = useCallback(
    (event: SceneEvent, flag: FlagName, value: boolean) => {
      commitDsl(setEventFlagInSource(dsl, event, flag, value));
    },
    [commitDsl, dsl],
  );

  const splitEventAt = useCallback(
    (event: SceneEvent, atMs: number) => {
      const result = splitEventAtMs({ source: dsl, event, atMs, sceneDurationMs: scene.duration });
      if (result.lineNumber === null) return;
      commitDsl(result.source);
      const reparsed = parseScene(result.source);
      const newHalf = reparsed.events.find((e) => e.line === result.lineNumber);
      if (newHalf) selectOne(newHalf.id);
    },
    [commitDsl, dsl, scene.duration, selectOne],
  );

  const addMarkerAt = useCallback(
    (name: string, atMs: number) => {
      const result = addMarkerToSource({ source: dsl, name, atMs, sceneDurationMs: scene.duration });
      commitDsl(result.source);
    },
    [commitDsl, dsl, scene.duration],
  );

  const removeMarker = useCallback(
    (marker: SceneMarker) => {
      commitDsl(deleteMarkerInSource(dsl, marker));
    },
    [commitDsl, dsl],
  );

  const copySelectionToClipboard = useCallback(() => {
    if (selectedEvents.length === 0) return;
    const fragment = eventsToFragment(selectedEvents);
    clipboardRef.current = fragment;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(fragment).catch(() => undefined);
    }
  }, [selectedEvents]);

  const pasteFromClipboard = useCallback(
    async (atMs: number) => {
      let fragment = clipboardRef.current;
      if (!fragment && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        try {
          fragment = await navigator.clipboard.readText();
        } catch {
          fragment = '';
        }
      }
      if (!fragment.trim()) return;
      const result = pasteEventLines({
        source: dsl,
        fragment,
        atMs,
        sceneDurationMs: scene.duration,
        snapMs: tickMs,
      });
      if (result.insertedLines.length === 0) return;
      commitDsl(result.source);
      const reparsed = parseScene(result.source);
      const inserted = reparsed.events.filter((event) => result.insertedLines.includes(event.line));
      if (inserted.length > 0) selectMany(inserted.map((event) => event.id));
    },
    [commitDsl, dsl, scene.duration, selectMany, tickMs],
  );

  const cutSelectionToClipboard = useCallback(() => {
    if (selectedEvents.length === 0) return;
    copySelectionToClipboard();
    deleteEvents(selectedEvents);
  }, [copySelectionToClipboard, deleteEvents, selectedEvents]);

  const upsertKeyframeAt = useCallback(
    (prop: AnimatableAppearanceProp, atMs: number, value: number, easing: EasingKind = 'linear') => {
      const existing = scene.animations.find(
        (animation) => animation.property === prop && animation.eventLine === null,
      );
      if (existing) {
        commitDsl(addKeyframeToAnimation(dsl, existing, { at: atMs, value, easing }));
      } else {
        const result = appendAnimation({
          source: dsl,
          property: prop,
          keyframes: [{ at: atMs, value, easing }],
        });
        if (result.lineNumber !== null) commitDsl(result.source);
      }
    },
    [commitDsl, dsl, scene.animations],
  );

  const upsertEventKeyframeAt = useCallback(
    (event: SceneEvent, param: 'intensity' | 'offset', atMs: number, value: number, easing: EasingKind = 'linear') => {
      const existing = scene.animations.find(
        (animation) => animation.property === param && animation.eventLine === event.line,
      );
      if (existing) {
        commitDsl(addKeyframeToAnimation(dsl, existing, { at: atMs, value, easing }));
      } else {
        const result = appendAnimation({
          source: dsl,
          property: param,
          keyframes: [{ at: atMs, value, easing }],
          eventLine: event.line,
        });
        if (result.lineNumber !== null) commitDsl(result.source);
      }
    },
    [commitDsl, dsl, scene.animations],
  );

  const moveKeyframe = useCallback(
    (animation: PropertyAnimation, index: number, atMs: number) => {
      commitDsl(moveKeyframeOp(dsl, animation, index, atMs, scene.duration, tickMs));
    },
    [commitDsl, dsl, scene.duration, tickMs],
  );

  const removeKeyframe = useCallback(
    (animation: PropertyAnimation, index: number) => {
      commitDsl(removeKeyframeOp(dsl, animation, index));
    },
    [commitDsl, dsl],
  );

  const setKeyframeValue = useCallback(
    (animation: PropertyAnimation, index: number, value: number) => {
      commitDsl(setKeyframeValueOp(dsl, animation, index, value));
    },
    [commitDsl, dsl],
  );

  const setKeyframeEasing = useCallback(
    (animation: PropertyAnimation, index: number, easing: EasingKind) => {
      commitDsl(setKeyframeEasingOp(dsl, animation, index, easing));
    },
    [commitDsl, dsl],
  );

  const removeAnimation = useCallback(
    (animation: PropertyAnimation) => {
      commitDsl(deleteAnimationInSource(dsl, animation));
    },
    [commitDsl, dsl],
  );

  const animatedProps = useMemo(
    () => new Set(scene.animations.map((animation) => animation.property)),
    [scene.animations],
  );

  const handleAppearanceKeyframe = useCallback(
    (prop: AnimatableAppearanceProp) => {
      const playheadMs = Math.round((tick / appearance.tickRate) * 1000);
      upsertKeyframeAt(prop, playheadMs, appearance[prop] as number);
    },
    [appearance, tick, upsertKeyframeAt],
  );

  const rescaleSelectionTo = useCallback(
    (toStartMs: number, toEndMs: number) => {
      if (selectedEvents.length < 2) return;
      const fromStart = selectedEvents.reduce((m, e) => Math.min(m, e.at), Number.POSITIVE_INFINITY);
      const fromEnd = selectedEvents.reduce((m, e) => Math.max(m, e.at), 0);
      if (fromEnd <= fromStart) return;
      const next = rescaleEventsInSource({
        source: dsl,
        events: selectedEvents,
        fromStart,
        fromEnd,
        toStart: toStartMs,
        toEnd: toEndMs,
        sceneDurationMs: scene.duration,
        snapMs: tickMs,
      });
      commitDsl(next);
    },
    [commitDsl, dsl, scene.duration, selectedEvents, tickMs],
  );

  useEffect(() => {
    function isFormElement(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      const playheadMs = Math.round((tick / appearance.tickRate) * 1000);

      if (meta && event.key.toLowerCase() === 'z') {
        if (isFormElement(event.target)) return;
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && event.key.toLowerCase() === 'y') {
        if (isFormElement(event.target)) return;
        event.preventDefault();
        redo();
        return;
      }

      if (isFormElement(event.target)) return;

      if (meta && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selectMany(scene.events.map((e) => e.id));
        return;
      }
      if (meta && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        copySelectionToClipboard();
        return;
      }
      if (meta && event.key.toLowerCase() === 'x') {
        event.preventDefault();
        cutSelectionToClipboard();
        return;
      }
      if (meta && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        void pasteFromClipboard(playheadMs);
        return;
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        if (selectedEvent) splitEventAt(selectedEvent, playheadMs);
        return;
      }
      if (event.key.toLowerCase() === 'm' && !meta) {
        event.preventDefault();
        addMarkerAt(`mark ${scene.markers.length + 1}`, playheadMs);
        return;
      }
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        setHelpOpen((open) => !open);
        return;
      }
      if (event.key === ',' || event.key === '.') {
        event.preventDefault();
        const direction = event.key === '.' ? 1 : -1;
        const stepFrames = event.shiftKey ? appearance.tickRate : 1;
        setTick((current) => Math.max(0, Math.min(durationTicks - 1, current + direction * stepFrames)));
        return;
      }

      if (event.key === 'Escape') {
        if (helpOpen) {
          event.preventDefault();
          setHelpOpen(false);
          return;
        }
        if (selectedEventIds.size > 0) {
          event.preventDefault();
          setSelectedEventIds(new Set());
        }
        return;
      }

      if (selectedEvents.length === 0) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteEvents(selectedEvents);
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const stepMs = (event.shiftKey ? 10 : 1) * tickMs;
        moveEvents(selectedEvents, direction * stepMs);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    addMarkerAt,
    appearance.tickRate,
    copySelectionToClipboard,
    cutSelectionToClipboard,
    deleteEvents,
    durationTicks,
    helpOpen,
    moveEvents,
    pasteFromClipboard,
    redo,
    scene.events,
    scene.markers.length,
    selectMany,
    selectedEvent,
    selectedEventIds.size,
    selectedEvents,
    splitEventAt,
    tick,
    tickMs,
    undo,
  ]);

  if (viewportTooSmall) {
    return <ViewportLock />;
  }

  return (
    <main
      className={`workspace ${view === 'author' ? '' : 'workspace--surface'}`}
      style={
        view === 'author'
          ? ({
              ['--col-left']: `${colLeftPx}px`,
              ['--col-right']: `${colRightPx}px`,
              ['--row-timeline']: `${rowTimelinePx}px`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <header className="titlebar" aria-label="Application controls">
        <h1 className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <span>PHOSPHOR</span>
        </h1>
        {project && (
          <TitlebarMenu
            label="File"
            preface={
              <div className="titlebar-menu__preface">
                <span className="titlebar-menu__preface-label">project</span>
                <strong>{project.name}</strong>
              </div>
            }
            items={[
              { kind: 'item', label: 'New project', onSelect: handleNewProject },
              { kind: 'item', label: 'Open project…', shortcut: '⌘O', onSelect: () => fileInputRef.current?.click() },
              { kind: 'item', label: 'Save project', shortcut: '⌘S', onSelect: exportProjectFile },
              { kind: 'divider' },
              { kind: 'header', label: 'scenes' },
              ...project.scenes.map((s) => ({
                kind: 'item' as const,
                label: s.id === project.activeSceneId ? `● ${s.name}` : `   ${s.name}`,
                onSelect: () => selectSceneById(s.id),
              })),
              { kind: 'divider' },
              { kind: 'item', label: 'New scene', shortcut: '⌘N', onSelect: addEmptyScene },
              {
                kind: 'item',
                label: 'Rename project…',
                onSelect: () => {
                  const next = window.prompt('Project name', project.name);
                  if (next && next.trim() && next.trim() !== project.name) renameProject(next.trim());
                },
              },
              { kind: 'divider' },
              { kind: 'item', label: 'Export .me', shortcut: '⌘⇧E', onSelect: () => exportMeFile(scene.name, dsl) },
              {
                kind: 'item',
                label: 'Export HTML embed',
                onSelect: () => exportHtmlEmbed(scene.name, dsl, appearance),
              },
            ]}
          />
        )}
        <nav className="view-nav" aria-label="Phosphor surfaces">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              className={view === item.view ? 'is-active' : ''}
              aria-current={view === item.view ? 'page' : undefined}
              onClick={() => setView(item.view)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <span className="titlebar__scene">
          {project ? <><span className="titlebar__project">{project.name}</span> / </> : null}
          {scene.name}
        </span>
        {previewDsl && <span className="preview-badge">previewing proposal</span>}
        {importError && <span className="import-error">{importError}</span>}
        <div className="titlebar__spacer" />
        <Label>mode</Label>
        <strong>AI / vibe</strong>
        <span className="muted">/ notation</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".me,.json,.proj,.phosphor.proj,application/json,application/vnd.phosphor.bundle+json,application/vnd.phosphor.project+zip,text/plain"
          className="visually-hidden"
          onChange={(event) => {
            void importScene(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
        <Button
          icon={<Undo2 size={13} />}
          aria-label="Undo"
          disabled={past.length === 0}
          onClick={undo}
          kbd="⌘Z"
        />
        <Button
          icon={<Redo2 size={13} />}
          aria-label="Redo"
          disabled={future.length === 0}
          onClick={redo}
          kbd="⌘⇧Z"
        />
        <Button aria-label="Keyboard shortcuts" onClick={() => setHelpOpen(true)} kbd="?">
          ?
        </Button>
        <Button icon={<FileUp size={13} />} onClick={() => fileInputRef.current?.click()}>
          import
        </Button>
        <Button icon={<Download size={13} />} tone="prim" onClick={() => exportMeFile(scene.name, dsl)}>
          export .me
        </Button>
        <Button icon={<Code2 size={13} />} tone="prim" onClick={() => exportHtmlEmbed(scene.name, dsl, appearance)}>
          html
        </Button>
        {isSupabaseConfigured && (
          session ? (
            <TitlebarMenu
              label={truncateEmail(session.user.email ?? 'signed in')}
              align="right"
              preface={
                <div className="titlebar-menu__preface">
                  <span className="titlebar-menu__preface-label">signed in</span>
                  <strong>{session.user.email ?? session.user.id}</strong>
                </div>
              }
              items={[
                { kind: 'item', label: 'Account settings', onSelect: () => setView('settings') },
                { kind: 'divider' },
                {
                  kind: 'item',
                  label: 'Sign out',
                  danger: true,
                  onSelect: () => {
                    void signOut();
                  },
                },
              ]}
            />
          ) : (
            <button
              type="button"
              className="titlebar-menu__trigger"
              onClick={() => setView('settings')}
              title="Sign in to sync"
            >
              sign in
            </button>
          )
        )}
      </header>

      {view === 'author' ? (
        <>
          <aside className="left-stack" aria-label="Project, assets, director, and notation">
            {project && (
              <ProjectPanel
                project={project}
                onSelectScene={selectSceneById}
                onAddScene={addEmptyScene}
                onRenameScene={renameSceneById}
                onDuplicateScene={duplicateSceneById}
                onDeleteScene={deleteSceneById}
                onRenameProject={renameProject}
                onSaveProject={exportProjectFile}
                onOpenProject={() => fileInputRef.current?.click()}
              />
            )}
            {project && (
              <AssetPanel
                assets={project.assets}
                onAdd={addAssetToProject}
                onRename={renameAssetInProject}
                onDelete={removeAssetFromProject}
                onUpdate={patchAssetInProject}
                onApplyAtPlayhead={applyAssetAtPlayhead}
              />
            )}
            <EffectControlsPanel
              event={selectedEvents.length === 1 ? selectedEvents[0] : null}
              scene={scene}
              rate={appearance.tickRate}
              playheadMs={Math.round((tick / appearance.tickRate) * 1000)}
              onPatchEvent={patchEvent}
              onDeleteEvent={deleteEvent}
              onUpsertEventKeyframe={upsertEventKeyframeAt}
              onRemoveAnimation={removeAnimation}
            />
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

          <Splitter
            orientation="vertical"
            onResize={resizeColLeft}
            ariaLabel="Resize director column"
            className="splitter--col-left"
          />

          <section className="preview-stage" aria-label="Live preview and transport">
            <div className="preview-wrap">
              <EnginePreview scene={scene} appearance={appearance} renderer={renderer} tick={tick} onionSkin={onionSkin} />
            </div>

            <div className="transport" role="toolbar" aria-label="Playback transport">
              <Button aria-label="Reset to start" icon={<SkipBack size={14} />} onClick={() => setTick(0)} />
              <Button tone="prim" icon={playing ? <Pause size={14} /> : <Play size={14} />} onClick={() => setPlaying((value) => !value)}>
                {playing ? 'pause' : 'play'}
              </Button>
              <Button aria-label="Step forward one tick" icon={<SkipForward size={14} />} onClick={() => setTick((current) => Math.min(durationTicks - 1, current + 1))} />
              <Button icon={<RotateCcw size={14} />} active={Boolean(previewDsl)} onClick={() => setPreviewDsl(null)}>
                commit view
              </Button>
              <Button
                aria-label={audioMuted ? 'Unmute scene audio' : 'Mute scene audio'}
                icon={audioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                active={!audioMuted}
                onClick={() => setAudioMutedState((value) => !value)}
              >
                {audioMuted ? 'mute' : 'sound'}
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

            <Splitter
              orientation="horizontal"
              onResize={resizeTimelineRow}
              ariaLabel="Resize timeline row"
              className="splitter--row-timeline"
            />

            <section className="timeline-slot" aria-label="Scene timeline">
              <Timeline
                scene={scene}
                tick={tick}
                rate={appearance.tickRate}
                units={timelineUnits}
                selectedEventIds={selectedEventIds}
                rippleEdit={rippleEdit}
                onionSkin={onionSkin}
                loopRegion={loopRegion}
                canUndo={past.length > 0}
                canRedo={future.length > 0}
                past={past}
                future={future}
                onScrub={(nextTick) => setTick(Math.max(0, Math.min(durationTicks - 1, nextTick)))}
                onUnitsChange={setTimelineUnits}
                onRippleChange={setRippleEdit}
                onOnionSkinChange={setOnionSkin}
                onLoopRegionChange={setLoopRegion}
                onSelectOne={selectOne}
                onSelectMany={selectMany}
                onToggleSelection={toggleSelection}
                onMoveEvent={moveEvent}
                onMoveEvents={moveEvents}
                onResizeEvent={resizeEvent}
                onDeleteEvent={deleteEvent}
                onDeleteEvents={deleteEvents}
                onPatchEvent={patchEvent}
                onAddEventAt={addEventAt}
                onSplitEvent={splitEventAt}
                onSetEventFlag={setEventFlag}
                onAddMarker={addMarkerAt}
                onRemoveMarker={removeMarker}
                onCopySelection={copySelectionToClipboard}
                onCutSelection={cutSelectionToClipboard}
                onPasteAt={pasteFromClipboard}
                onRescaleSelection={rescaleSelectionTo}
                onUndo={undo}
                onRedo={redo}
                onJumpToHistory={jumpHistory}
                onUpsertKeyframe={upsertKeyframeAt}
                onMoveKeyframe={moveKeyframe}
                onSetKeyframeValue={setKeyframeValue}
                onSetKeyframeEasing={setKeyframeEasing}
                onRemoveKeyframe={removeKeyframe}
                onRemoveAnimation={removeAnimation}
                onDropAssetAt={applyAssetByIdAtMs}
              />
            </section>
          </section>

          <Splitter
            orientation="vertical"
            onResize={resizeColRight}
            ariaLabel="Resize phosphor column"
            className="splitter--col-right"
          />

          <aside className="right-stack" aria-label="Cloud, library, and effects">
            <CloudPanel
              project={project}
              session={session}
              onProjectFromCloud={loadProjectFromCloud}
              onError={(message) => setImportError(message)}
            />
            <SceneLibrary onFork={forkLibraryScene} />

            <Panel id="effects" title="EFFECTS" flags={`${EFFECTS.length} primitives`} dense flush className="effects-panel">
              {EFFECTS.map(([name, description]) => {
                const used = scene.events.filter((event) => event.effect === name).length;
                return (
                  <button key={name} className="effect-row" onClick={() => addEventAt(Math.round((tick / appearance.tickRate) * 1000), name)}>
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
        </>
      ) : (
        <section className="surface-stage" aria-label={`${view} surface`}>
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
              animatedProps={animatedProps}
              session={session}
              onForkScene={forkLibraryScene}
              onDslChange={setDsl}
              onAppearanceChange={updateAppearance}
              onRendererChange={setRenderer}
              onProviderChange={setProvider}
              onCreateJob={createJob}
              onOpenAuthor={() => setView('author')}
              onAppearanceKeyframe={handleAppearanceKeyframe}
            />
          )}
          {view === 'docs' && <DocsSurface />}
          {view === 'empty' && <EmptySurface onForkScene={forkLibraryScene} onOpenAuthor={() => setView('author')} />}
          <aside className="surface-side" aria-label="Project, assets, and scene state">
            {project && (
              <ProjectPanel
                project={project}
                onSelectScene={selectSceneById}
                onAddScene={addEmptyScene}
                onRenameScene={renameSceneById}
                onDuplicateScene={duplicateSceneById}
                onDeleteScene={deleteSceneById}
                onRenameProject={renameProject}
                onSaveProject={exportProjectFile}
                onOpenProject={() => fileInputRef.current?.click()}
              />
            )}
            {project && (
              <AssetPanel
                assets={project.assets}
                onAdd={addAssetToProject}
                onRename={renameAssetInProject}
                onDelete={removeAssetFromProject}
                onUpdate={patchAssetInProject}
                onApplyAtPlayhead={applyAssetAtPlayhead}
              />
            )}
            <SceneSummaryPanel scene={scene} />
          </aside>
        </section>
      )}

      <footer className="statusbar" aria-label="Status">
        <span className="visually-hidden">Status:</span>
        <span className="statusbar__running">running</span>
        <span>
          {appearance.tickRate} Hz - {durationTicks} ticks - 96 x 36 cells
        </span>
        <span className="titlebar__spacer" />
        <span>
          director {provider} - renderer {renderer}
        </span>
      </footer>

      {helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}
    </main>
  );
}

const SHORTCUT_GROUPS: Array<{ heading: string; rows: Array<[string, string]> }> = [
  {
    heading: 'transport',
    rows: [
      ['space', 'play / pause'],
      [', / .', 'step ±1 frame'],
      ['shift + , / .', 'step ±1 second'],
      ['m', 'drop marker at playhead'],
    ],
  },
  {
    heading: 'history',
    rows: [
      ['⌘ z', 'undo'],
      ['⌘ shift z', 'redo'],
      ['⌘ y', 'redo (alternate)'],
    ],
  },
  {
    heading: 'selection',
    rows: [
      ['click bar', 'select'],
      ['shift + click', 'add to selection'],
      ['drag empty area', 'marquee box-select'],
      ['⌘ a', 'select all'],
      ['esc', 'clear selection'],
    ],
  },
  {
    heading: 'edit',
    rows: [
      ['drag bar', 'move event (snap-aware)'],
      ['drag right edge', 'resize event (when supported)'],
      ['arrow ← / →', 'nudge ±1 tick'],
      ['shift + arrow', 'nudge ±10 ticks'],
      ['delete / backspace', 'remove selected events'],
      ['⌘ shift d', 'split event at playhead'],
    ],
  },
  {
    heading: 'clipboard',
    rows: [
      ['⌘ c / ⌘ x', 'copy / cut selection'],
      ['⌘ v', 'paste at playhead'],
    ],
  },
  {
    heading: 'animation',
    rows: [
      ['◆ on a slider', 'add keyframe at playhead'],
      ['click empty prop lane', 'insert keyframe at click time'],
      ['drag a diamond', 'move keyframe (snap-aware)'],
      ['click a diamond', 'edit value / easing / delete'],
    ],
  },
  {
    heading: 'audio',
    rows: [
      ['sound: button', 'toggle scene audio'],
      ['add modifier', 'sound:beep-low / beep-high'],
      ['', 'click / blip / swish / chime'],
    ],
  },
  {
    heading: 'help',
    rows: [['?', 'toggle this overlay']],
  },
];

type HelpOverlayProps = { onClose: () => void };

function HelpOverlay({ onClose }: HelpOverlayProps) {
  return (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className="help-overlay__panel" onClick={(event) => event.stopPropagation()}>
        <header>
          <strong>shortcuts</strong>
          <button type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="help-overlay__body">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.heading}>
              <h3>{group.heading}</h3>
              <dl>
                {group.rows.map(([key, description]) => (
                  <div key={key}>
                    <dt>
                      <kbd>{key}</kbd>
                    </dt>
                    <dd>{description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function ViewportLock() {
  return (
    <main className="viewport-lock" aria-label="Phosphor requires a larger viewport">
      <div className="viewport-lock__panel">
        <h1>
          <span className="brand__mark" aria-hidden="true" />
          PHOSPHOR
        </h1>
        <p className="viewport-lock__lede">Studio is desktop-first.</p>
        <p>Open this on a viewport at least 760 × 520 (most laptops and tablets in landscape).</p>
        <p>
          To watch a shared scene on this device, open a Phosphor loop URL — it works at any size:
        </p>
        <code>termin-peach.vercel.app/play.html#play=...</code>
      </div>
    </main>
  );
}

function parseHashView(): AppView {
  const hash = window.location.hash.replace('#', '');
  return NAV_ITEMS.some((item) => item.view === hash) ? (hash as AppView) : 'author';
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function truncateEmail(email: string): string {
  if (email.length <= 22) return email;
  const [local, domain] = email.split('@');
  if (!domain) return `${email.slice(0, 19)}…`;
  return `${local.slice(0, 8)}…@${domain.slice(0, 10)}`;
}

function triggerProjectDownload(bytes: Uint8Array, filename: string) {
  if (typeof window === 'undefined') return;
  // Copy into a fresh ArrayBuffer-backed view to satisfy the BlobPart
  // signature, which requires ArrayBuffer (not ArrayBufferLike).
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: PROJECT_FILE_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadLayoutDim(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(`phosphor:layout:${key}`);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
}

function saveLayoutDim(key: string, value: number): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`phosphor:layout:${key}`, String(Math.round(value)));
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
    counter: '0',
  };
  return glyphs[name] ?? '?';
}

