/**
 * The "Comprei um deck pronto" path (`r3-add-phone`, `r3-product-search-phone`, `r3-product-confirm-phone`):
 * from "Adicionar cartas", through the product list, to the confirm screen of the picked box.
 */
import { test, expect } from '@playwright/test';
import { pinPortuguese } from './helpers';

test.describe('Add a ready-made deck - E2E', () => {
  test('choosing Kayo shows the confirm screen of the box', async ({ page }) => {
    await pinPortuguese(page);
    await page.goto('/add-cards', { waitUntil: 'networkidle' });

    await page.getByRole('link', { name: /^Comprei um deck pronto/ }).click();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.getByRole('link', { name: /Kayo/ }).first().click();

    await expect(page).toHaveURL(/\/add-cards\/product\/.+/);
    await expect(page.getByRole('heading', { level: 1, name: /^Armory Deck: Kayo · \d+ cartas$/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Escolher outro/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adicionar', exact: true })).toBeVisible();
  });
});
