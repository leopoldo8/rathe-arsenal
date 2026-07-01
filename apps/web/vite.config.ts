import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import svgr from 'vite-plugin-svgr';
import { sentryWebPlugins } from './src/observability/sentry-vite';

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
    // Sentry docs require this plugin to be last. Token-gated (OBS-07): a
    // build with no SENTRY_AUTH_TOKEN gets an empty array here, so local
    // dev/CI builds never attempt a sourcemap upload.
    ...sentryWebPlugins(process.env),
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
