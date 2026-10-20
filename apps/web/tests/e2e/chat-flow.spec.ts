/**
 * E2E for the Tutor chat routes. A real turn needs Gemini, so `/auth/me` and every `/chat` route are stubbed.
 *
 * PREREQUISITES: dev server up (api :3000, web :5173); the Playwright global setup seeds the fixture user.
 */
import { test, expect } from '@playwright/test';
import { BASE_URL, pinPortuguese } from './helpers';
import { CONVERSATION_ID, stubChat } from '../support/chat-stubs';
import { loadFixture } from '../support/fixture';

const SIDEBAR_WIDTH_PX = 300;
const FOOTER_MAX_PX = 48;
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

  test('the conversations sit in a left sidebar on desktop and only the thread scrolls', async ({ page }) => {
    await pinPortuguese(page);
    await stubChat(page, true);
    await page.goto(`${BASE_URL}/chat/${CONVERSATION_ID}`);
    await expect(page.getByText('Como o pessoal está montando o Katsu nos torneios?')).toBeVisible();
    const viewport = page.viewportSize()!;

    const sidebar = page.getByRole('complementary', { name: 'Conversas' });
    const box = (await sidebar.boundingBox())!;
    expect(box.x).toBeLessThanOrEqual(SUBPIXEL_PX);
    expect(Math.abs(box.width - SIDEBAR_WIDTH_PX)).toBeLessThanOrEqual(SUBPIXEL_PX);
    await expect(sidebar.getByRole('link', { name: 'Nova conversa' })).toBeVisible();
    await expect(sidebar.getByTestId('conversation-row').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Conversas/ })).toHaveCount(0);

    const pageScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(pageScroll).toBeLessThanOrEqual(SUBPIXEL_PX);
    const composer = (await page.getByRole('textbox', { name: 'Mensagem para o Tutor' }).boundingBox())!;
    expect(composer.y + composer.height).toBeLessThanOrEqual(viewport.height);
    const disclaimer = (await page.getByRole('contentinfo').boundingBox())!;
    expect(disclaimer.y + disclaimer.height).toBeLessThanOrEqual(viewport.height + SUBPIXEL_PX);
    expect(disclaimer.height).toBeLessThanOrEqual(FOOTER_MAX_PX);
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
    expect(Math.abs(column.x + column.width / 2 - (SIDEBAR_WIDTH_PX + (viewport.width - SIDEBAR_WIDTH_PX) / 2))).toBeLessThanOrEqual(2);
    expect(bubbleBox.x).toBeGreaterThan(column.x + column.width / 4);
    expect(Math.abs(bubbleBox.x + bubbleBox.width - (column.x + column.width - COLUMN_PADDING_PX))).toBeLessThanOrEqual(2);
    expect(Math.abs(second.y - first.y)).toBeLessThanOrEqual(SUBPIXEL_PX);
    expect(second.x).toBeGreaterThan(first.x + first.width - SUBPIXEL_PX);
  });

  test('a deck link opens a bound draft', async ({ page }) => {
    const { readyDeckId } = loadFixture();
    await pinPortuguese(page);
    await stubChat(page, true);

    await page.goto(`${BASE_URL}/chat?deck=${readyDeckId}`);

    const open = page.getByTestId('open-conversation');
    await expect(open.getByTestId('deck-chip')).toHaveAttribute('href', `/decks/${readyDeckId}`);
    const chip = (await open.getByTestId('deck-chip').boundingBox())!;
    const title = (await open.getByRole('heading', { level: 1 }).boundingBox())!;
    expect(chip.y).toBeGreaterThanOrEqual(title.y + title.height - SUBPIXEL_PX);
  });
});
