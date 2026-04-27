/**
 * screenshot-all-surfaces.ts
 *
 * Captures light + dark renderings of every authenticated and anonymous
 * surface at both desktop (1440x900) and mobile (375x812) viewports.
 *
 * PURPOSE: Produces a filesystem gallery of ~64 PNGs for owner review.
 * These are NOT committed CI baselines — gitignore covers the output dir.
 * Unit 8 will own the CI Playwright harness (dark-desktop only); this
 * script is the self-validation artifact for Unit 2 (light-theme audit).
 *
 * PREREQUISITES:
 *   1. The dev server must be running: `pnpm dev` (api on :3000, web on :5173)
 *   2. A test user must exist. Run the seed commands from docs/dev-fixtures.md
 *      OR set env vars FIXTURE_EMAIL + FIXTURE_PASS pointing to an existing
 *      verified account with at least two tracked decks.
 *
 * USAGE:
 *   pnpm tsx scripts/screenshot-all-surfaces.ts
 *
 *   # Or with custom credentials:
 *   FIXTURE_EMAIL=you@example.com FIXTURE_PASS=yourpass pnpm tsx scripts/screenshot-all-surfaces.ts
 *
 * OUTPUT:
 *   apps/web/tests/visual/__captures__/<theme>/<viewport>/<surface>.png
 *
 * TOOLING CHOICE (U2 decision):
 *   Playwright is used in raw API mode (not the test runner) because:
 *   - Unit 8 will install @playwright/test anyway for the CI harness.
 *   - Playwright's screenshot API is first-class: full-page/clip options,
 *     wait-for-network-idle, and direct localStorage manipulation without hacks.
 *   - Puppeteer would add a separate binary for the same capability.
 *   The package was added as a devDependency in apps/web/package.json and
 *   the root package.json (so `tsx` can resolve it from the scripts/ directory).
 */

import { chromium, type Page, type BrowserContext } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = process.env.FIXTURE_BASE_URL ?? 'http://localhost:5173';
const FIXTURE_EMAIL = process.env.FIXTURE_EMAIL ?? '';
const FIXTURE_PASS = process.env.FIXTURE_PASS ?? 'test-password-1234';

const CAPTURES_DIR = path.resolve(
  __dirname,
  '../apps/web/tests/visual/__captures__',
);

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
] as const;

const THEMES = ['dark', 'light'] as const;

/** Time to wait after navigation before capturing (ms). */
const SETTLE_MS = 1500;

// ---------------------------------------------------------------------------
// Surface inventory
// ---------------------------------------------------------------------------

/**
 * Each surface maps a logical name to a URL (relative to BASE_URL) and an
 * optional description of the expected state.  The `state` field is just a
 * label for the filename — it does not affect navigation.
 *
 * Surfaces that require live data (e.g. a specific deckId) use a wildcard
 * route; the script navigates there and waits for the skeleton to resolve.
 */
type TSurface = {
  name: string;
  url: string;
  /** clip: true → fullPage:false (for surfaces with position:fixed elements) */
  clip?: boolean;
  /** auth: false → captured without a JWT in localStorage */
  auth?: false;
};

const ANON_SURFACES: TSurface[] = [
  { name: 'sign-in', url: '/sign-in', auth: false },
  { name: 'sign-up', url: '/sign-up', auth: false },
  { name: 'forgot-password', url: '/forgot-password', auth: false },
  // reset-password and check-your-email require a token query param — we
  // navigate to the base URL which renders the form in a "no-token" loading
  // state; sufficient for light-theme audit.
  { name: 'reset-password-no-token', url: '/reset-password', auth: false },
  { name: 'check-your-email', url: '/check-your-email', auth: false },
  // verify-email requires an active token: skip to avoid hanging on a real
  // verification round-trip.
];

