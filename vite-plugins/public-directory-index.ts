import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export function publicDirectoryIndexPlugin(): Plugin {
  let publicDir = '';

  return {
    name: 'public-directory-index',
    configResolved(config) {
      publicDir = config.publicDir || resolve(config.root, 'public');
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url;
        if (!url || url.includes('?')) return next();
        if (!url.endsWith('/') || url === '/') return next();
        const candidate = resolve(publicDir, `.${url}index.html`);
        if (existsSync(candidate)) {
          req.url = `${url}index.html`;
        }
        next();
      });
    },
  };
}
