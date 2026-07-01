import * as Sentry from '@sentry/node';

/**
 * initApiSentry — env-gated, privacy-minimal Sentry init for apps/api
 * (OBS-03, OBS-06).
 *
 * No-op when `SENTRY_DSN` is absent/empty so local dev and CI never attempt
 * to report to Sentry. Errors-only posture: no tracing
 * (`tracesSampleRate: 0`) and no default PII collection
 * (`sendDefaultPii: false`).
 *
 * Returns whether Sentry was initialized, so callers can log/branch without
 * re-deriving the DSN-presence check.
 */
export function initApiSentry(dsn: string | undefined): boolean {
  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });

  return true;
}
