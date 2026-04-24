import { resolve } from 'node:path';
import { build, type Plugin } from 'vite';
import type { RollupOutput } from 'rollup';

const VIRTUAL_ID = 'virtual:phosphor-player';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

const WATCH_PREFIXES = ['src/player/', 'src/engine/', 'src/export/bundle'];

export function phosphorPlayerPlugin(): Plugin {
  let cached: string | null = null;
  let pending: Promise<string> | null = null;
  let root = process.cwd();

  const buildOnce = async (): Promise<string> => {
    if (cached) return cached;
    if (pending) return pending;
    pending = (async () => {
      const result = (await build({
        configFile: resolve(root, 'vite.player.config.ts'),
        logLevel: 'warn',
        build: { write: false },
      })) as RollupOutput | RollupOutput[];
      const outputs = Array.isArray(result) ? result : [result];
      const chunk = outputs[0]?.output.find(
        (asset) => asset.type === 'chunk' && asset.fileName === 'phosphor-player.js',
      );
      if (!chunk || chunk.type !== 'chunk') {
        throw new Error('phosphor-player build produced no matching chunk.');
      }
      cached = chunk.code;
      return cached;
    })();
    try {
      return await pending;
    } finally {
      pending = null;
    }
  };

  return {
    name: 'phosphor-player',
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return null;
      const code = await buildOnce();
      return `export default ${JSON.stringify(code)};`;
    },
    handleHotUpdate({ file, server }) {
      const relative = file.replace(/\\/g, '/').replace(`${root.replace(/\\/g, '/')}/`, '');
      if (!WATCH_PREFIXES.some((prefix) => relative.startsWith(prefix))) return;
      cached = null;
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) server.moduleGraph.invalidateModule(mod);
    },
  };
}
