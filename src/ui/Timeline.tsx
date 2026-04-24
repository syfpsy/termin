import { estimateEventDuration, eventTone } from '../engine/dsl';
import type { ParsedScene, TickRate } from '../engine/types';
import { Button, Panel } from './components';

type TimelineProps = {
  scene: ParsedScene;
  tick: number;
  rate: TickRate;
  onScrub: (tick: number) => void;
};

export function Timeline({ scene, tick, rate, onScrub }: TimelineProps) {
  const durationTicks = Math.max(1, Math.ceil((scene.duration / 1000) * rate));
  const playhead = (tick / durationTicks) * 100;
  const divisions = Array.from({ length: Math.floor(durationTicks / 6) + 1 }, (_, index) => index * 6);

  return (
    <Panel
      title="TIMELINE"
      flags={`${rate} Hz - ${durationTicks} ticks - ${(scene.duration / 1000).toFixed(1)}s`}
      flush
      className="timeline-panel"
      tools={
        <>
          <Button active>frame</Button>
          <Button>ms</Button>
        </>
      }
    >
      <div className="timeline">
        <div className="timeline__ruler">
          <div className="timeline__track-head">track</div>
          <div className="timeline__ticks">
            {divisions.map((division) => (
              <button
                key={division}
                className="timeline__tick"
                style={{ left: `${(division / durationTicks) * 100}%` }}
                onClick={() => onScrub(division)}
              >
                {division % rate === 0 ? `${(division / rate).toFixed(1)}s` : division}
              </button>
            ))}
            <div className="timeline__playhead" style={{ left: `${playhead}%` }} />
          </div>
        </div>
        <div className="timeline__tracks">
          {scene.events.map((event) => {
            const start = (event.at / scene.duration) * 100;
            const length = (estimateEventDuration(event, rate) / scene.duration) * 100;
            const tone = eventTone(event);
            return (
              <button key={event.id} className="timeline__row" onClick={() => onScrub(Math.floor((event.at / 1000) * rate))}>
                <span className="timeline__name">{event.target || event.effect}</span>
                <span className="timeline__effect" data-tone={tone}>
                  {event.effect}
                </span>
                <span className="timeline__lane">
                  <span className="timeline__bar" data-tone={tone} style={{ left: `${start}%`, width: `${Math.max(1.5, length)}%` }} />
                  <span className="timeline__key" style={{ left: `${start}%` }} />
                  <span className="timeline__key" style={{ left: `${Math.min(100, start + Math.max(1.5, length))}%` }} />
                </span>
              </button>
            );
          })}
          <div className="timeline__global-playhead" style={{ left: `calc(170px + (100% - 170px) * ${playhead / 100})` }} />
        </div>
      </div>
    </Panel>
  );
}
