import * as Sentry from '@sentry/react';

/**
 * initWebSentry — env-gated, privacy-minimal Sentry init for apps/web (OBS-01, OBS-06).
 *
 * No-op when `VITE_SENTRY_DSN` is absent/empty so local dev and CI never
 * attempt to report to Sentry. `dsn` is a parameter (defaulting to the Vite
 * env var) rather than reading `import.meta.env` inline so both the
 * DSN-present and DSN-absent branches are directly unit-testable.
 *
 * Errors-only posture: no tracing (`tracesSampleRate: 0`), no session
 * replay (`integrations: []` — the default integrations set already
 * excludes Replay, and passing an explicit empty list keeps that posture
 * from drifting), and no default PII collection.
 */
export function initWebSentry(
  dsn: string | undefined = import.meta.env.VITE_SENTRY_DSN as string | undefined,
): void {
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    integrations: [],
  });
}
