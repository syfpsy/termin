import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { phosphorPlayerPlugin } from './vite-plugins/phosphor-player';
import { publicDirectoryIndexPlugin } from './vite-plugins/public-directory-index';

export default defineConfig({
  plugins: [react(), phosphorPlayerPlugin(), publicDirectoryIndexPlugin()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
