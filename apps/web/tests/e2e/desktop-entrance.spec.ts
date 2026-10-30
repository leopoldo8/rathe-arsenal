/**
 * The signed-out entrance on a computer (screen `a3-entrance-desktop` of `.design/account.md`): the art panel
 * beside the form from 720 px wide, "Sobre" at the right edge of the notice, and no sideways scroll.
 */
import { test, expect } from '@playwright/test';
import { ANON_STORAGE_STATE } from '../support/fixture';

test.use({ storageState: ANON_STORAGE_STATE });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
});

for (const width of [1440, 1024]) {
  test(`the entrance has the art panel and "Sobre" at the right edge at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/entrar');

    await expect(page.getByText('Seus decks, sua coleção.')).toBeVisible();
    await expect(page.getByTestId('deckbox')).toBeVisible();
    await expect(page.getByLabel('Seu e-mail')).toBeVisible();

    const link = await page.getByRole('link', { name: 'Sobre' }).boundingBox();
    expect(link).not.toBeNull();
    expect(width - (link!.x + link!.width)).toBeLessThan(40);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('a phone keeps the one-column card, with no art panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/entrar');

  await expect(page.getByLabel('Seu e-mail')).toBeVisible();
  await expect(page.getByTestId('deckbox')).toHaveCount(0);
});
