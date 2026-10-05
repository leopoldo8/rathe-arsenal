/**
 * E2E for card alternatives: open Alternatives from a missing row, pick the
 * first card, see the "in place of" mark on the deck list, then undo it and
 * find the original back in the missing panel.
 *
 * PREREQUISITES: dev server up (api :3000, web :5173); `pnpm seed:fixture`
 * (Playwright's globalSetup runs it) provides the swap deck whose three missing
 * cards are the rows this flow starts from.
 */
import { test, expect } from '@playwright/test';
import { BASE_URL, pinPortuguese } from './swaps-helpers';
import { loadFixture, resetFixture } from '../support/fixture';

test.describe('Card alternatives — E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetFixture();
    await pinPortuguese(page);
  });

  test.afterAll(async () => {
    await resetFixture();
  });

  test('pick an alternative and undo it', async ({ page }) => {
    await page.goto(`${BASE_URL}/decks/${loadFixture().swapDeckId}`, { waitUntil: 'networkidle', timeout: 20000 });
    const missingRows = page.getByTestId('deck-missing-panel').getByTestId('missing-row');
    await expect(missingRows.first()).toBeVisible();
    const control = missingRows.first().getByRole('button', { name: /^Ver alternativas para / });
    const originalName = ((await control.getAttribute('aria-label')) ?? '').replace('Ver alternativas para ', '');
    expect(originalName).not.toBe('');

    await control.click();

    const sheet = page.getByTestId('alternatives-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId(/^alternatives-group-/).first()).toBeVisible();
    // A card the owner does not have, so the picked card is missing and shows in the missing panel too.
    const unowned = sheet.getByTestId('alternative-card').filter({ has: page.getByText(/livres?$/) }).first();
    await expect(unowned).toBeVisible();
    await unowned.getByRole('button', { name: /^Usar / }).click();

    await expect(sheet).toBeHidden();
    const mark = page.getByTestId('deck-list').getByTestId('replacement-mark');
    await expect(mark).toHaveCount(1);
    await expect(mark).toContainText('no lugar de');
    await expect(page.getByTestId('deck-list')).toContainText('Desfazer');
    await expect(page.getByTestId('deck-missing-panel').getByTestId('replacement-mark')).toHaveCount(1);
    await expect(page.getByTestId('deck-missing-panel').getByTestId('replacement-mark')).toContainText('no lugar de');

    await page.getByTestId('deck-list').getByRole('button', { name: /^Desfazer a troca de / }).click();

    await expect(page.getByTestId('replacement-mark')).toHaveCount(0);
    await expect(page.getByTestId('deck-missing-panel')).toContainText(originalName);
  });
});
