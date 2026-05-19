/**
 * Visual regression baseline spec — Unit 8 (E3 decision)
 *
 * 16 dark-desktop baselines at 1440x900, one per primary surface.
 * Scope: dark theme only, desktop only (1440x900).
 * Light theme, mobile, and multi-state captures are explicitly out of scope
 * at launch (E3 decision — see docs/plans/2026-04-27-001-feat-v1-launch-readiness-plan.md).
 *
 * Update baselines (intentional redesign):
 *   pnpm exec playwright test --update-snapshots
 *   See docs/design/v1/visual-regression.md for the full update procedure.
 *
 * PREREQUISITES (local run):
 *   1. Dev server running: pnpm dev (api on :3000, web on :5173)
 *   2. Fixture user exists with at least one tracked deck.
 *      See docs/dev-fixtures.md for seed instructions.
 *   3. FIXTURE_EMAIL + FIXTURE_PASS env vars set (or defaults from dev-fixtures.md apply).
 *
 * Sign-in approach: API-level POST /api/auth/sign-in → sets JWT in localStorage.
 * This mirrors the U2 screenshot script helper (scripts/screenshot-all-surfaces.ts)
 * and avoids UI interaction delays.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const FIXTURE_EMAIL = process.env.FIXTURE_EMAIL ?? 'fixture@test.local';
const FIXTURE_PASS = process.env.FIXTURE_PASS ?? 'test-password-1234';

/** ms to wait after navigation for animations and data fetches to settle. */
const SETTLE_MS = 1500;

// ---------------------------------------------------------------------------
// Surface inventory (16 surfaces — E3 launch scope)
// ---------------------------------------------------------------------------

// Anon surfaces (no auth required): 5 surfaces
const ANON_SURFACES = [
  { name: 'sign-in', url: '/sign-in' },
  { name: 'sign-up', url: '/sign-up' },
  { name: 'forgot-password', url: '/forgot-password' },
  // reset-password renders with a no-token loading state at the bare URL —
  // sufficient for visual regression at launch; token-specific states are post-v1.
  { name: 'reset-password', url: '/reset-password' },
  { name: 'check-your-email', url: '/check-your-email' },
] as const;

