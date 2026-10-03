import { test, expect } from '@playwright/test';
import { BASE_URL, loadFixture } from '../support/fixture';
import { openCompositionEditor, openDeck } from '../support/pages';

test.describe('Deck edit flow', () => {
  const { readyDeckId } = loadFixture();

  test('deck detail loads with the Edit button in view mode', async ({ page }) => {
    await openDeck(page, readyDeckId);

    await expect(page.getByTestId('deck-detail-view')).toBeVisible();
    await expect(page.getByTestId('deck-detail-edit-btn')).toBeVisible();
  });

  test('the header Edit button opens the Edit deck screen with the deck name', async ({ page }) => {
    await openDeck(page, readyDeckId);
    const deckName = (await page.getByTestId('deck-hero-name').textContent())?.trim() ?? '';

    await page.getByTestId('deck-detail-edit-btn').click();

    await expect(page).toHaveURL(new RegExp(`/decks/${readyDeckId}/edit$`));
    await expect(page.getByTestId('deck-edit-page')).toBeVisible();
    await expect(page.getByTestId('deck-edit-panel')).toBeVisible();
    await expect(page.getByTestId('deck-edit-name')).not.toHaveValue('');
    expect(deckName).not.toBe('');
  });

  test('Cancel on the Edit deck screen returns to the deck without saving', async ({ page }) => {
    await page.goto(`${BASE_URL}/decks/${readyDeckId}/edit`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('deck-edit-panel')).toBeVisible();

    await page.getByTestId('deck-edit-cancel').click();

    await expect(page).toHaveURL(new RegExp(`/decks/${readyDeckId}$`));
    await expect(page.getByTestId('deck-detail-view')).toBeVisible();
  });

  test('the edit-cards button opens the composition editor with Save and Cancel', async ({ page }) => {
    await openDeck(page, readyDeckId);

    await page.getByTestId('deck-list-edit-cards-btn').click();

    await expect(page).toHaveURL(/edit=(%22)?1/);
    await expect(page.getByTestId('deck-canvas-edit')).toBeVisible();
    await expect(page.getByTestId('deck-detail-cancel-btn')).toBeVisible();
    await expect(page.getByTestId('deck-detail-save-btn')).toBeVisible();
  });

  test('Cancel from the composition editor returns to view mode', async ({ page }) => {
    await openCompositionEditor(page, readyDeckId);

    await page.getByTestId('deck-detail-cancel-btn').click();

    await expect(page.getByTestId('deck-detail-edit-btn')).toBeVisible();
    expect(page.url()).not.toMatch(/edit=/);
  });

  test('a tag pill on /home activates when clicked', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
    const pill = page.getByRole('group', { name: 'Filter by tag' }).getByRole('button', { name: /^Filter by tag:/ }).first();

    await pill.click();

    await expect(pill).toHaveAttribute('aria-pressed', 'true');
  });

  test('the legality badge renders in the readiness card with a valid data-legality value', async ({ page }) => {
    await openDeck(page, readyDeckId);

    await expect(page.getByTestId('analysis-readiness')).toBeVisible();
    const badge = page.getByTestId('legality-badge');
    await expect(badge).toBeVisible();
    expect(['legal', 'incomplete', 'illegal']).toContain(await badge.getAttribute('data-legality'));
  });

  test('Save with no changes leaves the editor without a save error or cascade prompt', async ({ page }) => {
    await openCompositionEditor(page, readyDeckId);

    await page.getByTestId('deck-detail-save-btn').click();

    await expect(page.getByTestId('deck-detail-edit-btn')).toBeVisible();
    await expect(page.getByTestId('deck-detail-save-error')).toHaveCount(0);
    await expect(page.getByTestId('cascade-confirm-save-btn')).toHaveCount(0);
  });
});
