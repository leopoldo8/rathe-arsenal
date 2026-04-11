import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import type { UserConfig as VitestUserConfig } from 'vitest/config';

/**
 * Vitest configuration for `@rathe-arsenal/web`.
 *
 * Mirrors `vite.config.ts` plugins so test renders resolve JSX and the
 * generated TanStack Router tree the same way the dev build does.
 *
 * Why the type gymnastics: Vitest 2.1 ships with `vitest/config`'s
 * `defineConfig` bundled against Vite 5 plugin types, but this project uses
 * Vite 6. Under `exactOptionalPropertyTypes: true` the two plugin-option
 * types are nominally incompatible, so we build the config with Vite 6's
 * own `defineConfig` and carry the `test` block separately as
 * `VitestUserConfig['test']`. Vitest consumes both fields at runtime — the
 * split is purely for TypeScript.
 *
 * Notes:
 *  - `environment: 'jsdom'` is required for React Testing Library.
 *  - `globals: true` exposes `describe`, `it`, `expect`, etc. without
 *    per-file imports, matching the idiomatic RTL + Vitest style and
 *    letting us pair it with `vitest/globals` types in tsconfig.
 *  - `setupFiles` wires `@testing-library/jest-dom` matchers and RTL
 *    cleanup once per worker.
 *  - `routeTree.gen.ts` is excluded from coverage because it is a
 *    generated artifact.
 */
const plugins: PluginOption[] = [TanStackRouterVite(), react()];

const test: VitestUserConfig['test'] = {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
  include: ['src/**/*.{test,spec}.{ts,tsx}'],
  css: false,
  coverage: {
    exclude: ['src/routeTree.gen.ts', 'src/main.tsx', 'src/test/**'],
  },
};

export default defineConfig({
  plugins,
  // @ts-expect-error Vite 6's defineConfig does not know about Vitest's
  // `test` field, but Vitest reads it at runtime. The triple-slash reference
  // approach does not merge across Vite versions here.
  test,
});
