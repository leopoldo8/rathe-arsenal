/**
 * initApiSentry tests — OBS-03, OBS-06
 *
 * Spec ACs covered (P1: Sentry production error monitoring):
 *  - AC4: apps/api bootstraps with a non-empty SENTRY_DSN → Sentry SDK
 *    initializes exactly once with that DSN.
 *  - AC5: apps/api bootstraps with an absent/empty SENTRY_DSN → Sentry SDK
 *    does NOT initialize (boot unaffected).
 *  - AC8: when the SDK initializes, it is configured with
 *    `sendDefaultPii: false`, `tracesSampleRate: 0`.
 */

const initMock = jest.fn();

jest.mock('@sentry/node', () => ({
  init: (...args: unknown[]) => initMock(...args),
}));

import { initApiSentry } from '../sentry';

describe('initApiSentry', () => {
  beforeEach(() => {
    initMock.mockClear();
  });

  it('does not initialize Sentry and returns false when dsn is undefined', () => {
    const result = initApiSentry(undefined);

    expect(initMock).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('does not initialize Sentry and returns false when dsn is an empty string', () => {
    const result = initApiSentry('');

    expect(initMock).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('initializes Sentry exactly once with privacy-minimal options and returns true when dsn is present', () => {
    const dsn = 'https://examplePublicKey@o0.ingest.sentry.io/0';

    const result = initApiSentry(dsn);

    expect(initMock).toHaveBeenCalledTimes(1);
    expect(initMock).toHaveBeenCalledWith({
      dsn,
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
    expect(result).toBe(true);
  });
});
