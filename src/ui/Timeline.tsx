import { Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { estimateEventDuration, eventTone } from '../engine/dsl';
import { inferDisplayDuration, isResizable } from '../engine/dslEdit';
import type { ParsedScene, SceneEvent, TickRate } from '../engine/types';
import { Button, Panel } from './components';

const ADDABLE_EFFECTS: Array<{ value: string; label: string }> = [
  { value: 'type', label: 'type' },
  { value: 'cursor', label: 'cursor' },
  { value: 'scan-line', label: 'scan-line' },
  { value: 'glitch', label: 'glitch' },
  { value: 'pulse', label: 'pulse' },
  { value: 'decay-trail', label: 'decay-trail' },
  { value: 'dither', label: 'dither' },
  { value: 'wave', label: 'wave' },
  { value: 'wipe', label: 'wipe' },
  { value: 'loop', label: 'loop' },
  { value: 'shake', label: 'shake' },
  { value: 'flash', label: 'flash' },
  { value: 'reveal', label: 'reveal' },
];

type TimelineUnits = 'frame' | 'ms';

type TimelineProps = {
  scene: ParsedScene;
  tick: number;
  rate: TickRate;
  units: TimelineUnits;
  selectedEventId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onScrub: (tick: number) => void;
  onUnitsChange: (units: TimelineUnits) => void;
  onSelect: (id: string | null) => void;
  onMoveEvent: (event: SceneEvent, atMs: number) => void;
  onResizeEvent: (event: SceneEvent, durationMs: number) => void;
  onDeleteEvent: (event: SceneEvent) => void;
  onPatchEvent: (
    event: SceneEvent,
    patch: Partial<{ atMs: number; effect: string; target: string; modifiers: string }>,
  ) => void;
  onAddEventAt: (atMs: number, effect: string) => void;
  onUndo: () => void;
  onRedo: () => void;
};

type DragKind = 'move' | 'resize';

type DragState = {
  kind: DragKind;
  eventId: string;
  startClientX: number;
  startAtMs: number;
  startDurationMs: number;
  laneWidthPx: number;
  previewAtMs: number;
  previewDurationMs: number;
};

const MIN_RESIZE_MS = 40;

export function Timeline({
  scene,
  tick,
  rate,
  units,
  selectedEventId,
  canUndo,
  canRedo,
  onScrub,
  onUnitsChange,
  onSelect,
  onMoveEvent,
  onResizeEvent,
  onDeleteEvent,
  onPatchEvent,
  onAddEventAt,
  onUndo,
  onRedo,
}: TimelineProps) {
  const durationTicks = Math.max(1, Math.ceil((scene.duration / 1000) * rate));
  const playhead = (tick / durationTicks) * 100;
  const divisions = useMemo(
    () => Array.from({ length: Math.floor(durationTicks / 6) + 1 }, (_, index) => index * 6),
    [durationTicks],
  );
  const [drag, setDrag] = useState<DragState | null>(null);
  const [adderAt, setAdderAt] = useState<number | null>(null);

  const selectedEvent = useMemo(
    () => scene.events.find((event) => event.id === selectedEventId) ?? null,
    [scene.events, selectedEventId],
  );

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      const deltaPx = event.clientX - drag.startClientX;
      const deltaMs = (deltaPx / Math.max(1, drag.laneWidthPx)) * scene.duration;
      if (drag.kind === 'move') {
        const next = clampMs(drag.startAtMs + deltaMs, 0, scene.duration);
        setDrag({ ...drag, previewAtMs: next });
      } else {
        const next = Math.max(MIN_RESIZE_MS, drag.startDurationMs + deltaMs);
        setDrag({ ...drag, previewDurationMs: next });
      }
    };
    const onUp = () => {
      const target = scene.events.find((event) => event.id === drag.eventId);
      if (target) {
        if (drag.kind === 'move' && drag.previewAtMs !== drag.startAtMs) {
          onMoveEvent(target, drag.previewAtMs);
        }
        if (drag.kind === 'resize' && drag.previewDurationMs !== drag.startDurationMs) {
          onResizeEvent(target, drag.previewDurationMs);
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
  }, [drag, onMoveEvent, onResizeEvent, scene.duration, scene.events]);

  function startDrag(kind: DragKind, event: SceneEvent, pointerEvent: React.PointerEvent) {
    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();
    const lane = (pointerEvent.currentTarget as HTMLElement).closest('.timeline__lane') as HTMLElement | null;
    const laneWidth = lane?.getBoundingClientRect().width ?? 1;
    setDrag({
      kind,
      eventId: event.id,
      startClientX: pointerEvent.clientX,
      startAtMs: event.at,
      startDurationMs: inferDisplayDuration(event, rate),
      laneWidthPx: laneWidth,
      previewAtMs: event.at,
      previewDurationMs: inferDisplayDuration(event, rate),
    });
    onSelect(event.id);
  }

  function handleLaneClick(pointerEvent: React.PointerEvent<HTMLDivElement>) {
    if (drag) return;
    if ((pointerEvent.target as HTMLElement).closest('.timeline__bar, .timeline__resize')) return;
    pointerEvent.stopPropagation();
    const lane = pointerEvent.currentTarget;
    const rect = lane.getBoundingClientRect();
    const ratio = (pointerEvent.clientX - rect.left) / Math.max(1, rect.width);
    const ms = clampMs(ratio * scene.duration, 0, scene.duration);
    setAdderAt(ms);
  }

  function commitAdd(effect: string) {
    if (adderAt === null) return;
    onAddEventAt(adderAt, effect);
    setAdderAt(null);
  }

  return (
    <Panel
      title="TIMELINE"
      flags={`${rate} Hz · ${durationTicks} ticks · ${(scene.duration / 1000).toFixed(2)}s${
        scene.events.length ? ` · ${scene.events.length} events` : ''
      }`}
      flush
      className="timeline-panel"
      tools={
        <>
          <Button
            aria-label="Undo last edit"
            icon={<Undo2 size={12} />}
            disabled={!canUndo}
            onClick={onUndo}
          />
          <Button
            aria-label="Redo last edit"
            icon={<Redo2 size={12} />}
            disabled={!canRedo}
            onClick={onRedo}
          />
          <Button
            icon={<Plus size={12} />}
            aria-label="Add event at playhead"
            onClick={() => setAdderAt(Math.round((tick / rate) * 1000))}
          >
            add
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
      <div className="timeline" onClick={() => onSelect(null)}>
        <div className="timeline__ruler">
          <div className="timeline__track-head">track</div>
          <div className="timeline__ticks">
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
            <div className="timeline__playhead" style={{ left: `${playhead}%` }} aria-hidden="true" />
          </div>
        </div>

        <div className="timeline__tracks">
          {scene.events.map((event) => {
            const dragging = drag?.eventId === event.id;
            const liveAt = dragging && drag.kind === 'move' ? drag.previewAtMs : event.at;
            const liveDuration =
              dragging && drag.kind === 'resize' ? drag.previewDurationMs : inferDisplayDuration(event, rate);
            const start = (liveAt / scene.duration) * 100;
            const length = (liveDuration / scene.duration) * 100;
            const tone = eventTone(event);
            const selected = selectedEventId === event.id;
            const resizable = isResizable(event.effect);

            return (
              <div
                key={event.id}
                className={`timeline__row ${selected ? 'timeline__row--selected' : ''}`}
                data-event-id={event.id}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  onSelect(event.id);
                  onScrub(Math.floor((event.at / 1000) * rate));
                }}
              >
                <span className="timeline__name" title={event.target || event.effect}>
                  {event.target || event.effect}
                </span>
                <span className="timeline__effect" data-tone={tone}>
                  {event.effect}
                </span>
                <div
                  className="timeline__lane"
                  onPointerDown={handleLaneClick}
                  role="presentation"
                >
                  <span
                    className={`timeline__bar ${dragging ? 'timeline__bar--dragging' : ''}`}
                    data-tone={tone}
                    style={{ left: `${start}%`, width: `${Math.max(1.2, length)}%` }}
                    onPointerDown={(pointerEvent) => startDrag('move', event, pointerEvent)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${event.effect} at ${event.at}ms${event.target ? `, target ${event.target}` : ''}`}
                    aria-pressed={selected}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                        keyEvent.preventDefault();
                        onSelect(event.id);
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
          <div className="timeline__global-playhead" style={{ left: `calc(170px + (100% - 170px) * ${playhead / 100})` }} aria-hidden="true" />
        </div>
      </div>

      {selectedEvent && (
        <EventEditor
          event={selectedEvent}
          rate={rate}
          sceneDuration={scene.duration}
          onPatchEvent={onPatchEvent}
          onDeleteEvent={onDeleteEvent}
          onClose={() => onSelect(null)}
        />
      )}

      {adderAt !== null && (
        <EffectPicker
          atMs={adderAt}
          onPick={commitAdd}
          onCancel={() => setAdderAt(null)}
        />
      )}
    </Panel>
  );
}

type EventEditorProps = {
  event: SceneEvent;
  rate: TickRate;
  sceneDuration: number;
  onPatchEvent: (
    event: SceneEvent,
    patch: Partial<{ atMs: number; effect: string; target: string; modifiers: string }>,
  ) => void;
  onDeleteEvent: (event: SceneEvent) => void;
  onClose: () => void;
};

function EventEditor({ event, rate, sceneDuration, onPatchEvent, onDeleteEvent, onClose }: EventEditorProps) {
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

  function commit() {
    if (!dirty) return;
    onPatchEvent(event, { effect, target, modifiers, atMs });
  }

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
        <input
          id={`${formId}-time`}
          type="number"
          min={0}
          max={sceneDuration}
          step={Math.round(1000 / rate)}
          value={atMs}
          onChange={(e) => setAtMs(Number(e.target.value) || 0)}
          onBlur={commit}
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
        <Button
          type="button"
          icon={<Trash2 size={12} />}
          onClick={() => onDeleteEvent(event)}
          aria-label="Delete event"
        >
          delete
        </Button>
        <span className="timeline-editor__hint">
          line {event.line} · {Math.round(estimateEventDuration(event, rate))}ms
        </span>
        <Button type="button" onClick={onClose}>
          close
        </Button>
      </div>
    </form>
  );
}

type EffectPickerProps = {
  atMs: number;
  onPick: (effect: string) => void;
  onCancel: () => void;
};

function EffectPicker({ atMs, onPick, onCancel }: EffectPickerProps) {
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
      <div className="effect-picker__grid">
        {ADDABLE_EFFECTS.map((effect) => (
          <button key={effect.value} type="button" onClick={() => onPick(effect.value)}>
            {effect.label}
          </button>
        ))}
      </div>
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
