import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      // Co-located test files under `__tests__/` are not routes. Without
      // this, TSR warns (and skips) every test file that lives under
      // `src/routes/.../__tests__/`.
      routeFileIgnorePattern: '(__tests__|\\.test\\.|\\.spec\\.)',
    }),
    svgr(),
    react(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
