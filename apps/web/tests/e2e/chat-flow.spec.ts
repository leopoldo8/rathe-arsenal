/**
 * E2E for the Tutor chat routes. A real turn needs Gemini, so `/auth/me` and every `/chat` route are stubbed.
 *
 * PREREQUISITES: dev server up (api :3000, web :5173); the Playwright global setup seeds the fixture user.
 */
import { test, expect } from '@playwright/test';
import { BASE_URL, pinPortuguese } from './helpers';
import { CONVERSATION_ID, stubChat } from '../support/chat-stubs';
import { loadFixture } from '../support/fixture';

const PANEL_WIDTH_PX = 380;
const COLUMN_MAX_PX = 760;
const COLUMN_PADDING_PX = 16;
const SUBPIXEL_PX = 1;

test.describe('Tutor chat', () => {
  test('chat routes redirect without access', async ({ page }) => {
    await pinPortuguese(page);
    await stubChat(page, false);

    for (const path of ['/chat', `/chat/${CONVERSATION_ID}`]) {
      await page.goto(`${BASE_URL}${path}`);
      await expect(page).toHaveURL(/\/home(\?|$)/);
    }
  });

  test('the list is a side panel on desktop', async ({ page }) => {
    await pinPortuguese(page);
    await stubChat(page, true);
    await page.goto(`${BASE_URL}/chat/${CONVERSATION_ID}`);
    await expect(page.getByText('Como o pessoal está montando o Katsu nos torneios?')).toBeVisible();

    await page.getByRole('button', { name: /^Conversas/ }).click();
    const panel = page.getByRole('dialog', { name: 'Conversas' });
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    const viewport = page.viewportSize()!;

    expect(Math.abs(box.width - PANEL_WIDTH_PX)).toBeLessThanOrEqual(SUBPIXEL_PX);
    expect(Math.abs(box.x + box.width - viewport.width)).toBeLessThanOrEqual(SUBPIXEL_PX);
    expect(box.y).toBeLessThanOrEqual(SUBPIXEL_PX);
    expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThanOrEqual(SUBPIXEL_PX);
  });

  test('the thread reads in one centred column on desktop', async ({ page }) => {
    await pinPortuguese(page);
    await stubChat(page, true);
    await page.goto(`${BASE_URL}/chat/${CONVERSATION_ID}`);
    const bubble = page.getByText('Como o pessoal está montando o Katsu nos torneios?');
    await expect(bubble).toBeVisible();
    const viewport = page.viewportSize()!;

    const column = (await page.getByTestId('chat-column').boundingBox())!;
    const bubbleBox = (await bubble.boundingBox())!;
    const rows = page.getByTestId('proposal-card-row');
    const first = (await rows.nth(0).boundingBox())!;
    const second = (await rows.nth(1).boundingBox())!;

    expect(column.width).toBeLessThanOrEqual(COLUMN_MAX_PX + SUBPIXEL_PX);
    expect(Math.abs(column.x + column.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
    expect(bubbleBox.x).toBeGreaterThan(column.x + column.width / 4);
    expect(Math.abs(bubbleBox.x + bubbleBox.width - (column.x + column.width - COLUMN_PADDING_PX))).toBeLessThanOrEqual(2);
    expect(Math.abs(second.y - first.y)).toBeLessThanOrEqual(SUBPIXEL_PX);
    expect(second.x).toBeGreaterThan(first.x + first.width - SUBPIXEL_PX);
    await expect(page.getByTestId('conversation-count')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nova' })).toBeVisible();
  });

  test('a deck link opens a bound draft', async ({ page }) => {
    const { readyDeckId } = loadFixture();
    await pinPortuguese(page);
    await stubChat(page, true);

    await page.goto(`${BASE_URL}/chat?deck=${readyDeckId}`);

    await expect(page.getByTestId('chat-header').getByTestId('deck-chip')).toHaveAttribute('href', `/decks/${readyDeckId}`);
    const chip = (await page.getByTestId('chat-header').getByTestId('deck-chip').boundingBox())!;
    const title = (await page.getByTestId('chat-header').getByRole('heading', { level: 1 }).boundingBox())!;
    expect(Math.abs(chip.y + chip.height / 2 - (title.y + title.height / 2))).toBeLessThanOrEqual(4);
    expect(chip.x).toBeGreaterThan(title.x + title.width - SUBPIXEL_PX);
  });
});
