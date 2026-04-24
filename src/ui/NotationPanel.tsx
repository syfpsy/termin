import type { ParsedScene } from '../engine/types';
import { Panel } from './components';

type NotationPanelProps = {
  dsl: string;
  scene: ParsedScene;
  onChange: (value: string) => void;
};

export function NotationPanel({ dsl, scene, onChange }: NotationPanelProps) {
  const invalidCount = scene.lines.filter((line) => line.kind === 'invalid').length;

  return (
    <Panel title="NOTATION" flags={invalidCount ? `${invalidCount} invalid` : `${scene.events.length} events`} dense className="notation-panel">
      <textarea
        className="notation-editor"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        value={dsl}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Phosphor .me notation editor"
      />
      <div className="parsed-reading" aria-label="Parsed notation reading">
        {scene.lines.map((line) => (
          <div key={line.number} className={`parsed-line parsed-line--${line.kind}`}>
            <span className="parsed-line__gutter">{line.kind === 'invalid' ? '◇' : line.number}</span>
            <span className="parsed-line__body">
              {line.kind === 'event' && (
                <>
                  <strong>{line.event.at}ms</strong>
                  <span>{line.event.effect}</span>
                  <em>{line.event.target || '(no target)'}</em>
                  <small>{line.event.modifiers}</small>
                </>
              )}
              {line.kind === 'scene' && (
                <>
                  <strong>scene</strong>
                  <em>{line.name}</em>
                  <small>{line.duration}ms</small>
                </>
              )}
              {line.kind === 'comment' && <small>{line.raw.trim()}</small>}
              {line.kind === 'invalid' && <small>{line.error}</small>}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
