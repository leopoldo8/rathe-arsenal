/** Phone layout of "Sobrando": one "⋯" per row, after the quantity stepper, with 44 px targets. */
import { test, expect } from '@playwright/test';
import { ANON_STORAGE_STATE } from '../support/fixture';
import { openSparePageWithCards } from '../support/spare-account';

test.use({ storageState: ANON_STORAGE_STATE });

test('the spare rows fit a phone, with the menu button after the stepper and no overlaps', async ({ page, context }) => {
  const api = await openSparePageWithCards(page, context);
  const viewport = page.viewportSize()!;

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);

  const rows = page.getByTestId('spare-row');
  const count = await rows.count();
  expect(count).toBeGreaterThan(1);
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    const more = row.getByRole('button', { name: /^Mais ações de/ });
    const plus = row.getByRole('button', { name: /^Mais uma cópia/ });
    const moreBox = (await more.boundingBox())!;
    const plusBox = (await plus.boundingBox())!;
    expect(moreBox.height, 'menu button height').toBeGreaterThanOrEqual(44);
    expect(moreBox.width, 'menu button width').toBeGreaterThanOrEqual(44);
    expect(moreBox.x, 'the menu button is after the stepper').toBeGreaterThanOrEqual(plusBox.x + plusBox.width - 0.5);
    expect(moreBox.x + moreBox.width, 'right edge').toBeLessThanOrEqual(viewport.width);
  }

  const boxes = await rows.first().locator('a, button, input').evaluateAll((elements) =>
    elements
      .map((element) => ({ name: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0)
      .map(({ name, rect }) => ({ name, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom })),
  );
  for (const [i, a] of boxes.entries()) {
    for (const b of boxes.slice(i + 1)) {
      const overlaps = a.x < b.right - 0.5 && b.x < a.right - 0.5 && a.y < b.bottom - 0.5 && b.y < a.bottom - 0.5;
      expect(overlaps, `"${a.name}" overlaps "${b.name}"`).toBe(false);
    }
  }
  await api.dispose();
});

test('the row menu opens inside the screen with 44 px items', async ({ page, context }) => {
  const api = await openSparePageWithCards(page, context);
  const viewport = page.viewportSize()!;

  const rows = page.getByTestId('spare-row');
  await rows.last().getByRole('button', { name: /^Mais ações de/ }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  const box = (await menu.boundingBox())!;
  expect(box.x, 'left edge').toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, 'right edge').toBeLessThanOrEqual(viewport.width);
  for (const item of await menu.getByRole('menuitem').all()) {
    expect((await item.boundingBox())!.height, 'item height').toBeGreaterThanOrEqual(44);
  }
  await api.dispose();
});

test('the sell bar sticks to the bottom of the screen', async ({ page, context }) => {
  const api = await openSparePageWithCards(page, context);
  const viewport = page.viewportSize()!;
  const bar = page.getByTestId('spare-bar');
  const box = (await bar.boundingBox())!;
  expect(box.y + box.height, 'the bar ends at the bottom of the screen').toBeGreaterThanOrEqual(viewport.height - 2);
  await api.dispose();
});
