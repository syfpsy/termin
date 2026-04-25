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
  build: {
    // Slim the initial main bundle by spinning third-party deps into their
    // own chunks. The browser fetches them in parallel and caches them
    // separately, so most app changes ship without invalidating vendor JS.
    rollupOptions: {
      output: {
        manualChunks: {
          'supabase': ['@supabase/supabase-js'],
          'react-vendor': ['react', 'react-dom'],
          'lucide': ['lucide-react'],
        },
      },
    },
    // Vite warns at 500 KB per chunk by default; with the splits above the
    // main app chunk fits comfortably and we don't need a fake bump.
  },
});
