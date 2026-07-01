import { sentryVitePlugin } from '@sentry/vite-plugin';
import type { PluginOption } from 'vite';

/**
 * sentryWebPlugins — token-gated Sentry sourcemap upload for apps/web (OBS-07).
 *
 * Runs at build time inside `vite.config.ts`, in the Node/vite config
 * context — reads `env` (typically `process.env`) directly, not
 * `import.meta.env`.
 *
 * Returns `[]` when `SENTRY_AUTH_TOKEN` is missing/empty so a build with no
 * Sentry credentials (local dev, most CI runs) never attempts an upload and
 * never fails because of it. When the token is present, uploads sourcemaps
 * for the given org/project and deletes the uploaded `.map` files from the
 * build output afterwards so they are never served publicly from `dist`.
 */
export function sentryWebPlugins(env: NodeJS.ProcessEnv): PluginOption[] {
  if (!env.SENTRY_AUTH_TOKEN) {
    return [];
  }

  // Conditional spreads (rather than `org: env.SENTRY_ORG`) keep `org`/
  // `project` entirely absent from the options object when unset, as
  // required under `exactOptionalPropertyTypes` — the plugin's `Options`
  // type declares them as optional-string, not optional-string-or-undefined.
  return sentryVitePlugin({
    ...(env.SENTRY_ORG !== undefined ? { org: env.SENTRY_ORG } : {}),
    ...(env.SENTRY_PROJECT !== undefined ? { project: env.SENTRY_PROJECT } : {}),
    authToken: env.SENTRY_AUTH_TOKEN,
    sourcemaps: {
      filesToDeleteAfterUpload: ['./dist/**/*.js.map'],
    },
  });
}
