/**
 * E2E for the Tutor chat routes. A real turn needs Gemini, so `/auth/me` and every `/chat` route are stubbed.
 *
 * PREREQUISITES: dev server up (api :3000, web :5173); the Playwright global setup seeds the fixture user.
 */
import { test, expect } from '@playwright/test';
import { BASE_URL, pinPortuguese } from './helpers';
import { CONVERSATION_ID, stubChat } from '../support/chat-stubs';

const PANEL_WIDTH_PX = 380;
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
});
