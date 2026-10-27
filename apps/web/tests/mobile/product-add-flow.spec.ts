/**
 * The "Comprei um deck pronto" path at phone width (`r3-product-search-phone`, `r3-product-confirm-phone`):
 * the same journey as `tests/e2e/product-add-flow.spec.ts`, run by the 360 and 390 px projects.
 */
import { test, expect } from '@playwright/test';
import { pinPortuguese } from '../e2e/helpers';

test.describe('Add a ready-made deck - phone', () => {
  test('choosing Kayo shows the confirm screen of the box', async ({ page }) => {
    await pinPortuguese(page);
    await page.goto('/add-cards', { waitUntil: 'networkidle' });

    await page.getByRole('link', { name: /^Comprei um deck pronto/ }).click();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.getByRole('link', { name: /Kayo/ }).first().click();

    await expect(page).toHaveURL(/\/add-cards\/product\/.+/);
    await expect(page.getByRole('heading', { level: 1, name: /^Armory Deck: Kayo · \d+ cartas$/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Escolher outro/ })).toBeVisible();
    const add = page.getByRole('button', { name: 'Adicionar', exact: true });
    await expect(add).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
    const viewport = page.viewportSize()!;
    const box = (await add.boundingBox())!;
    expect(box.x, 'Adicionar: left edge').toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, 'Adicionar: right edge').toBeLessThanOrEqual(viewport.width);
  });
});
