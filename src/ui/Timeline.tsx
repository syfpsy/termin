import { Eye, EyeOff, Flag, History, Lock, Plus, Redo2, ShipWheel, Trash2, Undo2, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { estimateEventDuration, eventTone } from '../engine/dsl';
import { inferDisplayDuration, isResizable, type FlagName } from '../engine/dslEdit';
import type { ParsedScene, SceneEvent, SceneMarker, TickRate, ToneName } from '../engine/types';
import { Button, Panel } from './components';

const ADDABLE_EFFECTS: Array<{ value: string; label: string; category: string }> = [
  { value: 'type', label: 'type', category: 'glyph' },
  { value: 'reveal', label: 'reveal', category: 'glyph' },
  { value: 'cursor', label: 'cursor', category: 'glyph' },
  { value: 'pulse', label: 'pulse', category: 'tone' },
  { value: 'glitch', label: 'glitch', category: 'fault' },
  { value: 'flash', label: 'flash', category: 'fault' },
  { value: 'shake', label: 'shake', category: 'fault' },
  { value: 'scan-line', label: 'scan-line', category: 'sweep' },
  { value: 'wave', label: 'wave', category: 'sweep' },
  { value: 'wipe', label: 'wipe', category: 'sweep' },
  { value: 'dither', label: 'dither', category: 'pattern' },
  { value: 'decay-trail', label: 'decay-trail', category: 'pattern' },
  { value: 'loop', label: 'loop', category: 'meta' },
];

const TONE_CHOICES: ToneName[] = ['phos', 'amber', 'green', 'red', 'cyan', 'magenta'];

const TONE_HEX_PREVIEW: Record<ToneName, string> = {
  phos: '#D6F04A',
  phosDim: '#8aa028',
  amber: '#FFA94B',
  amberDim: '#a86a2a',
  green: '#7FE093',
  red: '#FF6B6B',
  cyan: '#7FE3E0',
  magenta: '#E77FD9',
  ink: '#CDDDA0',
  inkDim: '#7A8F56',
  inkMuted: '#7e8d56',
  inkFaint: '#2f3a22',
  ink2: '#FFC985',
};

type TimelineUnits = 'frame' | 'ms';

type TimelineProps = {
  scene: ParsedScene;
  tick: number;
  rate: TickRate;
  units: TimelineUnits;
  selectedEventIds: Set<string>;
  rippleEdit: boolean;
  onionSkin: boolean;
  loopRegion: { startMs: number; endMs: number } | null;
  canUndo: boolean;
  canRedo: boolean;
  past: string[];
  future: string[];
  onScrub: (tick: number) => void;
  onUnitsChange: (units: TimelineUnits) => void;
  onRippleChange: (value: boolean) => void;
  onOnionSkinChange: (value: boolean) => void;
  onLoopRegionChange: (region: { startMs: number; endMs: number } | null) => void;
  onSelectOne: (id: string | null) => void;
  onSelectMany: (ids: string[], replace?: boolean) => void;
  onToggleSelection: (id: string) => void;
  onMoveEvent: (event: SceneEvent, atMs: number) => void;
  onMoveEvents: (events: SceneEvent[], deltaMs: number) => void;
  onResizeEvent: (event: SceneEvent, durationMs: number) => void;
  onDeleteEvent: (event: SceneEvent) => void;
  onDeleteEvents: (events: SceneEvent[]) => void;
  onPatchEvent: (
    event: SceneEvent,
    patch: Partial<{ atMs: number; effect: string; target: string; modifiers: string }>,
  ) => void;
  onAddEventAt: (atMs: number, effect: string) => void;
  onSplitEvent: (event: SceneEvent, atMs: number) => void;
  onSetEventFlag: (event: SceneEvent, flag: FlagName, value: boolean) => void;
  onAddMarker: (name: string, atMs: number) => void;
  onRemoveMarker: (marker: SceneMarker) => void;
  onCopySelection: () => void;
  onCutSelection: () => void;
  onPasteAt: (atMs: number) => Promise<void> | void;
  onRescaleSelection: (toStartMs: number, toEndMs: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onJumpToHistory: (stepsBack: number) => void;
};

type DragKind = 'move' | 'resize' | 'group-move';

type DragState = {
  kind: DragKind;
  primaryEventId: string;
  startClientX: number;
  startAtMs: number;
  startDurationMs: number;
  laneWidthPx: number;
  previewAtMs: number;
  previewDurationMs: number;
  groupDeltaMs: number;
  snapTargetMs: number | null;
};

type MarqueeState = {
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
};

const MIN_RESIZE_MS = 40;
const SNAP_THRESHOLD_PX = 6;

export function Timeline(props: TimelineProps) {
  const {
    scene,
    tick,
    rate,
    units,
    selectedEventIds,
    rippleEdit,
    onionSkin,
    loopRegion,
    canUndo,
    canRedo,
    past,
    future,
    onScrub,
    onUnitsChange,
    onRippleChange,
    onOnionSkinChange,
    onLoopRegionChange,
    onSelectOne,
    onSelectMany,
    onToggleSelection,
    onMoveEvent,
    onMoveEvents,
    onResizeEvent,
    onAddEventAt,
    onSplitEvent,
    onSetEventFlag,
    onAddMarker,
    onRemoveMarker,
    onCopySelection,
    onCutSelection,
    onPasteAt,
    onRescaleSelection,
    onPatchEvent,
    onDeleteEvent,
    onDeleteEvents,
    onUndo,
    onRedo,
    onJumpToHistory,
  } = props;

  const durationTicks = Math.max(1, Math.ceil((scene.duration / 1000) * rate));
  const playhead = (tick / durationTicks) * 100;
  const playheadMs = Math.round((tick / rate) * 1000);
  const divisions = useMemo(
    () => Array.from({ length: Math.floor(durationTicks / 6) + 1 }, (_, index) => index * 6),
    [durationTicks],
  );

  const [drag, setDrag] = useState<DragState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [adderAt, setAdderAt] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const tracksRef = useRef<HTMLDivElement | null>(null);

  const selectedEvent = useMemo(() => {
    if (selectedEventIds.size === 0) return null;
    return scene.events.find((event) => selectedEventIds.has(event.id)) ?? null;
  }, [scene.events, selectedEventIds]);
  const selectedEvents = useMemo(
    () => scene.events.filter((event) => selectedEventIds.has(event.id)),
    [scene.events, selectedEventIds],
  );

  // Snap targets: other event starts/ends, markers, scene bounds, playhead
  const snapTargets = useMemo(() => {
    const targets: number[] = [0, scene.duration, playheadMs];
    for (const event of scene.events) {
      targets.push(event.at);
      targets.push(event.at + inferDisplayDuration(event, rate));
    }
    for (const marker of scene.markers) targets.push(marker.at);
    if (loopRegion) {
      targets.push(loopRegion.startMs, loopRegion.endMs);
    }
    return targets;
  }, [scene.events, scene.duration, scene.markers, playheadMs, rate, loopRegion]);

  function snap(atMs: number, laneWidthPx: number): { value: number; matched: number | null } {
    const thresholdMs = (SNAP_THRESHOLD_PX / Math.max(1, laneWidthPx)) * scene.duration;
    let best: number | null = null;
    let bestDelta = thresholdMs;
    for (const target of snapTargets) {
      const delta = Math.abs(atMs - target);
      if (delta < bestDelta) {
        best = target;
        bestDelta = delta;
      }
    }
    return best === null ? { value: atMs, matched: null } : { value: best, matched: best };
  }

  // Pointer drag
  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      const deltaPx = event.clientX - drag.startClientX;
      const deltaMs = (deltaPx / Math.max(1, drag.laneWidthPx)) * scene.duration;
      if (drag.kind === 'move') {
        const proposed = Math.max(0, Math.min(scene.duration, drag.startAtMs + deltaMs));
        const snapped = snap(proposed, drag.laneWidthPx);
        setDrag({ ...drag, previewAtMs: snapped.value, snapTargetMs: snapped.matched });
      } else if (drag.kind === 'resize') {
        const next = Math.max(MIN_RESIZE_MS, drag.startDurationMs + deltaMs);
        const proposedEnd = drag.startAtMs + next;
        const snapped = snap(proposedEnd, drag.laneWidthPx);
        const targetEnd = snapped.matched ?? proposedEnd;
        setDrag({
          ...drag,
          previewDurationMs: Math.max(MIN_RESIZE_MS, targetEnd - drag.startAtMs),
          snapTargetMs: snapped.matched,
        });
      } else if (drag.kind === 'group-move') {
        const proposed = drag.startAtMs + deltaMs;
        const snapped = snap(proposed, drag.laneWidthPx);
        const groupDelta = snapped.value - drag.startAtMs;
        setDrag({ ...drag, groupDeltaMs: groupDelta, snapTargetMs: snapped.matched });
      }
    };
    const onUp = () => {
      const target = scene.events.find((event) => event.id === drag.primaryEventId);
      if (target) {
        if (drag.kind === 'move' && drag.previewAtMs !== drag.startAtMs) {
          onMoveEvent(target, drag.previewAtMs);
        }
        if (drag.kind === 'resize' && drag.previewDurationMs !== drag.startDurationMs) {
          onResizeEvent(target, drag.previewDurationMs);
        }
        if (drag.kind === 'group-move' && drag.groupDeltaMs !== 0) {
          onMoveEvents(selectedEvents, drag.groupDeltaMs);
        }
      }
      setDrag(null);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [drag, onMoveEvent, onMoveEvents, onResizeEvent, scene.duration, scene.events, selectedEvents, snap]);

  // Marquee drag (box-select)
  useEffect(() => {
    if (!marquee) return;
    const onMove = (event: PointerEvent) => {
      setMarquee({
        ...marquee,
        currentClientX: event.clientX,
        currentClientY: event.clientY,
      });
    };
    const onUp = () => {
      const tracks = tracksRef.current;
      if (!tracks) {
        setMarquee(null);
        return;
      }
      const tracksRect = tracks.getBoundingClientRect();
      const x1 = Math.min(marquee.startClientX, marquee.currentClientX);
      const x2 = Math.max(marquee.startClientX, marquee.currentClientX);
      const y1 = Math.min(marquee.startClientY, marquee.currentClientY);
      const y2 = Math.max(marquee.startClientY, marquee.currentClientY);
      const ids: string[] = [];
      for (const row of tracks.querySelectorAll<HTMLElement>('[data-event-id]')) {
        const bar = row.querySelector<HTMLElement>('.timeline__bar');
        if (!bar) continue;
        const rect = bar.getBoundingClientRect();
        if (rect.right < x1 || rect.left > x2) continue;
        if (rect.bottom < y1 || rect.top > y2) continue;
        const id = row.dataset.eventId;
        if (id) ids.push(id);
      }
      if (ids.length > 0) onSelectMany(ids, true);
      else if (Math.abs(marquee.currentClientX - marquee.startClientX) > 4) onSelectOne(null);
      setMarquee(null);
      void tracksRect;
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [marquee, onSelectMany, onSelectOne]);

  function startDrag(kind: DragKind, event: SceneEvent, pointerEvent: React.PointerEvent) {
    if (event.flags.locked) return;
    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();
    const lane = (pointerEvent.currentTarget as HTMLElement).closest('.timeline__lane') as HTMLElement | null;
    const laneWidth = lane?.getBoundingClientRect().width ?? 1;
    const isGroup = kind === 'move' && selectedEventIds.has(event.id) && selectedEventIds.size > 1;

    setDrag({
      kind: isGroup ? 'group-move' : kind,
      primaryEventId: event.id,
      startClientX: pointerEvent.clientX,
      startAtMs: event.at,
      startDurationMs: inferDisplayDuration(event, rate),
      laneWidthPx: laneWidth,
      previewAtMs: event.at,
      previewDurationMs: inferDisplayDuration(event, rate),
      groupDeltaMs: 0,
      snapTargetMs: null,
    });
    if (!selectedEventIds.has(event.id)) onSelectOne(event.id);
  }

  function handleLanePointerDown(pointerEvent: React.PointerEvent<HTMLDivElement>) {
    if (drag) return;
    const target = pointerEvent.target as HTMLElement;
    if (target.closest('.timeline__bar, .timeline__resize')) return;
    pointerEvent.stopPropagation();
    const lane = pointerEvent.currentTarget;
    const rect = lane.getBoundingClientRect();
    const ratio = (pointerEvent.clientX - rect.left) / Math.max(1, rect.width);
    const ms = clampMs(ratio * scene.duration, 0, scene.duration);
    setAdderAt(ms);
  }

  function handleTracksPointerDown(pointerEvent: React.PointerEvent<HTMLDivElement>) {
    const target = pointerEvent.target as HTMLElement;
    if (target.closest('.timeline__bar, .timeline__resize, .timeline__lane')) return;
    if (target.closest('button, input, select, textarea')) return;
    setMarquee({
      startClientX: pointerEvent.clientX,
      startClientY: pointerEvent.clientY,
      currentClientX: pointerEvent.clientX,
      currentClientY: pointerEvent.clientY,
    });
  }

  function commitAdd(effect: string) {
    if (adderAt === null) return;
    onAddEventAt(adderAt, effect);
    setAdderAt(null);
  }

  function handleEventPointerDown(event: SceneEvent, pointerEvent: React.PointerEvent) {
    if (pointerEvent.shiftKey || pointerEvent.metaKey || pointerEvent.ctrlKey) {
      pointerEvent.stopPropagation();
      onToggleSelection(event.id);
      return;
    }
    startDrag('move', event, pointerEvent);
  }

  const totalSeconds = scene.duration / 1000;
  const playbackHint = loopRegion
    ? `loop ${(loopRegion.startMs / 1000).toFixed(2)}s → ${(loopRegion.endMs / 1000).toFixed(2)}s`
    : `${rate} Hz · ${durationTicks} ticks · ${totalSeconds.toFixed(2)}s`;

  return (
    <Panel
      title="TIMELINE"
      flags={`${playbackHint}${scene.events.length ? ` · ${scene.events.length} events` : ''}${
        scene.markers.length ? ` · ${scene.markers.length} marks` : ''
      }${selectedEvents.length > 1 ? ` · ${selectedEvents.length} selected` : ''}`}
      flush
      className="timeline-panel"
      tools={
        <>
          <Button aria-label="Undo" icon={<Undo2 size={12} />} disabled={!canUndo} onClick={onUndo} />
          <Button aria-label="Redo" icon={<Redo2 size={12} />} disabled={!canRedo} onClick={onRedo} />
          <Button
            aria-label="History"
            icon={<History size={12} />}
            active={historyOpen}
            onClick={() => setHistoryOpen((value) => !value)}
          />
          <Button
            icon={<Plus size={12} />}
            aria-label="Add event at playhead"
            onClick={() => setAdderAt(playheadMs)}
          >
            add
          </Button>
          <Button
            aria-label="Drop marker at playhead"
            icon={<Flag size={12} />}
            onClick={() => onAddMarker(`mark ${scene.markers.length + 1}`, playheadMs)}
          >
            mark
          </Button>
          <Button
            aria-label="Toggle ripple edit"
            icon={<ShipWheel size={12} />}
            active={rippleEdit}
            onClick={() => onRippleChange(!rippleEdit)}
            kbd={rippleEdit ? 'on' : 'off'}
          >
            ripple
          </Button>
          <Button
            aria-label="Toggle onion skin"
            icon={onionSkin ? <Eye size={12} /> : <EyeOff size={12} />}
            active={onionSkin}
            onClick={() => onOnionSkinChange(!onionSkin)}
          >
            onion
          </Button>
          <Button active={units === 'frame'} onClick={() => onUnitsChange('frame')}>
            frame
          </Button>
          <Button active={units === 'ms'} onClick={() => onUnitsChange('ms')}>
            ms
          </Button>
        </>
      }
    >
      <div className="timeline">
        <div className="timeline__ruler">
          <div className="timeline__track-head">
            track
            {loopRegion && (
              <button
                type="button"
                className="timeline__loop-clear"
                onClick={() => onLoopRegionChange(null)}
                aria-label="Clear loop region"
                title="Clear loop region"
              >
                clear loop
              </button>
            )}
          </div>
          <div
            className="timeline__ticks"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('.timeline__tick, .timeline__marker, .timeline__loop-handle')) return;
              if (!e.altKey && !e.shiftKey) return;
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              const startMs = clampMs(ratio * scene.duration, 0, scene.duration);
              const onMove = (move: PointerEvent) => {
                const r = e.currentTarget.getBoundingClientRect();
                const ratio2 = (move.clientX - r.left) / r.width;
                const endMs = clampMs(ratio2 * scene.duration, 0, scene.duration);
                onLoopRegionChange({
                  startMs: Math.min(startMs, endMs),
                  endMs: Math.max(startMs + 100, Math.max(startMs, endMs)),
                });
              };
              const onUp = () => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
              };
              document.addEventListener('pointermove', onMove);
              document.addEventListener('pointerup', onUp);
            }}
          >
            {divisions.map((division) => (
              <button
                key={division}
                className="timeline__tick"
                style={{ left: `${(division / durationTicks) * 100}%` }}
                onClick={(event) => {
                  event.stopPropagation();
                  onScrub(division);
                }}
              >
                {formatRulerLabel(division, rate, units)}
              </button>
            ))}
            {scene.markers.map((marker) => (
              <button
                key={marker.id}
                className="timeline__marker"
                style={{ left: `${(marker.at / scene.duration) * 100}%` }}
                title={`${marker.name} · ${marker.at}ms`}
                onClick={(event) => {
                  event.stopPropagation();
                  onScrub(Math.floor((marker.at / 1000) * rate));
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onRemoveMarker(marker);
                }}
              >
                <span className="timeline__marker-flag" aria-hidden="true" />
                <span className="timeline__marker-label">{marker.name}</span>
              </button>
            ))}
            {loopRegion && (
              <span
                className="timeline__loop-region"
                style={{
                  left: `${(loopRegion.startMs / scene.duration) * 100}%`,
                  width: `${((loopRegion.endMs - loopRegion.startMs) / scene.duration) * 100}%`,
                }}
                aria-hidden="true"
              />
            )}
            <div className="timeline__playhead" style={{ left: `${playhead}%` }} aria-hidden="true" />
          </div>
        </div>

        <div
          className="timeline__tracks"
          ref={tracksRef}
          onPointerDown={handleTracksPointerDown}
          onClick={(event) => {
            // bare click on the tracks (not a row/bar/lane) clears selection
            if ((event.target as HTMLElement).closest('.timeline__row')) return;
            onSelectOne(null);
          }}
        >
          {scene.events.map((event) => {
            const isPrimary = drag?.primaryEventId === event.id;
            const liveAt =
              drag?.kind === 'group-move' && selectedEventIds.has(event.id)
                ? clampMs(event.at + drag.groupDeltaMs, 0, scene.duration)
                : isPrimary && drag.kind === 'move'
                  ? drag.previewAtMs
                  : event.at;
            const liveDuration =
              isPrimary && drag.kind === 'resize'
                ? drag.previewDurationMs
                : inferDisplayDuration(event, rate);
            const start = (liveAt / scene.duration) * 100;
            const length = (liveDuration / scene.duration) * 100;
            const tone = eventTone(event);
            const selected = selectedEventIds.has(event.id);
            const resizable = isResizable(event.effect) && !event.flags.locked;
            const dragging = isPrimary || (drag?.kind === 'group-move' && selected);

            return (
              <div
                key={event.id}
                className={`timeline__row ${selected ? 'timeline__row--selected' : ''} ${event.flags.muted ? 'timeline__row--muted' : ''} ${event.flags.locked ? 'timeline__row--locked' : ''} ${event.flags.solo ? 'timeline__row--solo' : ''}`}
                data-event-id={event.id}
              >
                <span className="timeline__row-flags">
                  <button
                    type="button"
                    className="timeline__flag-btn"
                    aria-label={event.flags.muted ? `Unmute ${event.effect}` : `Mute ${event.effect}`}
                    aria-pressed={event.flags.muted}
                    title={event.flags.muted ? 'Muted' : 'Mute'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetEventFlag(event, 'muted', !event.flags.muted);
                    }}
                  >
                    {event.flags.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                  </button>
                  <button
                    type="button"
                    className="timeline__flag-btn"
                    aria-label={event.flags.solo ? `Unsolo ${event.effect}` : `Solo ${event.effect}`}
                    aria-pressed={event.flags.solo}
                    data-active={event.flags.solo}
                    title={event.flags.solo ? 'Solo' : 'Solo (hide others)'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetEventFlag(event, 'solo', !event.flags.solo);
                    }}
                  >
                    S
                  </button>
                  <button
                    type="button"
                    className="timeline__flag-btn"
                    aria-label={event.flags.locked ? `Unlock ${event.effect}` : `Lock ${event.effect}`}
                    aria-pressed={event.flags.locked}
                    data-active={event.flags.locked}
                    title={event.flags.locked ? 'Locked' : 'Lock'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetEventFlag(event, 'locked', !event.flags.locked);
                    }}
                  >
                    <Lock size={11} />
                  </button>
                </span>
                <span className="timeline__name" title={event.target || event.effect}>
                  {event.target || event.effect}
                </span>
                <span className="timeline__effect" data-tone={tone}>
                  {event.effect}
                </span>
                <div className="timeline__lane" onPointerDown={handleLanePointerDown} role="presentation">
                  <span
                    className={`timeline__bar ${dragging ? 'timeline__bar--dragging' : ''}`}
                    data-tone={tone}
                    style={{ left: `${start}%`, width: `${Math.max(1.2, length)}%` }}
                    onPointerDown={(pointerEvent) => handleEventPointerDown(event, pointerEvent)}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      if (clickEvent.shiftKey || clickEvent.metaKey || clickEvent.ctrlKey) return;
                      onSelectOne(event.id);
                      onScrub(Math.floor((event.at / 1000) * rate));
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${event.effect} at ${event.at}ms${event.target ? `, target ${event.target}` : ''}${event.flags.muted ? ', muted' : ''}${event.flags.locked ? ', locked' : ''}`}
                    aria-pressed={selected}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                        keyEvent.preventDefault();
                        onSelectOne(event.id);
                      }
                    }}
                  />
                  <span className="timeline__key" style={{ left: `${start}%` }} aria-hidden="true" />
                  <span
                    className="timeline__key"
                    style={{ left: `${Math.min(100, start + Math.max(1.2, length))}%` }}
                    aria-hidden="true"
                  />
                  {resizable && (
                    <span
                      className="timeline__resize"
                      style={{ left: `${Math.min(100, start + Math.max(1.2, length))}%` }}
                      onPointerDown={(pointerEvent) => startDrag('resize', event, pointerEvent)}
                      role="slider"
                      aria-label={`Resize ${event.effect} duration`}
                      aria-valuenow={Math.round(liveDuration)}
                      aria-valuemin={MIN_RESIZE_MS}
                      aria-valuemax={Math.round(scene.duration)}
                      tabIndex={0}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {drag?.snapTargetMs !== null && drag?.snapTargetMs !== undefined && (
            <div
              className="timeline__snap-guide"
              style={{ left: `calc(170px + (100% - 170px) * ${(drag.snapTargetMs / scene.duration)})` }}
              aria-hidden="true"
            />
          )}
          {marquee && (
            <Marquee state={marquee} containerRef={tracksRef} />
          )}
          <div
            className="timeline__global-playhead"
            style={{ left: `calc(170px + (100% - 170px) * ${playhead / 100})` }}
            aria-hidden="true"
          />
        </div>
      </div>

      {selectedEvent && (
        <EventEditor
          event={selectedEvent}
          rate={rate}
          sceneDuration={scene.duration}
          playheadMs={playheadMs}
          selectionCount={selectedEvents.length}
          onPatchEvent={onPatchEvent}
          onDeleteEvent={onDeleteEvent}
          onDeleteSelection={() => onDeleteEvents(selectedEvents)}
          onCopySelection={onCopySelection}
          onCutSelection={onCutSelection}
          onPasteAt={onPasteAt}
          onSplitEvent={onSplitEvent}
          onRescaleSelection={onRescaleSelection}
          selectedEvents={selectedEvents}
          onClose={() => onSelectOne(null)}
        />
      )}

      {adderAt !== null && (
        <EffectPicker atMs={adderAt} onPick={commitAdd} onCancel={() => setAdderAt(null)} />
      )}

      {historyOpen && (
        <HistoryPanel
          past={past}
          future={future}
          onJumpBack={(steps) => onJumpToHistory(steps)}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </Panel>
  );
}

type MarqueeProps = {
  state: MarqueeState;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
};

function Marquee({ state, containerRef }: MarqueeProps) {
  const container = containerRef.current;
  if (!container) return null;
  const rect = container.getBoundingClientRect();
  const left = Math.min(state.startClientX, state.currentClientX) - rect.left;
  const top = Math.min(state.startClientY, state.currentClientY) - rect.top;
  const width = Math.abs(state.currentClientX - state.startClientX);
  const height = Math.abs(state.currentClientY - state.startClientY);
  if (width < 3 && height < 3) return null;
  return (
    <div
      className="timeline__marquee"
      style={{ left, top, width, height }}
      aria-hidden="true"
    />
  );
}

type EventEditorProps = {
  event: SceneEvent;
  rate: TickRate;
  sceneDuration: number;
  playheadMs: number;
  selectionCount: number;
  selectedEvents: SceneEvent[];
  onPatchEvent: (
    event: SceneEvent,
    patch: Partial<{ atMs: number; effect: string; target: string; modifiers: string }>,
  ) => void;
  onDeleteEvent: (event: SceneEvent) => void;
  onDeleteSelection: () => void;
  onCopySelection: () => void;
  onCutSelection: () => void;
  onPasteAt: (atMs: number) => Promise<void> | void;
  onSplitEvent: (event: SceneEvent, atMs: number) => void;
  onRescaleSelection: (toStartMs: number, toEndMs: number) => void;
  onClose: () => void;
};

function EventEditor({
  event,
  rate,
  sceneDuration,
  playheadMs,
  selectionCount,
  selectedEvents,
  onPatchEvent,
  onDeleteEvent,
  onDeleteSelection,
  onCopySelection,
  onCutSelection,
  onPasteAt,
  onSplitEvent,
  onRescaleSelection,
  onClose,
}: EventEditorProps) {
  const [effect, setEffect] = useState(event.effect);
  const [target, setTarget] = useState(event.target);
  const [modifiers, setModifiers] = useState(event.modifiers);
  const [atMs, setAtMs] = useState(event.at);
  const formId = useId();

  useEffect(() => {
    setEffect(event.effect);
    setTarget(event.target);
    setModifiers(event.modifiers);
    setAtMs(event.at);
  }, [event.id, event.effect, event.target, event.modifiers, event.at]);

  const dirty =
    effect !== event.effect ||
    target !== event.target ||
    modifiers !== event.modifiers ||
    atMs !== event.at;

  const commit = useCallback(() => {
    if (!dirty) return;
    onPatchEvent(event, { effect, target, modifiers, atMs });
  }, [atMs, dirty, effect, event, modifiers, onPatchEvent, target]);

  function setTone(tone: ToneName) {
    const tokens = modifiers.split(/\s+/).filter(Boolean);
    const cleaned = tokens.filter((token) => !TONE_CHOICES.includes(token as ToneName));
    const next = [...cleaned, tone === 'phos' ? '' : tone].filter(Boolean).join(' ');
    setModifiers(next);
  }

  const detectedTone = TONE_CHOICES.find((tone) => modifiers.includes(tone)) ?? 'phos';

  return (
    <form
      className="timeline-editor"
      aria-label="Edit selected event"
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <div className="timeline-editor__row">
        <label htmlFor={`${formId}-effect`}>effect</label>
        <select id={`${formId}-effect`} value={effect} onChange={(e) => setEffect(e.target.value)}>
          {ADDABLE_EFFECTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          {!ADDABLE_EFFECTS.some((option) => option.value === effect) && (
            <option value={effect}>{effect}</option>
          )}
        </select>

        <label htmlFor={`${formId}-time`}>at (ms)</label>
        <ScrubInput
          id={`${formId}-time`}
          value={atMs}
          min={0}
          max={sceneDuration}
          step={Math.round(1000 / rate)}
          onChange={setAtMs}
          onCommit={commit}
        />
      </div>

      <div className="timeline-editor__row">
        <label htmlFor={`${formId}-target`}>target</label>
        <input
          id={`${formId}-target`}
          type="text"
          value={target}
          spellCheck={false}
          onChange={(e) => setTarget(e.target.value)}
          onBlur={commit}
        />
      </div>

      <div className="timeline-editor__row">
        <label>tone</label>
        <div className="timeline-editor__tones" role="radiogroup" aria-label="Tone">
          {TONE_CHOICES.map((tone) => (
            <button
              key={tone}
              type="button"
              role="radio"
              aria-checked={detectedTone === tone}
              className="timeline-editor__tone"
              data-active={detectedTone === tone}
              style={{ backgroundColor: TONE_HEX_PREVIEW[tone] }}
              title={tone}
              onClick={() => {
                setTone(tone);
              }}
              onBlur={commit}
            />
          ))}
        </div>
      </div>

      <div className="timeline-editor__row">
        <label htmlFor={`${formId}-modifiers`}>modifiers</label>
        <input
          id={`${formId}-modifiers`}
          type="text"
          value={modifiers}
          spellCheck={false}
          placeholder="amber 600ms"
          onChange={(e) => setModifiers(e.target.value)}
          onBlur={commit}
        />
      </div>

      <div className="timeline-editor__actions">
        <Button type="submit" tone="prim" disabled={!dirty}>
          apply
        </Button>
        {selectionCount > 1 ? (
          <>
            <Button type="button" icon={<Trash2 size={12} />} onClick={onDeleteSelection}>
              delete {selectionCount}
            </Button>
            <Button
              type="button"
              onClick={() => {
                const fromStart = selectedEvents.reduce((m, e) => Math.min(m, e.at), Number.POSITIVE_INFINITY);
                const fromEnd = selectedEvents.reduce((m, e) => Math.max(m, e.at), 0);
                if (fromEnd <= fromStart) return;
                const span = fromEnd - fromStart;
                const stretched = Math.round(span * 1.5);
                onRescaleSelection(fromStart, fromStart + stretched);
              }}
            >
              stretch ×1.5
            </Button>
            <Button
              type="button"
              onClick={() => {
                const fromStart = selectedEvents.reduce((m, e) => Math.min(m, e.at), Number.POSITIVE_INFINITY);
                const fromEnd = selectedEvents.reduce((m, e) => Math.max(m, e.at), 0);
                if (fromEnd <= fromStart) return;
                const span = fromEnd - fromStart;
                const compressed = Math.max(40, Math.round(span * 0.75));
                onRescaleSelection(fromStart, fromStart + compressed);
              }}
            >
              compress ×0.75
            </Button>
          </>
        ) : (
          <>
            <Button type="button" icon={<Trash2 size={12} />} onClick={() => onDeleteEvent(event)}>
              delete
            </Button>
            {isResizable(event.effect) && (
              <Button
                type="button"
                onClick={() => onSplitEvent(event, playheadMs)}
                disabled={playheadMs <= event.at || playheadMs >= event.at + inferDisplayDuration(event, rate)}
              >
                split @ playhead
              </Button>
            )}
          </>
        )}
        <Button type="button" onClick={onCopySelection}>
          copy
        </Button>
        <Button type="button" onClick={onCutSelection}>
          cut
        </Button>
        <Button type="button" onClick={() => void onPasteAt(playheadMs)}>
          paste
        </Button>
        <span className="timeline-editor__hint">
          {selectionCount > 1 ? `${selectionCount} selected` : `line ${event.line}`} · {Math.round(estimateEventDuration(event, rate))}ms
        </span>
        <Button type="button" onClick={onClose}>
          close
        </Button>
      </div>
    </form>
  );
}

type ScrubInputProps = {
  id?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onCommit: () => void;
};

function ScrubInput({ id, value, min, max, step, onChange, onCommit }: ScrubInputProps) {
  const dragRef = useRef<{ startX: number; startValue: number } | null>(null);

  function onPointerDown(event: React.PointerEvent<HTMLInputElement>) {
    if (event.button !== 0) return;
    if (document.activeElement === event.currentTarget) return;
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startValue: value };
    (event.currentTarget as HTMLInputElement).setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: React.PointerEvent<HTMLInputElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const factor = event.shiftKey ? 10 : event.metaKey || event.ctrlKey ? 0.1 : 1;
    const next = Math.max(min, Math.min(max, drag.startValue + dx * step * factor));
    onChange(Math.round(next / step) * step);
  }
  function onPointerUp(event: React.PointerEvent<HTMLInputElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    try {
      (event.currentTarget as HTMLInputElement).releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    onCommit();
  }

  return (
    <input
      id={id}
      type="number"
      className="scrub-input"
      value={value}
      min={min}
      max={max}
      step={step}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
      onBlur={onCommit}
    />
  );
}

type EffectPickerProps = {
  atMs: number;
  onPick: (effect: string) => void;
  onCancel: () => void;
};

function EffectPicker({ atMs, onPick, onCancel }: EffectPickerProps) {
  const groups = useMemo(() => {
    const map = new Map<string, typeof ADDABLE_EFFECTS>();
    for (const effect of ADDABLE_EFFECTS) {
      const list = map.get(effect.category) ?? [];
      list.push(effect);
      map.set(effect.category, list);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <div
      className="effect-picker"
      role="dialog"
      aria-label="Choose effect to add"
      onClick={(e) => e.stopPropagation()}
    >
      <header>
        <strong>add event</strong>
        <span>at {Math.round(atMs)}ms</span>
        <button type="button" className="effect-picker__close" aria-label="Cancel" onClick={onCancel}>
          ×
        </button>
      </header>
      <div className="effect-picker__groups">
        {groups.map(([category, list]) => (
          <div key={category} className="effect-picker__group">
            <span className="effect-picker__group-label">{category}</span>
            <div className="effect-picker__grid">
              {list.map((effect) => (
                <button key={effect.value} type="button" onClick={() => onPick(effect.value)}>
                  {effect.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type HistoryPanelProps = {
  past: string[];
  future: string[];
  onJumpBack: (steps: number) => void;
  onClose: () => void;
};

function HistoryPanel({ past, future, onJumpBack, onClose }: HistoryPanelProps) {
  return (
    <div className="history-panel" role="dialog" aria-label="History" onClick={(e) => e.stopPropagation()}>
      <header>
        <strong>history</strong>
        <span>{past.length} undo · {future.length} redo</span>
        <button type="button" className="effect-picker__close" aria-label="Close history" onClick={onClose}>
          ×
        </button>
      </header>
      <ol className="history-panel__list">
        {past.length === 0 && <li className="history-panel__empty">no edits yet</li>}
        {past
          .slice()
          .reverse()
          .map((_entry, index) => {
            const stepsBack = index + 1;
            return (
              <li key={index}>
                <button type="button" onClick={() => onJumpBack(stepsBack)}>
                  ← {stepsBack} step{stepsBack === 1 ? '' : 's'} ago
                </button>
              </li>
            );
          })}
      </ol>
    </div>
  );
}

function clampMs(ms: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, ms));
}

function formatRulerLabel(division: number, rate: number, units: TimelineUnits): string {
  if (units === 'ms') {
    const ms = Math.round((division / rate) * 1000);
    return ms % 500 === 0 ? `${ms}ms` : String(ms);
  }
  return division % rate === 0 ? `${(division / rate).toFixed(1)}s` : String(division);
}
