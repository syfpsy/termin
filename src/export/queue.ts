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
  { target: 'mp4', label: 'MP4', priority: 4, status: 'ready', note: 'MediaRecorder MP4 capture (Chrome, Edge, Safari 14.1+).' },
  { target: 'webm', label: 'WebM', priority: 5, status: 'ready', note: 'MediaRecorder WebM capture (VP9 with VP8 fallback).' },
  { target: 'gif', label: 'GIF', priority: 6, status: 'ready', note: 'Offscreen render with quantized palette via gifenc.' },
  { target: 'png-seq', label: 'PNG sequence', priority: 7, status: 'ready', note: 'Offscreen per-tick render zipped for frame tooling.' },
  { target: 'loop-url', label: 'Loop URL', priority: 8, status: 'ready', note: 'Client-side gzip + base64 fragment on /play.html — no server required.' },
  { target: 'svg', label: 'SVG', priority: 9, status: 'ready', note: 'Animated SVG with SMIL keyframes per lit cell; poster fallback for single-tick scenes.' },
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
