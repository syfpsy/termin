import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_DSL } from '../src/engine/dsl';
import { DEFAULT_APPEARANCE } from '../src/engine/types';
import { buildPhosphorBundle, serializePhosphorBundle } from '../src/export/bundle';

const targetDir = resolve(process.cwd(), 'public/examples/web-player');
mkdirSync(targetDir, { recursive: true });

const bundle = buildPhosphorBundle({
  sceneName: 'boot_sequence_v3',
  dsl: DEFAULT_DSL,
  appearance: DEFAULT_APPEARANCE,
  createdAt: '2026-04-24T00:00:00.000Z',
});

const outFile = resolve(targetDir, 'boot_sequence_v3.phosphor.json');
writeFileSync(outFile, serializePhosphorBundle(bundle), 'utf8');

console.log(
  `example bundle written: ${outFile} (${bundle.scene.events.length} events, ${bundle.scene.durationMs}ms)`,
);