const AUTH_SURFACES: TSurface[] = [
  // Onboarding wizard (returning user skips to add-cards; fresh user sees wizard)
  { name: 'onboarding', url: '/onboarding' },
  // Home
  { name: 'home', url: '/home' },
  // Decks — navigate to /home first to grab a real deck link; fallback below
  { name: 'deck-detail', url: '/home' /* resolved at runtime */ },
  // Library
  { name: 'library', url: '/library' },
  // Library csv sources
  { name: 'library-csv-sources', url: '/library-csv-sources' },
  // Reviews
  { name: 'reviews', url: '/reviews' },
  // Settings
  { name: 'settings', url: '/settings' },
  // Add cards — chooser
  { name: 'add-cards', url: '/add-cards' },
  // Add cards subviews
  { name: 'add-cards-manual', url: '/add-cards/manual' },
  { name: 'add-cards-csv', url: '/add-cards/csv' },
  { name: 'add-cards-fabrary', url: '/add-cards/fabrary' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ensure the output directory tree exists. */
async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/** Derive the output path for a capture. */
function capturePath(theme: string, viewport: string, name: string): string {
  return path.join(CAPTURES_DIR, theme, viewport, `${name}.png`);
}

/** Log a capture result line. */
function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

/** Wait a fixed number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Set the theme on the page by writing to document.documentElement.dataset.theme
 * and localStorage so the AuthProvider does not override it on the next
 * /auth/me response.
 */
async function setTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('rathe-arsenal:theme', t); } catch { /* ok */ }
  }, theme);
}

/**
 * Attempt to sign in through the UI and return the JWT from localStorage.
 * Falls back to the API route if the UI sign-in is unavailable.
 */
