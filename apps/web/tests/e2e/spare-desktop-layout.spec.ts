/** Desktop layout of "Sobrando": rules panel on the right from 1100 px, on top below it. */
import { test, expect } from '@playwright/test';
import { ANON_STORAGE_STATE } from '../support/fixture';
import { openSparePageWithCards } from '../support/spare-account';

test.use({ storageState: ANON_STORAGE_STATE });

test('at 1440 the panel sits at the right of the list and the rows are compact', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const api = await openSparePageWithCards(page, context);

  const list = (await page.getByRole('list', { name: 'Cartas sobrando' }).boundingBox())!;
  const bar = (await page.getByTestId('spare-bar').boundingBox())!;
  expect(bar.x, 'the sell button panel is right of the list').toBeGreaterThanOrEqual(list.x + list.width - 1);
  const row = (await page.getByTestId('spare-row').first().boundingBox())!;
  expect(row.height, 'compact row').toBeLessThanOrEqual(110);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await api.dispose();
});

test('at 1024 the controls sit above the list and the sell bar is sticky at the bottom', async ({ page, context }) => {
  await page.setViewportSize({ width: 1024, height: 500 });
  const api = await openSparePageWithCards(page, context);

  const chips = (await page.getByRole('group', { name: 'Ordenar:' }).boundingBox())!;
  const list = (await page.getByRole('list', { name: 'Cartas sobrando' }).boundingBox())!;
  expect(chips.y + chips.height, 'the chips are above the list').toBeLessThanOrEqual(list.y + 1);

  const bar = (await page.getByTestId('spare-bar').boundingBox())!;
  expect(bar.y + bar.height, 'the bar is stuck to the bottom of the screen').toBeGreaterThanOrEqual(500 - 2);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await api.dispose();
});

test('the row menu works with the keyboard at desktop width', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const api = await openSparePageWithCards(page, context);

  const button = page.getByTestId('spare-row').first().getByRole('button', { name: /^Mais ações de/ });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Por que sobra?' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: /Ver na LigaFAB/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(button).toBeFocused();
  await api.dispose();
});

test('Space opens "Ver na LigaFAB" and the focus returns to the menu button', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await context.route('https://www.ligafab.com.br/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>LigaFAB</title>' }));
  const api = await openSparePageWithCards(page, context);

  const button = page.getByTestId('spare-row').first().getByRole('button', { name: /^Mais ações de/ });
  await button.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: /Ver na LigaFAB/ })).toBeFocused();

  const popup = context.waitForEvent('page');
  await page.keyboard.press('Space');
  await (await popup).close();

  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(button).toBeFocused();
  await api.dispose();
});
