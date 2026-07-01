/**
 * initWebSentry tests — OBS-01, OBS-06
 *
 * Spec ACs covered (P1: Sentry production error monitoring):
 *  - AC1: apps/web boots with a non-empty VITE_SENTRY_DSN → Sentry SDK
 *    initializes exactly once with that DSN.
 *  - AC2: apps/web boots with an absent/empty VITE_SENTRY_DSN → Sentry SDK
 *    does NOT initialize (dev/CI no-op).
 *  - AC8: when the SDK initializes, it is configured with
 *    `sendDefaultPii: false`, `tracesSampleRate: 0`, and no session replay
 *    (asserted via an empty `integrations` list — no Replay integration).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const initMock = vi.fn();

vi.mock('@sentry/react', () => ({
  init: (...args: unknown[]) => initMock(...args),
}));

import { initWebSentry } from '../sentry';

describe('initWebSentry', () => {
  beforeEach(() => {
    initMock.mockClear();
  });

  it('does not initialize Sentry when dsn is an empty string', () => {
    initWebSentry('');
    expect(initMock).not.toHaveBeenCalled();
  });

  it('does not initialize Sentry when dsn is undefined', () => {
    initWebSentry(undefined);
    expect(initMock).not.toHaveBeenCalled();
  });

  it('initializes Sentry exactly once with privacy-minimal options when dsn is present', () => {
    const dsn = 'https://examplePublicKey@o0.ingest.sentry.io/0';

    initWebSentry(dsn);

    expect(initMock).toHaveBeenCalledTimes(1);
    expect(initMock).toHaveBeenCalledWith({
      dsn,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      integrations: [],
    });
  });
});
