/**
 * sentryWebPlugins tests — OBS-07
 *
 * Spec AC covered (P1: Sentry production error monitoring):
 *  - AC11: WHEN `SENTRY_AUTH_TOKEN` (+ org/project) is set THEN the Sentry
 *    Vite plugin SHALL be included so sourcemaps upload for the release;
 *    WHEN the token is absent THEN no plugin SHALL be included (build
 *    proceeds with no upload and no error).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// `vi.mock` factories are hoisted above module-scope `const` declarations,
// so the factory reads `sentryVitePluginMock` lazily (inside an arrow
// function) rather than assigning it directly — a direct reference would
// hit the TDZ before the const initializes.
const sentryVitePluginMock = vi.fn();
sentryVitePluginMock.mockReturnValue([{ name: 'sentry-vite-plugin', enforce: 'pre' as const }]);

vi.mock('@sentry/vite-plugin', () => ({
  sentryVitePlugin: (...args: unknown[]) => sentryVitePluginMock(...args),
}));

import { sentryWebPlugins } from '../sentry-vite';

describe('sentryWebPlugins', () => {
  beforeEach(() => {
    sentryVitePluginMock.mockClear();
  });

  it('returns an empty array when SENTRY_AUTH_TOKEN is absent', () => {
    const plugins = sentryWebPlugins({});

    expect(plugins).toHaveLength(0);
    expect(sentryVitePluginMock).not.toHaveBeenCalled();
  });

  it('returns an empty array when SENTRY_AUTH_TOKEN is an empty string', () => {
    const plugins = sentryWebPlugins({ SENTRY_AUTH_TOKEN: '' });

    expect(plugins).toHaveLength(0);
    expect(sentryVitePluginMock).not.toHaveBeenCalled();
  });

  it('returns a single plugin configured with org/project/authToken when SENTRY_AUTH_TOKEN is present', () => {
    const plugins = sentryWebPlugins({
      SENTRY_AUTH_TOKEN: 't',
      SENTRY_ORG: 'o',
      SENTRY_PROJECT: 'p',
    });

    expect(plugins).toHaveLength(1);
    expect(sentryVitePluginMock).toHaveBeenCalledTimes(1);
    expect(sentryVitePluginMock).toHaveBeenCalledWith(
      expect.objectContaining({
        org: 'o',
        project: 'p',
        authToken: 't',
      }),
    );
  });
});
