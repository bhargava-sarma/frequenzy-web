import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frequenzy is served over plain HTTP so that it can talk to the Navidrome
// server over plain HTTP too (browsers block http:// fetches from https:// pages).
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pinyin-pro')) return 'romanize-zh';
          if (id.includes('kuroshiro') || id.includes('kuromoji')) return 'romanize-ja';
          if (id.includes('node_modules/react') || id.includes('react-router')) return 'react';
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@sglkc/kuroshiro', '@sglkc/kuroshiro-analyzer-kuromoji'],
  },
});
