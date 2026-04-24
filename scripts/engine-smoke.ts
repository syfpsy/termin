import { SCENE_LIBRARY } from '../src/scenes/library';
import { parseScene } from '../src/engine/dsl';
import { Grid } from '../src/engine/grid';
import { evaluateScene } from '../src/engine/primitives';

const grid = new Grid(96, 36);
const failures: string[] = [];

for (const seed of SCENE_LIBRARY) {
  const scene = parseScene(seed.dsl);
  const invalid = scene.lines.filter((line) => line.kind === 'invalid');
  if (invalid.length > 0) {
    failures.push(`${seed.id}: ${invalid.length} invalid DSL lines`);
    continue;
  }

  const lastTick = Math.max(0, Math.floor((scene.duration / 1000) * 30) - 1);
  evaluateScene(scene, grid, lastTick, 30);
  let lit = 0;
  grid.forEach((cell) => {
    if (cell.intensity > 0) lit += 1;
  });

  if (lit === 0) failures.push(`${seed.id}: rendered no lit cells`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`engine smoke passed: ${SCENE_LIBRARY.length} library scenes parse and render`);
