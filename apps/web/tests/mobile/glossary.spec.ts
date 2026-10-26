/**
 * The "?" after a game word on a phone (`r2-pitch-sheet-phone`): drawn 20 px, tapped at 44 px, and its sheet rises from the bottom.
 */
import { test, expect } from '@playwright/test';
import { pinPortuguese } from '../e2e/helpers';
import { loadFixture } from '../support/fixture';

async function openDeck(page: import('@playwright/test').Page): Promise<void> {
  await pinPortuguese(page);
  await page.goto(`/decks/${loadFixture().readyDeckId}`, { waitUntil: 'networkidle' });
}

test('the question mark is 20 px drawn and 44 px to tap', async ({ page }) => {
  await openDeck(page);
  const question = page.getByRole('button', { name: 'O que é Pitch?' });
  await question.scrollIntoViewIfNeeded();

  const target = (await question.boundingBox())!;
  const circle = (await question.locator('span').first().boundingBox())!;

  expect(target.width, 'the tap target is at least 44 px wide').toBeGreaterThanOrEqual(44);
  expect(target.height, 'the tap target is at least 44 px tall').toBeGreaterThanOrEqual(44);
  expect(Math.round(circle.width)).toBe(20);
  expect(Math.round(circle.height)).toBe(20);
});

test('a bottom sheet on the phone', async ({ page }) => {
  await openDeck(page);
  await page.getByRole('button', { name: 'O que é Pitch?' }).click();

  const sheet = page.getByRole('dialog', { name: 'Pitch' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAccessibleName('Pitch');
  await expect(sheet.getByRole('heading', { name: 'Pitch' })).toBeVisible();
  await expect(sheet).toContainText('O número de 1 a 3 da carta, mostrado também pela cor');
  await expect(sheet.getByRole('link', { name: 'Ver todos os termos' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Fechar' })).toBeVisible();
  const box = (await sheet.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y + box.height, 'the sheet sits on the bottom edge').toBeGreaterThanOrEqual(viewport.height - 1);
  expect(box.width, 'the sheet spans the phone').toBeGreaterThanOrEqual(viewport.width - 2);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
});
