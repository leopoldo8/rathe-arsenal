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

/**
 * Capture-wiring tests — companion to the suite above.
 *
 * AC3 is a conjunction: "captured by Sentry AND a fallback UI renders". The
 * suite above proves the fallback-render half with the real (un-mocked)
 * `@sentry/react` module. It cannot prove the capture half, because there is
 * no spy on `Sentry.ErrorBoundary` / `captureException` to observe.
 *
 * These tests mock `@sentry/react` (same pattern as
 * `observability/__tests__/sentry.spec.ts`) so `Sentry.ErrorBoundary` becomes
 * a test double, then assert AppErrorBoundary actually delegates to it — not
 * a plain React error boundary — with `RootErrorFallback` as its `fallback`.
 * `Sentry.ErrorBoundary` is what performs the capture, so proving AppErrorBoundary
 * renders it (and not some hand-rolled boundary) is what proves the error is
 * routed to Sentry.
 *
 * The mock is applied via `vi.doMock` + `vi.resetModules()` + a dynamic
 * import, scoped to this describe block only, so the suite above keeps
 * exercising the real SDK unaffected.
 */
describe('AppErrorBoundary — Sentry capture wiring (OBS-02)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@sentry/react');
    vi.resetModules();
  });

  it('delegates to Sentry.ErrorBoundary with RootErrorFallback as its fallback', async () => {
    const errorBoundaryMock = vi.fn(
      ({ children }: { children: React.ReactNode; fallback: () => React.ReactElement }) => (
        <div data-testid="sentry-error-boundary-mock">{children}</div>
      ),
    );

    vi.doMock('@sentry/react', () => ({
      ErrorBoundary: (props: { children: React.ReactNode; fallback: () => React.ReactElement }) =>
        errorBoundaryMock(props),
    }));

    const { AppErrorBoundary: MockedAppErrorBoundary } = await import('../AppErrorBoundary');

    render(
      <MockedAppErrorBoundary>
        <p>content</p>
      </MockedAppErrorBoundary>,
    );

    // (a) capture-wiring half: AppErrorBoundary must render Sentry's
    // ErrorBoundary (the primitive that performs the capture) — a plain
    // React error boundary would never invoke this mock.
    expect(errorBoundaryMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sentry-error-boundary-mock')).toBeInTheDocument();

    // (b) fallback half: the fallback function handed to Sentry.ErrorBoundary
    // must render RootErrorFallback (role=alert, level-1 heading).
    const { fallback } = errorBoundaryMock.mock.calls[0][0];
    render(fallback());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
