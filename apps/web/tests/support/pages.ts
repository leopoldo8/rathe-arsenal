import { expect, type Page } from '@playwright/test';
import { BASE_URL } from './fixture';

export async function openDeck(page: Page, deckId: number, search = ''): Promise<void> {
  await page.goto(`${BASE_URL}/decks/${deckId}${search}`, { waitUntil: 'networkidle', timeout: 20000 });
}

export async function openCompositionEditor(page: Page, deckId: number): Promise<void> {
  await openDeck(page, deckId, '?edit=1');
  await expect(page.getByTestId('deck-canvas-edit')).toBeVisible();
}
