export type ExportTarget = 'html' | 'me' | 'bundle-json' | 'mp4' | 'gif' | 'svg' | 'png-seq' | 'webm' | 'loop-url';

export type ExportJobStatus = 'queued' | 'running' | 'done' | 'blocked';

export type ExportJob = {
  id: string;
  target: ExportTarget;
  label: string;
  status: ExportJobStatus;
  progress: number;
  createdAt: number;
  note: string;
};

export const EXPORT_TARGETS: Array<{
  target: ExportTarget;
  label: string;
  priority: number;
  status: 'ready' | 'planned';
  note: string;
}> = [
  { target: 'html', label: 'HTML embed', priority: 1, status: 'ready', note: 'Self-contained runtime with scene inline.' },
  { target: 'me', label: '.me source', priority: 2, status: 'ready', note: 'Plain text, diffable, versionable.' },
  { target: 'bundle-json', label: 'Bundle JSON', priority: 3, status: 'ready', note: 'Scene, appearance, and asset manifest.' },
  { target: 'mp4', label: 'MP4', priority: 4, status: 'planned', note: 'Future ffmpeg frame render worker.' },
  { target: 'gif', label: 'GIF', priority: 5, status: 'planned', note: 'Future quantized frame pipeline.' },
  { target: 'loop-url', label: 'Loop URL', priority: 6, status: 'planned', note: 'Future hosted read-only scene share.' },
  { target: 'svg', label: 'SVG', priority: 7, status: 'planned', note: 'Future vector animation emitter.' },
  { target: 'png-seq', label: 'PNG sequence', priority: 8, status: 'planned', note: 'Future zipped frame export.' },
  { target: 'webm', label: 'WebM', priority: 9, status: 'planned', note: 'Future alpha-capable video render.' },
];

export function createExportJob(target: ExportTarget, label: string, ready: boolean): ExportJob {
  return {
    id: crypto.randomUUID(),
    target,
    label,
    status: ready ? 'done' : 'blocked',
    progress: ready ? 1 : 0,
    createdAt: Date.now(),
    note: ready ? 'Export generated locally.' : 'Render target is scaffolded for a future worker.',
  };
}
