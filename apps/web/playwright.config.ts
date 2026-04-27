import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the web app.
 *
 * Two test suites:
 *   1. Visual regression (tests/visual/): 16 dark-desktop snapshots at 1440x900.
 *      Committed baselines in tests/visual/__snapshots__/.
 *      Update with: pnpm playwright test --update-snapshots
 *
 * Prerequisites for visual suite:
 *   - Dev server running: pnpm dev (api :3000, web :5173)
 *   - Test user created. See docs/dev-fixtures.md for seed instructions.
 *   - Set FIXTURE_EMAIL + FIXTURE_PASS env vars (or use defaults from dev-fixtures.md).
 *   - A deck must be tracked by the fixture user (for deck-detail snapshot).
 *
 * See docs/design/v1/visual-regression.md for the baseline-update procedure.
 */

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'visual-dark-desktop',
      testMatch: '**/visual/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        colorScheme: 'dark',
      },
      snapshotPathTemplate: '{testDir}/visual/__snapshots__/{testName}-{projectName}.png',
    },
  ],
  // webServer is intentionally omitted: the dev server is expected to be
  // running externally (see prerequisites above). This keeps startup fast and
  // avoids double-launching when the owner is already running `pnpm dev`.
});
