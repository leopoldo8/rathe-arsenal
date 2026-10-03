import { test, expect, type Page } from '@playwright/test';
import { loadFixture } from '../support/fixture';
import { openDeck } from '../support/pages';

const draftKey = (deckId: number): string => `ra-deck-draft-${deckId}`;

async function seedDraft(page: Page, deckId: number, cards: readonly unknown[]): Promise<void> {
  await page.addInitScript(
    ([key, payload]) => localStorage.setItem(key, payload),
    [draftKey(deckId), JSON.stringify({ version: 'v1', heroIdentifier: null, format: 'Classic Constructed', cards })] as const,
  );
}

test.describe('Draft restore flow', () => {
  const { readyDeckId } = loadFixture();

  test('the restore prompt is absent when no draft is stored', async ({ page }) => {
    await openDeck(page, readyDeckId, '?edit=1');

    await expect(page.getByTestId('deck-canvas-edit')).toBeVisible();
    await expect(page.getByTestId('draft-restore-restore-btn')).toHaveCount(0);
  });

  test('a stored draft shows the restore prompt, and Restore dismisses it', async ({ page }) => {
    await seedDraft(page, readyDeckId, [{ cardIdentifier: 'agile-windup-blue', quantity: 1, slot: 'mainboard' }]);

    await openDeck(page, readyDeckId, '?edit=1');
    const restore = page.getByTestId('draft-restore-restore-btn');
    await expect(restore).toBeVisible();
    await restore.click();

    await expect(restore).toHaveCount(0);
    await expect(page.getByTestId('deck-canvas-edit')).toBeVisible();
  });

  test('Discard dismisses the prompt, clears the stored draft and keeps the editor open', async ({ page }) => {
    await seedDraft(page, readyDeckId, []);

    await openDeck(page, readyDeckId, '?edit=1');
    await page.getByTestId('draft-restore-discard-btn').click();

    await expect(page.getByTestId('draft-restore-discard-btn')).toHaveCount(0);
    await expect(page.getByTestId('deck-canvas-edit')).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), draftKey(readyDeckId))).toBeNull();
  });
});
