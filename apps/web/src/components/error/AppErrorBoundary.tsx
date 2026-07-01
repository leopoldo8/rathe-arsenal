import React from 'react';
import * as Sentry from '@sentry/react';
import { RootErrorFallback } from './RootErrorFallback';

interface IAppErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * AppErrorBoundary — the app's first top-level React error boundary (OBS-02).
 *
 * Wraps Sentry's `ErrorBoundary` so any render crash below this point shows
 * `RootErrorFallback` instead of a blank screen. `Sentry.ErrorBoundary`
 * renders the fallback and reports via `captureException` regardless of
 * whether `initWebSentry()` ran — `captureException` no-ops silently
 * without a configured client, so this boundary is a real UX safety net
 * even in DSN-less dev/CI, not just a monitoring hook.
 */
export function AppErrorBoundary({ children }: IAppErrorBoundaryProps): React.ReactElement {
  return (
    <Sentry.ErrorBoundary fallback={() => <RootErrorFallback />}>{children}</Sentry.ErrorBoundary>
  );
}
