import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { phosphorPlayerPlugin } from './vite-plugins/phosphor-player';

export default defineConfig({
  plugins: [react(), phosphorPlayerPlugin()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
