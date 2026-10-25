/**
 * E2E for the suggestions that replaced swaps: use one from the missing list, use
 * every one from the status strip, and find the old swaps addresses gone.
 *
 * PREREQUISITES: dev servers up; `pnpm seed:fixture` (Playwright's globalSetup
 * runs it) provides the swap deck, whose three missing cards each have a
 * suggestion from the fixture user's collection.
 */
import { test, expect } from '@playwright/test';
import { BASE_URL, pinPortuguese } from './helpers';
import { loadFixture, resetFixture } from '../support/fixture';

test.describe('Suggestions from the collection — E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetFixture();
    await pinPortuguese(page);
  });

  test.afterAll(async () => {
    await resetFixture();
  });

  test("Usar on a missing row uses the collection's card", async ({ page }) => {
    const deckId = loadFixture().swapDeckId;
    await page.goto(`${BASE_URL}/decks/${deckId}/missing`, { waitUntil: 'networkidle', timeout: 20000 });
    const standIn = page.getByTestId('missing-stand-in').first();
    await expect(standIn).toBeVisible();
    const use = standIn.getByRole('button', { name: /^Usar .+ no lugar de / });
    const original = ((await use.getAttribute('aria-label')) ?? '').replace(/^Usar .+ no lugar de /, '');
    expect(original).not.toBe('');

    await use.click();

    await expect(page.getByTestId('missing-stand-in').filter({ hasText: 'Você vai usar' }).first()).toBeVisible();
    await page.goto(`${BASE_URL}/decks/${deckId}`, { waitUntil: 'networkidle', timeout: 20000 });
    const mark = page.getByTestId('deck-list').getByTestId('replacement-mark');
    await expect(mark).toHaveCount(1);
    await expect(mark).toContainText('no lugar de');
    await expect(mark).toContainText(original);
  });

  test('Usar as N uses every suggestion', async ({ page }) => {
    await page.goto(`${BASE_URL}/decks/${loadFixture().swapDeckId}`, { waitUntil: 'networkidle', timeout: 20000 });
    const strip = page.getByTestId('deck-status-strip');
    await expect(strip).toContainText('Dá para cobrir 3 cartas com a sua coleção');

    await strip.getByRole('button', { name: 'Usar as 3' }).click();

    await expect(page.getByTestId('deck-list').getByTestId('replacement-mark')).toHaveCount(3);
    await expect(strip.getByTestId('strip-use-suggestions')).toHaveCount(0);
  });

  test('the swaps addresses lead home', async ({ page }) => {
    for (const address of ['/swaps', '/reviews']) {
      await page.goto(`${BASE_URL}${address}`, { waitUntil: 'networkidle', timeout: 20000 });
      await expect(page).toHaveURL(/\/home(\?|$)/);
    }
    await expect(page.getByRole('link', { name: 'Trocas' })).toHaveCount(0);
  });
});
