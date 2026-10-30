/**
 * The pages that are full screen on a phone ("Sobrando" and the resolver behind "Resolver") get the app shell
 * from 720 px, tab bar included until 960 px, and keep their state when the width crosses that line.
 */
import { test, expect, type Page } from '@playwright/test';
import { ANON_STORAGE_STATE } from '../support/fixture';
import { openPendingResolver } from '../support/pending-account';
import { openSparePageWithCards } from '../support/spare-account';

test.use({ storageState: ANON_STORAGE_STATE });

const TAB_BAR_NAME = 'Navegação principal';

async function noSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
}

async function expectShell(page: Page): Promise<void> {
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation', { name: TAB_BAR_NAME })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
}

/** With the page scrolled to its end, the footer's text ends above the tab bar instead of sitting behind it. */
async function expectFooterAboveTabBar(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const tabBar = (await page.getByRole('navigation', { name: TAB_BAR_NAME }).boundingBox())!;
  const lastLine = (await page.getByRole('contentinfo').locator('p, a').last().boundingBox())!;
  expect(lastLine.y + lastLine.height, 'the footer text ends above the tab bar').toBeLessThanOrEqual(tabBar.y + 1);
}

test.describe('at 800 px', () => {
  test.use({ viewport: { width: 800, height: 600 } });

  test('/spare has the top bar, the tab bar and the footer, and the sell bar stays above the tab bar', async ({ page, context }) => {
    const api = await openSparePageWithCards(page, context);
    await expectShell(page);
    await noSidewaysScroll(page);

    await page.getByTestId('spare-row').first().getByRole('button', { name: /^Mais uma cópia/ }).click();
    const tabBar = (await page.getByRole('navigation', { name: TAB_BAR_NAME }).boundingBox())!;
    const bar = (await page.getByTestId('spare-bar').boundingBox())!;
    expect(bar.y + bar.height, 'the sell bar ends above the tab bar').toBeLessThanOrEqual(tabBar.y + 1);
    await expect(page.getByTestId('spare-bar').getByRole('button').last()).toBeVisible();

    // Nothing from the list shows through the bar: the topmost thing along its right edge belongs to the bar.
    const coveredBy = await page.evaluate(({ x, ys }) => ys.map((y) => document.elementFromPoint(x, y)?.closest('[data-testid="spare-bar"]') !== null), {
      x: bar.x + bar.width - 40,
      ys: [bar.y + 4, bar.y + bar.height / 2, bar.y + bar.height - 4],
    });
    expect(coveredBy, 'the list does not paint over the sell bar').toEqual([true, true, true]);

    await expectFooterAboveTabBar(page);
    await api.dispose();
  });

  test('/library-pending has the top bar, the tab bar and the footer', async ({ page, context }) => {
    await openPendingResolver(page, context);
    await expectShell(page);
    await noSidewaysScroll(page);
    await expectFooterAboveTabBar(page);
  });

  test('/spare keeps the chosen quantities when the width crosses the shell breakpoint', async ({ page, context }) => {
    const api = await openSparePageWithCards(page, context);
    const first = page.getByTestId('spare-row').first();
    const more = first.getByRole('button', { name: /^Mais uma cópia/ });
    await more.click();
    await more.click();
    await expect(first.locator('output')).toHaveText('2');

    await page.setViewportSize({ width: 600, height: 800 });
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: TAB_BAR_NAME })).toHaveCount(0);
    await expect(page.getByTestId('spare-row').first().locator('output')).toHaveText('2');

    await page.setViewportSize({ width: 1000, height: 800 });
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByTestId('spare-row').first().locator('output')).toHaveText('2');
    await api.dispose();
  });
});

test.describe('at 719 px', () => {
  test.use({ viewport: { width: 719, height: 800 } });

  test('/spare and /library-pending stay full screen', async ({ page, context }) => {
    const api = await openSparePageWithCards(page, context);
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: TAB_BAR_NAME })).toHaveCount(0);
    await api.dispose();

    await openPendingResolver(page, context);
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: TAB_BAR_NAME })).toHaveCount(0);
  });
});
