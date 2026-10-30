/** Where the "Alternativas" panel sits on the missing list (type 4A): docked, over the list, or a bottom sheet. */
import { test, expect, type Page } from '@playwright/test';
import { pinPortuguese } from './helpers';
import { loadFixture } from '../support/fixture';
import { stubMissingList } from '../support/missing-list-stubs';

const OPEN_NAME = 'Ver alternativas para Alpha Rampage (Vermelho)';
const PANEL_WIDTH = 480;

async function openList(page: Page): Promise<void> {
  await pinPortuguese(page);
  await stubMissingList(page);
  await page.route('**/api/decks/*/alternatives*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ needed: 1, groups: [] }) }),
  );
  await page.goto(`/decks/${loadFixture().readyDeckId}/missing`, { waitUntil: 'networkidle' });
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
}

test.describe('Alternativas panel, docked at 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('sits between the top bar and the footer, narrows the list and does not dim the page', async ({ page }) => {
    await openList(page);
    const list = page.getByTestId('missing-list-page');
    const listBefore = (await list.boundingBox())!;

    const trigger = page.getByRole('button', { name: OPEN_NAME });
    await trigger.click();
    const panel = page.getByTestId('alternatives-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('alternatives-sheet')).toHaveCount(0);

    const box = (await panel.boundingBox())!;
    expect(Math.round(box.width), 'panel width').toBe(PANEL_WIDTH);
    const topBar = (await page.locator('header').first().boundingBox())!;
    expect(box.y, 'below the top bar').toBeGreaterThanOrEqual(topBar.y + topBar.height - 1);
    const footer = (await page.locator('footer').first().boundingBox())!;
    expect(box.y + box.height, 'above the footer').toBeLessThanOrEqual(footer.y + 1);

    const listAfter = (await list.boundingBox())!;
    expect(listAfter.width, 'the list narrows').toBeLessThan(listBefore.width);
    expect(listAfter.x + listAfter.width, 'the list ends before the panel').toBeLessThanOrEqual(box.x + 1);

    // Not dimmed and not modal: the rest of the page still takes clicks.
    await page.getByRole('button', { name: 'Copiar lista de compras' }).click();
    await expect(panel).toBeVisible();

    const row = page.getByTestId('missing-row').filter({ hasText: 'Alpha Rampage' });
    await expect(row).toHaveAttribute('data-alternatives-open', 'true');
    await noSidewaysScroll(page);
  });

  test('moves focus in, closes on Escape and returns focus to the card', async ({ page }) => {
    await openList(page);
    const trigger = page.getByRole('button', { name: OPEN_NAME });
    await trigger.click();
    const panel = page.getByTestId('alternatives-panel');
    await expect.poll(async () => panel.evaluate((node) => node.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

test.describe('Alternativas panel, over the list at 1024', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('covers the right side of the list as a 480 px panel', async ({ page }) => {
    await openList(page);
    await page.getByRole('button', { name: OPEN_NAME }).click();

    const sheet = page.getByTestId('alternatives-sheet');
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('alternatives-panel')).toHaveCount(0);
    const box = (await sheet.boundingBox())!;
    expect(Math.round(box.width), 'panel width').toBe(PANEL_WIDTH);
    expect(Math.round(box.x + box.width), 'flush with the right edge').toBe(1024);

    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await noSidewaysScroll(page);
  });
});

test.describe('Alternativas panel, bottom sheet at 390', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('stays a sheet stuck to the bottom of the screen', async ({ page }) => {
    await openList(page);
    await page.getByRole('button', { name: OPEN_NAME }).click();

    const sheet = page.getByTestId('alternatives-sheet');
    await expect(sheet).toBeVisible();
    const box = (await sheet.boundingBox())!;
    expect(Math.round(box.x), 'full width, left edge').toBe(0);
    expect(Math.round(box.width), 'full width').toBe(390);
    expect(Math.round(box.y + box.height), 'bottom edge').toBe(844);
    expect(box.y, 'a sheet, not a full screen page').toBeGreaterThan(0);
    await noSidewaysScroll(page);
  });
});
