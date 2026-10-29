/**
 * E2E for card alternatives (card alternatives, PRs #130 and #143, and the persona-rethink release, PR #181):
 * open Alternativas from a row of the missing list, pick the first candidate, see the "in place of" mark on
 * the deck list, then undo it and find the original card back in the missing list.
 *
 * PREREQUISITES: dev server up (api :3000, web :5173); `pnpm seed:fixture`
 * (Playwright's globalSetup runs it) provides the swap deck whose missing cards are the rows this flow starts from.
 */
import { test, expect } from '@playwright/test';
import { BASE_URL, pinPortuguese } from './helpers';
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
    const deckId = loadFixture().swapDeckId;
    await page.goto(`${BASE_URL}/decks/${deckId}/missing`, { waitUntil: 'networkidle', timeout: 20000 });
    const missingRows = page.getByTestId('missing-list-page').getByTestId('missing-row');
    await expect(missingRows.first()).toBeVisible();
    const control = missingRows.first().getByRole('button', { name: /^Ver alternativas para / });
    const originalName = ((await control.getAttribute('aria-label')) ?? '').replace('Ver alternativas para ', '');
    expect(originalName).not.toBe('');

    await control.click();

    const sheet = page.getByTestId('alternatives-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId(/^alternatives-group-/).first()).toBeVisible();
    // A card the owner does not have, so the picked card is missing and shows in the missing list too.
    const unowned = sheet.getByTestId('alternative-card').filter({ has: page.getByText(/livres?$/) }).first();
    await expect(unowned).toBeVisible();
    await unowned.getByRole('button', { name: /^Usar / }).click();
    await expect(sheet).toBeHidden();

    await page.goto(`${BASE_URL}/decks/${deckId}`, { waitUntil: 'networkidle', timeout: 20000 });
    const mark = page.getByTestId('deck-list').getByTestId('replacement-mark');
    await expect(mark).toHaveCount(1);
    await expect(mark).toContainText('no lugar de');
    await expect(page.getByTestId('deck-list')).toContainText('Desfazer');

    await page.getByTestId('deck-list').getByRole('button', { name: /^Desfazer a troca de / }).click();
    await expect(page.getByTestId('replacement-mark')).toHaveCount(0);

    await page.goto(`${BASE_URL}/decks/${deckId}/missing`, { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.getByTestId('missing-list-page')).toContainText(originalName);
  });

  test('the first candidate takes the place of the row card, and undoing it brings that row back', async ({ page }) => {
    const deckId = loadFixture().swapDeckId;
    await page.goto(`${BASE_URL}/decks/${deckId}/missing`, { waitUntil: 'networkidle', timeout: 20000 });
    const missingRows = page.getByTestId('missing-list-page').getByTestId('missing-row');
    await expect(missingRows.first()).toBeVisible();
    const control = missingRows.first().getByRole('button', { name: /^Ver alternativas para / });
    const originalName = ((await control.getAttribute('aria-label')) ?? '').replace('Ver alternativas para ', '');
    expect(originalName).not.toBe('');

    await control.click();
    const sheet = page.getByTestId('alternatives-sheet');
    await expect(sheet.getByTestId(/^alternatives-group-/).first()).toBeVisible();
    // The very first candidate of the sheet, whatever its owned tag says.
    const first = sheet.getByTestId('alternative-card').first();
    const pick = first.getByRole('button', { name: /^Usar / });
    const candidateName = ((await pick.getAttribute('aria-label')) ?? '').replace(/^Usar /, '').replace(/ no lugar de .*/, '');
    expect(candidateName).not.toBe('');
    await pick.click();
    await expect(sheet).toBeHidden();

    await page.goto(`${BASE_URL}/decks/${deckId}`, { waitUntil: 'networkidle', timeout: 20000 });
    const mark = page.getByTestId('deck-list').getByTestId('replacement-mark');
    await expect(mark).toHaveCount(1);
    await expect(mark).toHaveText(new RegExp(`^no lugar de ${originalName.replace(/[()]/g, '\\$&')}`));

    await page.getByTestId('deck-list').getByRole('button', { name: /^Desfazer a troca de / }).click();
    await expect(page.getByTestId('replacement-mark')).toHaveCount(0);

    await page.goto(`${BASE_URL}/decks/${deckId}/missing`, { waitUntil: 'networkidle', timeout: 20000 });
    await expect(
      page.getByTestId('missing-list-page').getByTestId('missing-row').getByRole('button', { name: `Ver alternativas para ${originalName}` }),
    ).toHaveCount(1);
  });
});
