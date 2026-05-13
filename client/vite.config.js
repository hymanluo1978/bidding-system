import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildTarget = process.env.VITE_BUILD_TARGET;
const base = buildTarget === 'vercel' ? '/' : '/bidding-system/';

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: buildTarget === 'vercel' ? 'dist' : '../docs',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
  },
});