async function seedAuth(context: BrowserContext, email: string, pass: string): Promise<string | null> {
  const page = await context.newPage();
  try {
    // Use the API directly — faster than UI sign-in and avoids animation waits.
    const response = await page.evaluate(
      async ([url, e, p]) => {
        const res = await fetch(`${url}/api/auth/sign-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: e, password: p }),
        });
        if (!res.ok) return { ok: false, jwt: null };
        const body = await res.json() as { jwt: string };
        return { ok: true, jwt: body.jwt };
      },
      [BASE_URL, email, pass] as [string, string, string],
    );
    if (!response.ok || !response.jwt) {
      log(`  WARN  Could not sign in as ${email} — authenticated surfaces will be skipped.`);
      return null;
    }
    // Seed the JWT and a default theme into this browser context's storage.
    await page.evaluate(([jwt]) => {
      localStorage.setItem('rathe-arsenal:jwt', jwt);
    }, [response.jwt] as [string]);
    return response.jwt;
  } catch (err) {
    log(`  WARN  Sign-in request failed: ${(err as Error).message}`);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * Resolve a real deck-detail URL by scraping the first deck link from /home.
 * Returns null if the home page has no deck cards (empty collection).
 */
async function resolveDeckDetailUrl(page: Page): Promise<string | null> {
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
  await sleep(SETTLE_MS);
  // Look for the first link that starts with /decks/
  const href = await page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>('a[href^="/decks/"]');
    return link ? link.getAttribute('href') : null;
  });
  return href;
}

/**
 * Capture a single surface at the current theme/viewport combo.
 */
async function capture(
  page: Page,
  surface: TSurface,
  theme: 'dark' | 'light',
  viewport: { name: string; width: number; height: number },
  jwtAvailable: boolean,
  deckDetailUrl: string | null,
): Promise<void> {
  // Skip auth surfaces when no JWT is available.
  if (surface.auth !== false && !jwtAvailable) {
    log(`  SKIP  [${theme}/${viewport.name}] ${surface.name} — no JWT`);
    return;
  }

  let url = surface.url;

  // Resolve deck-detail URL at runtime.
  if (surface.name === 'deck-detail') {
    if (!deckDetailUrl) {
      log(`  SKIP  [${theme}/${viewport.name}] ${surface.name} — no deck link found on /home`);
      return;
    }
    url = deckDetailUrl;
  }

  const dest = capturePath(theme, viewport.name, surface.name);
  await ensureDir(path.dirname(dest));

  try {
    // Set theme before navigation so the inline script in index.html picks it
    // up from localStorage before React hydrates (avoids first-paint flash).
    await setTheme(page, theme);
    await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 15000 });
    // Re-apply theme after navigation in case the route reset it.
    await setTheme(page, theme);
    await sleep(SETTLE_MS);

    const fullPage = surface.clip !== true;
    await page.screenshot({ path: dest, fullPage });
    log(`  OK    [${theme}/${viewport.name}] ${surface.name} → ${path.relative(process.cwd(), dest)}`);
  } catch (err) {
    log(`  ERR   [${theme}/${viewport.name}] ${surface.name}: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log('\nRathe Arsenal — cross-surface screenshot capture (U2)');
  log('='.repeat(60));

  // Validate credentials before spinning up the browser.
  if (!FIXTURE_EMAIL) {
    log('\nERROR: FIXTURE_EMAIL env var is required.');
    log('  Set it to a verified account on the local dev server.');
    log('  Example: FIXTURE_EMAIL=audit@test.local pnpm tsx scripts/screenshot-all-surfaces.ts');
    log('  Or see docs/dev-fixtures.md for a seed command that creates a fresh user.');
    process.exit(1);
  }

  log(`\nConfig:`);
  log(`  BASE_URL: ${BASE_URL}`);
  log(`  Email:    ${FIXTURE_EMAIL}`);
  log(`  Output:   ${CAPTURES_DIR}`);
  log(`  Surfaces: ${ANON_SURFACES.length} anon + ${AUTH_SURFACES.length} auth`);
  log(`  Combos:   ${THEMES.length} themes × ${VIEWPORTS.length} viewports\n`);

  await ensureDir(CAPTURES_DIR);

  const browser = await chromium.launch({ headless: true });

  try {
    // Create a persistent context (shares localStorage across pages).
    const context = await browser.newContext({
      // Start at BASE_URL so the localStorage domain is correct.
      baseURL: BASE_URL,
      storageState: undefined,
    });

    // Seed a page visit so the localStorage domain is initialised.
    const seedPage = await context.newPage();
    await seedPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {
      log('\nERROR: Could not reach the dev server at ' + BASE_URL);
      log('  Make sure `pnpm dev` is running (api on :3000, web on :5173).');
      process.exit(1);
    });
    await seedPage.close();

    // Authenticate.
    const jwt = await seedAuth(context, FIXTURE_EMAIL, FIXTURE_PASS);
    const isAuthed = !!jwt;

    // Walk each theme × viewport.
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        log(`\n--- ${theme.toUpperCase()} / ${viewport.name} (${viewport.width}x${viewport.height}) ---`);

        const page = await context.newPage();
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        // Seed JWT into this page's localStorage.
        if (isAuthed && jwt) {
          await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
          await page.evaluate(([t]) => {
            localStorage.setItem('rathe-arsenal:jwt', t);
          }, [jwt] as [string]);
        }

        // Resolve deck-detail URL once per theme/viewport combo.
        let deckDetailUrl: string | null = null;
        if (isAuthed) {
          deckDetailUrl = await resolveDeckDetailUrl(page);
          if (deckDetailUrl) {
            log(`  Deck link: ${deckDetailUrl}`);
          }
        }

        // Capture anonymous surfaces.
        for (const surface of ANON_SURFACES) {
          await capture(page, surface, theme, viewport, isAuthed, deckDetailUrl);
        }

        // Capture authenticated surfaces.
        for (const surface of AUTH_SURFACES) {
          await capture(page, surface, theme, viewport, isAuthed, deckDetailUrl);
        }

        await page.close();
      }
    }

    log('\n' + '='.repeat(60));
    log(`Done. Review captures in:\n  ${CAPTURES_DIR}`);
    log('\nLight-theme verification checklist:');
    log('  [ ] No invisible or clipped text (fg on bg must be readable)');
    log('  [ ] No black boxes on parchment backgrounds (dark rgba leakage)');
    log('  [ ] Borders visible (not merged with background)');
    log('  [ ] Accent elements (brass links, buttons) clearly distinguished');
    log('  [ ] Skeleton pulses and spinners visible');

  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
