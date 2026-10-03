import { test, expect } from '@playwright/test';
import { BASE_URL, resetFixture } from '../support/fixture';

test.describe('Scratch deck flow', () => {
  test.afterAll(async () => {
    await resetFixture();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/decks/new`, { waitUntil: 'networkidle' });
  });

  test('/decks/new renders both path cards', async ({ page }) => {
    await expect(page.getByTestId('import-fabrary-card')).toBeVisible();
    await expect(page.getByTestId('start-scratch-card')).toBeVisible();
  });

  test('/decks/new renders its heading and the back link to Home', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /^New deck$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to home/i })).toBeVisible();
  });

  test('the scratch card shows a Start Building button', async ({ page }) => {
    await expect(page.getByTestId('start-building-btn')).toBeVisible();
  });

  test('the hero input accepts Dorinthea', async ({ page }) => {
    const heroInput = page.getByTestId('start-scratch-card').locator('input').first();

    await heroInput.fill('Dorinthea');

    await expect(heroInput).toHaveValue(/Dorinthea/);
  });

  test('selecting Dorinthea and Start Building opens the composition editor on the new deck', async ({ page }) => {
    const scratchCard = page.getByTestId('start-scratch-card');
    await scratchCard.getByTestId('format-dropdown-trigger').click();
    await page.getByTestId('format-option-Classic Constructed').click();
    await scratchCard.getByTestId('hero-dropdown-input').fill('Dorinthea');
    await page.getByTestId('hero-option-dorinthea-ironsong').click();

    await page.getByTestId('start-building-btn').click();

    await expect(page).toHaveURL(/\/decks\/\d+\?edit=(%22)?1/);
    await expect(page.getByTestId('deck-canvas-edit')).toBeVisible();
  });
});
