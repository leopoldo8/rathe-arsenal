import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { describeViolations } from '../support/axe';
import { BASE_URL } from './helpers';

const TEN_DAYS_IN_MS = 10 * 24 * 60 * 60 * 1000;

/** The library answer with its price date pushed past the freshness threshold, whatever the local prices are. */
async function stubStalePrices(page: Page): Promise<void> {
  await page.route('**/api/collection/library*', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { stats: Record<string, unknown> };
    const stats = {
      ...body.stats,
      estimatedValueCents: 12345,
      priceDataLastUpdatedAt: new Date(Date.now() - TEN_DAYS_IN_MS).toISOString(),
    };
    await route.fulfill({ response, json: { ...body, stats } });
  });
}

/** The signed-in user's saved theme wins over the browser's, so the stub carries the theme under test. */
async function stubTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.route('**/api/auth/me', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const body = (await response.json()) as { settings?: Record<string, unknown> };
    return route.fulfill({ response, json: { ...body, settings: { ...body.settings, theme } } });
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`the stale price label passes the axe color-contrast rule in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
    await stubTheme(page, theme);
    await stubStalePrices(page);

    await page.goto(`${BASE_URL}/library`, { waitUntil: 'networkidle', timeout: 20000 });
    const label = page.getByTestId('price-freshness');
    await expect(label).toContainText('10');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    const { violations } = await new AxeBuilder({ page }).include('[data-testid="price-freshness"]').withRules(['color-contrast']).analyze();

    expect(describeViolations(violations)).toEqual([]);
  });
}
