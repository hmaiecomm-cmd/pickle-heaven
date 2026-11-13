/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API base is same-origin (relative URLs). In dev the Vite server proxies to the FastAPI backend.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/v1': { target: 'http://localhost:8000', changeOrigin: false },
      '/media': { target: 'http://localhost:8000', changeOrigin: false },
    },
  },
  // Inline (empty) PostCSS config: stops Vite from picking up an unrelated postcss.config.* in a parent directory.
  css: { postcss: { plugins: [] } },
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
