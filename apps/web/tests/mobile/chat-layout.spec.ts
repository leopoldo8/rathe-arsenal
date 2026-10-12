/**
 * Phone layout of the Tutor chat, run by the `mobile-*` projects. A real turn needs Gemini, so `/auth/me` and
 * every `/chat` route are stubbed.
 */
import { test, expect, type Page } from '@playwright/test';
import { BASE_URL, loadFixture } from '../support/fixture';
import { CONVERSATION_ID, stubChat } from '../support/chat-stubs';

const SUBPIXEL_PX = 1;
const COLUMN_PADDING_PX = 16;

async function openChat(page: Page, path: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
  await stubChat(page, true);
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle', timeout: 20000 });
}

test.describe('Tutor chat on a phone', () => {
  test('three tabs and the composer fit a phone', async ({ page }) => {
    await openChat(page, `/chat/${CONVERSATION_ID}`);
    await expect(page.getByText('Como o pessoal está montando o Katsu nos torneios?')).toBeVisible();
    const viewport = page.viewportSize()!;

    const tabBar = page.getByRole('navigation', { name: 'Navegação principal' });
    const tabs = tabBar.getByRole('link');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(2)).toHaveText('Tutor');
    for (let index = 0; index < 3; index++) {
      const box = (await tabs.nth(index).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(-SUBPIXEL_PX);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + SUBPIXEL_PX);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + SUBPIXEL_PX);
    }

    const composer = (await page.getByRole('textbox', { name: 'Mensagem para o Tutor' }).boundingBox())!;
    const bar = (await tabBar.boundingBox())!;
    expect(composer.y + composer.height).toBeLessThanOrEqual(bar.y + SUBPIXEL_PX);
    expect(composer.x + composer.width).toBeLessThanOrEqual(viewport.width + SUBPIXEL_PX);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewport.width);
  });

  test('the list is a bottom sheet on a phone', async ({ page }) => {
    await openChat(page, `/chat/${CONVERSATION_ID}`);
    await page.getByRole('button', { name: /^Conversas/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Conversas' });
    await expect(sheet).toBeVisible();
    const box = (await sheet.boundingBox())!;
    const viewport = page.viewportSize()!;

    expect(box.x).toBeLessThanOrEqual(SUBPIXEL_PX);
    expect(Math.abs(box.width - viewport.width)).toBeLessThanOrEqual(SUBPIXEL_PX);
    expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThanOrEqual(SUBPIXEL_PX);
  });

  test('the phone layout stacks cards and hides the header extras', async ({ page }) => {
    await openChat(page, `/chat/${CONVERSATION_ID}`);
    const bubble = page.getByText('Como o pessoal está montando o Katsu nos torneios?');
    await expect(bubble).toBeVisible();
    const viewport = page.viewportSize()!;

    const bubbleBox = (await bubble.boundingBox())!;
    const rows = page.getByTestId('proposal-card-row');
    const first = (await rows.nth(0).boundingBox())!;
    const second = (await rows.nth(1).boundingBox())!;

    const column = (await page.getByTestId('chat-column').boundingBox())!;
    expect(Math.abs(bubbleBox.x + bubbleBox.width - (column.x + column.width - COLUMN_PADDING_PX))).toBeLessThanOrEqual(2);
    expect(bubbleBox.x).toBeGreaterThan(viewport.width * 0.1);
    expect(Math.abs(second.x - first.x)).toBeLessThanOrEqual(SUBPIXEL_PX);
    expect(second.y).toBeGreaterThan(first.y + first.height - SUBPIXEL_PX);
    await expect(page.getByTestId('conversation-count')).toBeHidden();
    await expect(page.getByTestId('chat-header').getByRole('link', { name: 'Nova' })).toBeHidden();
  });

  test('a bound deck chip sits in its own band under the title', async ({ page }) => {
    const { readyDeckId } = loadFixture();
    await openChat(page, `/chat?deck=${readyDeckId}`);
    const header = page.getByTestId('chat-header');
    const chip = header.getByTestId('deck-chip');
    await expect(chip).toHaveAttribute('href', `/decks/${readyDeckId}`);

    const chipBox = (await chip.boundingBox())!;
    const title = (await header.getByRole('heading', { level: 1 }).boundingBox())!;
    const list = (await header.getByRole('button', { name: /^Conversas/ }).boundingBox())!;

    expect(chipBox.y).toBeGreaterThanOrEqual(title.y + title.height - SUBPIXEL_PX);
    expect(chipBox.y).toBeGreaterThanOrEqual(list.y + list.height - SUBPIXEL_PX);
    expect(Math.abs(chipBox.x - title.x)).toBeLessThanOrEqual(2);
  });
});
