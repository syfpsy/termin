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
  { target: 'bundle-json', label: 'Phosphor bundle', priority: 1, status: 'ready', note: 'Versioned JSON for web players and device runtimes.' },
  { target: 'html', label: 'HTML embed', priority: 2, status: 'ready', note: 'Self-contained convenience wrapper with bundle inline.' },
  { target: 'me', label: '.me source', priority: 3, status: 'ready', note: 'Plain text, diffable, versionable.' },
  { target: 'png-seq', label: 'PNG sequence', priority: 4, status: 'ready', note: 'Offscreen per-tick render zipped for frame tooling.' },
  { target: 'webm', label: 'WebM', priority: 5, status: 'ready', note: 'MediaRecorder capture of a canvas stream at scene tick rate.' },
  { target: 'mp4', label: 'MP4', priority: 6, status: 'planned', note: 'Future ffmpeg.wasm encode on top of PNG sequence.' },
  { target: 'gif', label: 'GIF', priority: 7, status: 'planned', note: 'Future quantized frame pipeline.' },
  { target: 'loop-url', label: 'Loop URL', priority: 8, status: 'planned', note: 'Future hosted read-only scene share.' },
  { target: 'svg', label: 'SVG', priority: 9, status: 'planned', note: 'Future vector animation emitter.' },
];

export function createExportJob(target: ExportTarget, label: string, ready: boolean): ExportJob {
  return {
    id: crypto.randomUUID(),
    target,
    label,
    status: ready ? 'queued' : 'blocked',
    progress: 0,
    createdAt: Date.now(),
    note: ready ? 'Queued for local render.' : 'Render target is scaffolded for a future worker.',
  };
}

export function isAsyncRenderTarget(target: ExportTarget): boolean {
  return target === 'png-seq' || target === 'webm';
}
