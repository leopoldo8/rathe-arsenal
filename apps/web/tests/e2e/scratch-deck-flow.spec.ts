import { test, expect } from '@playwright/test';
import { BASE_URL, resetFixture } from '../support/fixture';

test.describe('Scratch deck flow', () => {
  test.afterAll(async () => {
    await resetFixture();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/decks/new`, { waitUntil: 'networkidle' });
  });

  test('/decks/new offers three ways to start a deck, none open', async ({ page }) => {
    await expect(page.getByRole('link', { name: /I bought a ready-made deck/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /I have a Fabrary link/i })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: /Start from scratch/i })).toHaveAttribute('aria-expanded', 'false');
  });

  test('/decks/new renders its heading and the back link to the decks', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /^New deck$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to decks/i })).toBeVisible();
  });

  test('searching a hero lists it with its formats', async ({ page }) => {
    await page.getByRole('button', { name: /Start from scratch/i }).click();

    await page.getByRole('searchbox').fill('Dorinthea');

    const result = page.getByRole('button', { name: /Dorinthea Ironsong/ });
    await expect(result).toBeVisible();
    await expect(result.getByText('Classic Constructed')).toBeVisible();
  });

  test('picking Dorinthea and a format opens the composition editor on the new deck', async ({ page }) => {
    await page.getByRole('button', { name: /Start from scratch/i }).click();
    await page.getByRole('searchbox').fill('Dorinthea');
    await page.getByRole('button', { name: /Dorinthea Ironsong/ }).click();
    await expect(page.getByRole('button', { name: 'Start building' })).toBeDisabled();

    await page.getByText('Classic Constructed', { exact: true }).click();
    await page.getByRole('button', { name: 'Start building' }).click();

    await expect(page).toHaveURL(/\/decks\/\d+\?edit=(%22)?1/);
    await expect(page.getByTestId('deck-canvas-edit')).toBeVisible();
  });
});
