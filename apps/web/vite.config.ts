import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // No alias for @if-fleet/domain — let pnpm workspace symlink resolution
  // handle it. Vite's esbuild pre-bundler converts the CJS dist/index.js to
  // ESM correctly, which Rollup can then statically analyse for named exports.
  optimizeDeps: {
    include: ['@if-fleet/domain'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
