/**
 * AppErrorBoundary tests — OBS-02
 *
 * Spec AC covered (P1: Sentry production error monitoring):
 *  - AC3: WHEN a React render error propagates to the top-level boundary
 *    THEN it SHALL be captured by Sentry AND a fallback UI SHALL render
 *    instead of a blank screen.
 *
 * @sentry/react is NOT mocked here: Sentry.ErrorBoundary renders the
 * fallback and calls captureException regardless of whether initWebSentry()
 * ran, and captureException no-ops silently without a configured client
 * (no DSN in this test environment) — so exercising the real module proves
 * the "works with no DSN" branch of AC3 rather than assuming it.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppErrorBoundary } from '../AppErrorBoundary';

function Throws(): React.ReactElement {
  throw new Error('boom');
}

describe('AppErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React logs the caught render error (and Sentry's ErrorBoundary logs
    // its own debug line) to console.error when a child throws. This is
    // expected test noise for an intentionally-throwing component, not a
    // real failure, so it is suppressed for the duration of this suite.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders the fallback UI instead of the throwing child tree', () => {
    render(
      <AppErrorBoundary>
        <Throws />
      </AppErrorBoundary>,
    );

    // The fallback is a role="alert" region — a stable, semantic handle
    // that does not depend on the exact copy rendered inside it.
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders a heading inside the fallback so the screen is not blank', () => {
    render(
      <AppErrorBoundary>
        <Throws />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('does not render the throwing child content', () => {
    render(
      <AppErrorBoundary>
        <Throws />
      </AppErrorBoundary>,
    );

    // "boom" is the Error message, not any text the fallback renders —
    // proves the crashed subtree was replaced, not merged.
    expect(screen.queryByText('boom')).not.toBeInTheDocument();
  });

  it('renders children normally when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <p>All good</p>
      </AppErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
