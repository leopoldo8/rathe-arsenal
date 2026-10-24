/**
 * Mobile layout regression, run at 360x740 and 390x844 (see the `mobile-*`
 * projects in playwright.config.ts).
 *
 * For every main route it asserts, on first load and without scrolling:
 *  - the page does not scroll horizontally;
 *  - the visual viewport is not zoomed out (an overflowing page makes mobile
 *    browsers shrink it, which is what pushes the fixed tab bar off screen);
 *  - the bottom tab bar lies fully inside the visual viewport and its tabs are
 *    at least 44px tall;
 *  - the top bar fits the viewport width.
 */

import { test, expect, type Page } from '@playwright/test';
import { ANON_STORAGE_STATE, BASE_URL, loadFixture, resetFixture } from '../support/fixture';

const SETTLE_MS = 1000;
const MIN_TAP_TARGET_PX = 44;
// Home, library and lists; the tutor tab only shows for users with chat access.
const EXPECTED_TAB_COUNT = 3;
const SUBPIXEL_PX = 1;

interface IRoute {
  readonly name: string;
  readonly url: string;
  /** Rendered inside the authenticated shell (top bar + bottom tab bar). */
  readonly shell: boolean;
  readonly anonymous?: boolean;
}

const ROUTES: readonly IRoute[] = [
  { name: 'start', url: '/entrar', shell: false, anonymous: true },
  { name: 'about', url: '/about', shell: false, anonymous: true },
  { name: 'home', url: '/home', shell: true },
  { name: 'deck-detail', url: '/decks/:deckId', shell: true },
  { name: 'deck-edit', url: '/decks/:deckId/edit', shell: true },
  { name: 'decks-new', url: '/decks/new', shell: true },
  { name: 'library', url: '/library', shell: true },
  { name: 'library-csv-sources', url: '/library-csv-sources', shell: true },
  { name: 'settings', url: '/settings', shell: true },
  { name: 'add-cards', url: '/add-cards', shell: true },
  { name: 'add-cards-manual', url: '/add-cards/manual', shell: true },
  { name: 'add-cards-csv', url: '/add-cards/csv', shell: true },
  { name: 'add-cards-fabrary', url: '/add-cards/fabrary', shell: true },
  { name: 'add-cards-scan', url: '/add-cards/scan', shell: false },
];

interface ILayoutReport {
  readonly innerWidth: number;
  readonly scrollWidth: number;
  readonly viewportScale: number;
  readonly viewportHeight: number;
  readonly header: { readonly left: number; readonly right: number } | null;
  readonly headerOverflow: readonly string[];
  readonly tabBar: { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number } | null;
  readonly tabHeights: readonly number[];
  readonly offenders: readonly string[];
}

async function measureLayout(page: Page): Promise<ILayoutReport> {
  return page.evaluate(() => {
    const vv = window.visualViewport;
    // innerWidth grows with overflowing content on mobile, so the visual
    // viewport is the only trustworthy measure of the screen.
    const screenWidth = vv?.width ?? window.innerWidth;
    const header = document.querySelector('header');
    const headerRect = header?.getBoundingClientRect();
    const headerOverflow: string[] = [];
    header?.querySelectorAll('*').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && (rect.right > screenWidth + 1 || rect.left < -1)) {
        headerOverflow.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(rect.right)}`);
      }
    });
    const nav = document.querySelector('nav[aria-label][class*="nav"]:not(header nav)');
    const navRect = nav?.getBoundingClientRect();
    const offenders: string[] = [];
    document.querySelectorAll('body *').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > screenWidth + 1 && offenders.length < 8) {
        offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} right=${Math.round(rect.right)}`);
      }
    });
    return {
      innerWidth: screenWidth,
      scrollWidth: document.documentElement.scrollWidth,
      viewportScale: vv?.scale ?? 1,
      viewportHeight: vv?.height ?? window.innerHeight,
      header: headerRect ? { left: headerRect.left, right: headerRect.right } : null,
      headerOverflow,
      tabBar: navRect
        ? { top: navRect.top, bottom: navRect.bottom, left: navRect.left, right: navRect.right }
        : null,
      tabHeights: nav ? Array.from(nav.querySelectorAll('a')).map((a) => a.getBoundingClientRect().height) : [],
      offenders,
    };
  });
}

// Worst realistic top bar: a long address and the price-queue pill showing.
const LONG_EMAIL = 'rodrigo.rosa.haertel.2022@example-university.edu.br';

async function mockWorstCaseTopBar(page: Page): Promise<void> {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'mobile-layout', email: LONG_EMAIL, role: 'user', settings: { theme: 'dark' } }),
    }),
  );
  await page.route('**/api/variant-jobs', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        etaSeconds: 30,
        jobs: [{ jobId: 'j1', deckId: 1, deckName: 'Deck', status: 'running', total: 10, completed: 3, failed: 0 }],
      }),
    }),
  );
}

async function openRoute(page: Page, url: string, anonymous = false): Promise<void> {
  if (!anonymous) await mockWorstCaseTopBar(page);
  await page.route('**/api/decks/*/recommendations', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ run: null, pending: false, failure: null, recommendations: [] }),
    }),
  );
  await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(SETTLE_MS);
}

test.describe('mobile layout', () => {
  test.beforeAll(async () => {
    await resetFixture();
  });

  for (const route of ROUTES) {
    test.describe(route.name, () => {
      if (route.anonymous) test.use({ storageState: ANON_STORAGE_STATE });

      test('fits the viewport without horizontal scroll', async ({ page }) => {
        await openRoute(page, route.url.replace(':deckId', String(loadFixture().readyDeckId)), route.anonymous);
        const report = await measureLayout(page);

        expect(report.scrollWidth, `offenders: ${report.offenders.join(' | ')}`).toBeLessThanOrEqual(
          report.innerWidth,
        );
        expect(report.viewportScale, 'visual viewport is zoomed out by an overflowing element').toBeCloseTo(1, 2);
      });

      if (route.shell) {
        test('keeps top bar and bottom tab bar on screen', async ({ page }) => {
          await openRoute(page, route.url.replace(':deckId', String(loadFixture().readyDeckId)));
          const report = await measureLayout(page);

          expect(report.header, 'top bar is rendered').not.toBeNull();
          expect(report.header!.right).toBeLessThanOrEqual(report.innerWidth + SUBPIXEL_PX);
          expect(report.headerOverflow, 'top bar children past the right edge').toEqual([]);

          expect(report.tabBar, 'bottom tab bar is rendered').not.toBeNull();
          expect(report.tabBar!.top).toBeGreaterThanOrEqual(0);
          expect(report.tabBar!.bottom).toBeLessThanOrEqual(report.viewportHeight + SUBPIXEL_PX);
          expect(report.tabBar!.right).toBeLessThanOrEqual(report.innerWidth + SUBPIXEL_PX);
          expect(report.tabHeights.length).toBe(EXPECTED_TAB_COUNT);
          for (const height of report.tabHeights) {
            expect(height).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
          }
        });
      }
    });
  }
});
