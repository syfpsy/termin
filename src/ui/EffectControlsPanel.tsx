import { Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { sampleEventParam } from '../engine/keyframes';
import type {
  AnimatableEventParam,
  ParsedScene,
  PropertyAnimation,
  SceneEvent,
  TickRate,
  ToneName,
} from '../engine/types';
import { TONE_HEX } from '../engine/tones';
import { Panel } from './components';

type EffectControlsProps = {
  event: SceneEvent | null;
  scene: ParsedScene;
  rate: TickRate;
  playheadMs: number;
  onPatchEvent: (
    event: SceneEvent,
    patch: Partial<{ atMs: number; effect: string; target: string; modifiers: string }>,
  ) => void;
  onDeleteEvent: (event: SceneEvent) => void;
  onUpsertEventKeyframe: (
    event: SceneEvent,
    param: AnimatableEventParam,
    atMs: number,
    value: number,
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold',
  ) => void;
  onRemoveAnimation: (animation: PropertyAnimation) => void;
};

const TONE_CHOICES: ToneName[] = ['phos', 'amber', 'green', 'red', 'cyan', 'magenta'];

export function EffectControlsPanel({
  event,
  scene,
  rate,
  playheadMs,
  onPatchEvent,
  onDeleteEvent,
  onUpsertEventKeyframe,
  onRemoveAnimation,
}: EffectControlsProps) {
  return (
    <Panel
      id="effect-controls"
      title="EFFECT CONTROLS"
      tone="amber"
      flags={event ? event.effect : 'no selection'}
      dense
    >
      {event ? (
        <EffectControlsBody
          event={event}
          scene={scene}
          rate={rate}
          playheadMs={playheadMs}
          onPatchEvent={onPatchEvent}
          onDeleteEvent={onDeleteEvent}
          onUpsertEventKeyframe={onUpsertEventKeyframe}
          onRemoveAnimation={onRemoveAnimation}
        />
      ) : (
        <p className="effect-controls__empty">
          Select an event on the timeline to edit its parameters here.
          Animatable params expose ◆ keyframe buttons.
        </p>
      )}
    </Panel>
  );
}

function EffectControlsBody({
  event,
  scene,
  rate,
  playheadMs,
  onPatchEvent,
  onDeleteEvent,
  onUpsertEventKeyframe,
  onRemoveAnimation,
}: {
  event: SceneEvent;
  scene: ParsedScene;
  rate: TickRate;
  playheadMs: number;
  onPatchEvent: EffectControlsProps['onPatchEvent'];
  onDeleteEvent: EffectControlsProps['onDeleteEvent'];
  onUpsertEventKeyframe: EffectControlsProps['onUpsertEventKeyframe'];
  onRemoveAnimation: EffectControlsProps['onRemoveAnimation'];
}) {
  const formId = useId();
  const [target, setTarget] = useState(event.target);
  const [modifiers, setModifiers] = useState(event.modifiers);
  const [atMs, setAtMs] = useState(event.at);

  useEffect(() => {
    setTarget(event.target);
    setModifiers(event.modifiers);
    setAtMs(event.at);
  }, [event.id, event.target, event.modifiers, event.at]);

  const detectedTone = TONE_CHOICES.find((tone) =>
    new RegExp(`(^|\\s)${tone}(\\s|$)`).test(event.modifiers),
  ) ?? 'phos';

  const intensityAnim = scene.animations.find(
    (anim) => anim.eventLine === event.line && anim.property === 'intensity',
  );
  const offsetAnim = scene.animations.find(
    (anim) => anim.eventLine === event.line && anim.property === 'offset',
  );
  const isIntensityAnimated = Boolean(intensityAnim);
  const isOffsetAnimated = Boolean(offsetAnim);
  const sampledIntensity = sampleEventParam(scene.animations, event.line, 'intensity', playheadMs, 1);
  const sampledOffset = sampleEventParam(scene.animations, event.line, 'offset', playheadMs, 0);

  return (
    <div className="effect-controls">
      <div className="effect-controls__row">
        <label htmlFor={`${formId}-at`}>at (ms)</label>
        <input
          id={`${formId}-at`}
          className="effect-controls__number"
          type="number"
          min={0}
          max={scene.duration}
          step={Math.round(1000 / rate)}
          value={atMs}
          onChange={(e) => setAtMs(Number(e.target.value))}
          onBlur={() => {
            if (atMs !== event.at) onPatchEvent(event, { atMs });
          }}
        />
      </div>

      <div className="effect-controls__row effect-controls__row--animatable">
        <label htmlFor={`${formId}-target`}>target</label>
        <input
          id={`${formId}-target`}
          className="effect-controls__text"
          type="text"
          spellCheck={false}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onBlur={() => {
            if (target !== event.target) onPatchEvent(event, { target });
          }}
        />
        <span aria-hidden />
        <button
          type="button"
          className="slider-row__keyframe slider-row__keyframe--disabled"
          aria-label="Animate target text — coming soon"
          title="String-valued keyframes for target text are coming next iteration"
          disabled
        >
          ◆
        </button>
      </div>

      <div className="effect-controls__row effect-controls__row--animatable">
        <label htmlFor={`${formId}-offset`}>offset (ms)</label>
        <input
          id={`${formId}-offset`}
          type="range"
          min={-2000}
          max={2000}
          step={Math.round(1000 / rate)}
          value={sampledOffset}
          aria-valuetext={`${sampledOffset.toFixed(0)}ms`}
          onChange={(e) => onUpsertEventKeyframe(event, 'offset', playheadMs, Number(e.target.value))}
        />
        <strong className="effect-controls__display">{Math.round(sampledOffset)}ms</strong>
        <button
          type="button"
          className={`slider-row__keyframe ${isOffsetAnimated ? 'slider-row__keyframe--on' : ''}`}
          aria-label="Add offset keyframe at playhead"
          aria-pressed={isOffsetAnimated}
          title="Animate timing — adds a keyframe at the playhead with the current offset"
          onClick={() => onUpsertEventKeyframe(event, 'offset', playheadMs, sampledOffset)}
        >
          ◆
        </button>
      </div>

      <div className="effect-controls__row">
        <span className="effect-controls__label">tone</span>
        <div className="effect-controls__tones" role="radiogroup" aria-label="Tone">
          {TONE_CHOICES.map((tone) => (
            <button
              key={tone}
              type="button"
              role="radio"
              aria-checked={detectedTone === tone}
              data-active={detectedTone === tone}
              className="effect-controls__tone"
              style={{ backgroundColor: TONE_HEX[tone] }}
              title={tone}
              onClick={() => {
                const tokens = modifiers.split(/\s+/).filter(Boolean);
                const cleaned = tokens.filter((token) => !TONE_CHOICES.includes(token as ToneName));
                const nextModifiers = [...cleaned, tone === 'phos' ? '' : tone].filter(Boolean).join(' ');
                setModifiers(nextModifiers);
                onPatchEvent(event, { modifiers: nextModifiers });
              }}
            />
          ))}
        </div>
      </div>

      <div className="effect-controls__row effect-controls__row--animatable">
        <label htmlFor={`${formId}-intensity`}>intensity</label>
        <input
          id={`${formId}-intensity`}
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={sampledIntensity}
          aria-valuetext={sampledIntensity.toFixed(2)}
          onChange={(e) => {
            // Treat the slider as "set keyframe at playhead" so the value
            // is actually preserved across renders. Without a keyframe the
            // engine will use the default 1.0 multiplier.
            onUpsertEventKeyframe(event, 'intensity', playheadMs, Number(e.target.value));
          }}
        />
        <strong className="effect-controls__display">{sampledIntensity.toFixed(2)}</strong>
        <button
          type="button"
          className={`slider-row__keyframe ${isIntensityAnimated ? 'slider-row__keyframe--on' : ''}`}
          aria-label="Add intensity keyframe at playhead"
          aria-pressed={isIntensityAnimated}
          title="Add a keyframe at playhead with the current intensity"
          onClick={() => onUpsertEventKeyframe(event, 'intensity', playheadMs, sampledIntensity)}
        >
          ◆
        </button>
      </div>

      <div className="effect-controls__row">
        <label htmlFor={`${formId}-modifiers`}>modifiers</label>
        <input
          id={`${formId}-modifiers`}
          className="effect-controls__text"
          type="text"
          spellCheck={false}
          value={modifiers}
          onChange={(e) => setModifiers(e.target.value)}
          onBlur={() => {
            if (modifiers !== event.modifiers) onPatchEvent(event, { modifiers });
          }}
        />
      </div>

      <div className="effect-controls__actions">
        {isIntensityAnimated && intensityAnim && (
          <button
            type="button"
            className="button button--default"
            onClick={() => onRemoveAnimation(intensityAnim)}
          >
            clear intensity track
          </button>
        )}
        <button
          type="button"
          className="button button--red"
          aria-label="Delete event"
          onClick={() => onDeleteEvent(event)}
        >
          <Trash2 size={11} /> delete
        </button>
      </div>
    </div>
  );
}