// Authenticated surfaces: 11 original + 4 v2 additions = 15 surfaces (U16)
// Covers every primary route in the _auth layout plus v2 deck management surfaces.
const AUTH_SURFACES = [
  // Onboarding wizard (step 1 — shown to fresh users without a tracked deck).
  { name: 'onboarding', url: '/onboarding' },
  // Home (populated — fixture user has tracked decks).
  { name: 'home', url: '/home' },
  // Deck detail — resolved at runtime from the first deck link on /home.
  // Falls back to /home if no deck link is found (e.g. empty collection).
  { name: 'deck-detail', url: '/home' /* resolved at runtime */ },
  // Library (populated — fixture user has imported CSV cards).
  { name: 'library', url: '/library' },
  // Library CSV Sources sub-page.
  { name: 'library-csv-sources', url: '/library-csv-sources' },
  // Swaps (pending tab default — renamed from Reviews).
  { name: 'swaps', url: '/swaps' },
  // Settings (theme toggle, account).
  { name: 'settings', url: '/settings' },
  // Add cards — chooser (the three-path entry screen).
  { name: 'add-cards', url: '/add-cards' },
  // Add cards — manual entry sub-page.
  { name: 'add-cards-manual', url: '/add-cards/manual' },
  // Add cards — CSV upload sub-page.
  { name: 'add-cards-csv', url: '/add-cards/csv' },
  // Add cards — Fabrary import sub-page.
  { name: 'add-cards-fabrary', url: '/add-cards/fabrary' },
  // v2 U16 additions --------------------------------------------------------
  // /decks/new two-path landing (Import from Fabrary + Start from scratch).
  { name: 'decks-new', url: '/decks/new' },
  // Deck detail in Edit mode — hero/format dropdowns + edit canvas + Save/Cancel.
  // Resolved at runtime from the first deck link on /home (?edit=1 appended).
  { name: 'deck-detail-edit', url: '/home' /* resolved at runtime — ?edit=1 appended */ },
  // Home with status shelves: canonical mixed permutation (multiple decks).
  { name: 'home-mixed', url: '/home' },
  // Home filtered by tag — shows TagFilterChips active state.
  { name: 'home-tag-filter', url: '/home' /* tag param injected at runtime */ },
  // Home with Retired shelf collapsed (default collapsed state).
  { name: 'home-retired-collapsed', url: '/home' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sign in via the API endpoint and seed the JWT into page localStorage.
 * Returns the JWT string, or null if sign-in fails (e.g. no dev server).
 */
async function seedAuth(page: Page): Promise<string | null> {
  try {
    // Navigate to BASE_URL first so localStorage is on the correct origin.
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });

    const result = await page.evaluate(
      async ([apiBase, email, pass]) => {
        const res = await fetch(`${apiBase}/api/auth/sign-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: pass }),
        });
        if (!res.ok) return { ok: false, jwt: '' };
        const body = await res.json() as { jwt?: string };
        if (!body.jwt) return { ok: false, jwt: '' };
        localStorage.setItem('rathe-arsenal:jwt', body.jwt);
        // Set dark theme explicitly so the test captures the dark baseline.
        localStorage.setItem('rathe-arsenal:theme', 'dark');
        document.documentElement.dataset['theme'] = 'dark';
        return { ok: true, jwt: body.jwt };
      },
      [BASE_URL, FIXTURE_EMAIL, FIXTURE_PASS] as [string, string, string],
    );

    return result.ok ? result.jwt : null;
  } catch {
    return null;
  }
}

/**
 * Apply dark theme on the current page (localStorage + dataset).
 * Called after every navigation in case the route reset the theme.
 */
async function applyDarkTheme(page: Page): Promise<void> {
  await page.evaluate(() => {
    try { localStorage.setItem('rathe-arsenal:theme', 'dark'); } catch { /* ok */ }
    document.documentElement.dataset['theme'] = 'dark';
  });
}

/**
 * Resolve a real deck-detail URL from the first deck link on /home.
 * Returns null if no deck link is present (empty collection).
 */
async function resolveDeckUrl(page: Page): Promise<string | null> {
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(SETTLE_MS);
  return page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>('a[href^="/decks/"]');
    return link?.getAttribute('href') ?? null;
  });
}

/**
 * Navigate to a surface, apply dark theme, wait for settle, and take a
 * full-page screenshot for snapshot comparison.
 */
async function captureAndCompare(
  page: Page,
  surfaceName: string,
  url: string,
  snapshotName: string,
): Promise<void> {
  await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 20000 });
  await applyDarkTheme(page);
  await page.waitForTimeout(SETTLE_MS);
  await expect(page).toHaveScreenshot(`${snapshotName}.png`, {
    fullPage: true,
    // 1% pixel diff threshold to tolerate sub-pixel antialiasing differences
    // between Chromium versions on different CI machines.
    maxDiffPixelRatio: 0.01,
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Visual regression — dark desktop 1440x900 (U8)', () => {
  let jwt: string | null = null;
  let deckUrl: string | null = null;

  test.beforeAll(async ({ browser }) => {
    // Sign in once per suite; all tests in this suite share the auth state
    // via localStorage seeded on each page (not via storageState, because
    // the JWT lifecycle is managed by the app's own localStorage key).
    const page = await browser.newPage();
    jwt = await seedAuth(page);
    if (jwt) {
      deckUrl = await resolveDeckUrl(page);
    }
    await page.close();
  });

  // -------------------------------------------------------------------------
  // Anonymous surfaces (5)
  // -------------------------------------------------------------------------

  for (const surface of ANON_SURFACES) {
    test(`anon: ${surface.name}`, async ({ page }) => {
      await captureAndCompare(page, surface.name, surface.url, surface.name);
    });
  }

  // -------------------------------------------------------------------------
  // Authenticated surfaces (11)
  // -------------------------------------------------------------------------

  for (const surface of AUTH_SURFACES) {
    test(`auth: ${surface.name}`, async ({ page }) => {
      // Seed JWT before navigating to any auth surface.
      if (!jwt) {
        test.skip(true, `Skipping ${surface.name} — no JWT (dev server not running or sign-in failed)`);
        return;
      }

      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
      await page.evaluate((token: string) => {
        localStorage.setItem('rathe-arsenal:jwt', token);
        localStorage.setItem('rathe-arsenal:theme', 'dark');
        document.documentElement.dataset['theme'] = 'dark';
      }, jwt);

      let targetUrl = surface.url;

      // Resolve the deck-detail URL at runtime.
      if (surface.name === 'deck-detail') {
        if (!deckUrl) {
          test.skip(true, 'Skipping deck-detail — no tracked deck found on /home');
          return;
        }
        targetUrl = deckUrl;
      }

      // v2 U16: deck-detail-edit — navigate to deck ?edit=1 for Edit-mode snapshot.
      if (surface.name === 'deck-detail-edit') {
        if (!deckUrl) {
          test.skip(true, 'Skipping deck-detail-edit — no tracked deck found on /home');
          return;
        }
        targetUrl = deckUrl + '?edit=1';
      }

      // v2 U16: home-tag-filter — activate the first available tag filter chip.
      if (surface.name === 'home-tag-filter') {
        // Navigate to /home first to discover available tags from the page.
        // If no tags exist, skip (fixture has no tagged decks).
        targetUrl = '/home';
        await page.goto(`${BASE_URL}${targetUrl}`, { waitUntil: 'networkidle', timeout: 20000 });
        await applyDarkTheme(page);
        await page.waitForTimeout(SETTLE_MS);
        const firstTag = await page.evaluate(() => {
          const chip = document.querySelector<HTMLButtonElement>('button[aria-pressed]');
          return chip?.textContent?.trim() ?? null;
        });
        if (!firstTag) {
          test.skip(true, 'Skipping home-tag-filter — no tag chips found (fixture has no tagged decks)');
          return;
        }
        // Append the first tag to the URL as a filter param.
        targetUrl = `/home?tag=${encodeURIComponent(firstTag)}`;
      }

      await captureAndCompare(page, surface.name, targetUrl, surface.name);
    });
  }
});
