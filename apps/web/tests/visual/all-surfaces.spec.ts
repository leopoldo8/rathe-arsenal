/**
 * Visual regression baselines, dark theme, 1440x900, one per primary surface.
 *
 * Update baselines (intentional redesign): pnpm test:visual:update
 * Procedure: docs/design/v1/visual-regression.md
 *
 * Authentication and fixture data come from tests/support/global-setup.ts
 * (shared storageState, seeded fixture user). Anonymous surfaces override the
 * storageState so they render signed out.
 */

import { test, expect, type Locator, type Page } from '@playwright/test';
import { ANON_STORAGE_STATE, BASE_URL, loadFixture, resetFixture } from '../support/fixture';

const SETTLE_MS = 1500;

const ANON_SURFACES = [
  { name: 'sign-in', url: '/sign-in' },
  { name: 'sign-up', url: '/sign-up' },
  { name: 'forgot-password', url: '/forgot-password' },
  { name: 'reset-password', url: '/reset-password' },
  { name: 'check-your-email', url: '/check-your-email' },
  { name: 'verify-email', url: '/verify-email' },
] as const;

const AUTH_SURFACES = [
  { name: 'onboarding', url: '/onboarding' },
  { name: 'home', url: '/home' },
  { name: 'deck-detail', url: '/decks/:deckId' },
  { name: 'library', url: '/library' },
  { name: 'library-csv-sources', url: '/library-csv-sources' },
  { name: 'swaps', url: '/swaps' },
  { name: 'settings', url: '/settings' },
  { name: 'add-cards', url: '/add-cards' },
  { name: 'add-cards-manual', url: '/add-cards/manual' },
  { name: 'add-cards-csv', url: '/add-cards/csv' },
  { name: 'add-cards-fabrary', url: '/add-cards/fabrary' },
  { name: 'decks-new', url: '/decks/new' },
  { name: 'deck-detail-edit', url: '/decks/:deckId?edit=1' },
  { name: 'deck-edit', url: '/decks/:deckId/edit' },
  { name: 'home-mixed', url: '/home' },
  { name: 'home-tag-filter', url: '/home' },
  { name: 'home-retired-collapsed', url: '/home' },
] as const;

const DECK_ROUTE_READY_TESTIDS: Readonly<Record<string, string>> = {
  'deck-detail': 'deck-detail-view',
  'deck-detail-edit': 'deck-canvas-edit',
  'deck-edit': 'deck-edit-panel',
};

async function applyDarkTheme(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.dataset['theme'] = 'dark';
  });
}

async function openSurface(page: Page, url: string): Promise<void> {
  await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 20000 });
  await applyDarkTheme(page);
  await page.waitForTimeout(SETTLE_MS);
}

async function snapshot(page: Page, name: string, mask: readonly Locator[] = []): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    maxDiffPixelRatio: 0.01,
    mask: [...mask],
  });
}

function timeDependentRegions(page: Page): Locator[] {
  return [page.getByTestId('relative-time'), page.getByTestId('price-freshness')];
}

test.describe('Visual regression — dark desktop 1440x900 (U8)', () => {
  test.beforeAll(async () => {
    await resetFixture();
  });

  test.describe('anonymous', () => {
    test.use({ storageState: ANON_STORAGE_STATE });

    for (const surface of ANON_SURFACES) {
      test(`anon: ${surface.name}`, async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('rathe-arsenal:theme', 'dark'));
        await openSurface(page, surface.url);
        await snapshot(page, surface.name);
      });
    }
  });

  for (const surface of AUTH_SURFACES) {
    test(`auth: ${surface.name}`, async ({ page }) => {
      const url = surface.url.replace(':deckId', String(loadFixture().readyDeckId));

      if (surface.name === 'onboarding') {
        await page.route('**/api/decks', (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ trackedDecks: [] }),
          }),
        );
      }

      await openSurface(page, url);

      const readyTestId = DECK_ROUTE_READY_TESTIDS[surface.name];
      if (readyTestId) await expect(page.getByTestId(readyTestId)).toBeVisible();

      if (surface.name === 'home-tag-filter') {
        const pill = page
          .getByRole('group', { name: 'Filter by tag' })
          .getByRole('button', { name: /^Filter by tag:/ })
          .first();
        await pill.click();
        await expect(pill).toHaveAttribute('aria-pressed', 'true');
        await page.waitForTimeout(SETTLE_MS);
      }

      await snapshot(page, surface.name, timeDependentRegions(page));
    });
  }
});
