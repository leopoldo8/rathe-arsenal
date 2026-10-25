import { test, expect, type Page } from '@playwright/test';
import { loadFixture, resetFixture } from '../support/fixture';
import { openCompositionEditor } from '../support/pages';

const SHEET_MIN_RATIO = 0.4;
const SHEET_MAX_RATIO = 0.5;

async function viewportHeight(page: Page): Promise<number> {
  return page.evaluate(() => window.visualViewport?.height ?? window.innerHeight);
}

test.describe('the rules bar of the deck editor', () => {
  test.beforeAll(async () => {
    await resetFixture();
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
    await openCompositionEditor(page, loadFixture().readyDeckId);
    await expect(page.getByTestId('rules-bar')).toBeVisible();
  });

  test('the rules bar stays visible while scrolling', async ({ page }) => {
    await page.locator('[data-testid^="editable-card-row-"]').last().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const bar = page.getByTestId('rules-bar');

    const box = await bar.boundingBox();
    const height = await viewportHeight(page);

    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    const coveredBy = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-testid="rules-bar"]') !== null,
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    );
    expect(coveredBy, 'nothing else is drawn over the bar').toBe(true);
  });

  test('the checklist sheet opens at about half height and closes only by handle or Fechar', async ({ page }) => {
    await page.locator('[data-testid^="editable-card-row-"]').nth(3).scrollIntoViewIfNeeded();
    await page.getByTestId('rules-bar').click();
    const sheet = page.getByTestId('rules-checklist-sheet');
    await expect(sheet).toBeVisible();
    const height = await viewportHeight(page);

    const box = await sheet.boundingBox();
    expect(box!.height / height).toBeGreaterThanOrEqual(SHEET_MIN_RATIO);
    expect(box!.height / height).toBeLessThanOrEqual(SHEET_MAX_RATIO);
    const rowsAboveTheSheet = await page.evaluate((sheetTop) => {
      const rows = Array.from(document.querySelectorAll('[data-testid^="editable-card-row-"]'));
      return rows.filter((row) => {
        const rect = row.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= sheetTop;
      }).length;
    }, box!.y);
    expect(rowsAboveTheSheet, 'the list stays visible above the sheet').toBeGreaterThan(0);

    await page.mouse.wheel(0, 300);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeVisible();

    await page.getByTestId('rules-sheet-handle').click();
    await expect(sheet).toBeHidden();

    await page.getByTestId('rules-bar').click();
    await expect(sheet).toBeVisible();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(sheet).toBeHidden();
  });
});
