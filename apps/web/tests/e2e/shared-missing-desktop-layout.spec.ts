/**
 * The shared "missing" page on a computer (`t3a`, `t3a-s1` of the desktop patterns): the title and actions in a
 * fixed left column, the list at the right, the selection bar at the bottom once a card is ticked.
 */
import { test, expect } from '@playwright/test';
import { pinPortuguese } from '../e2e/helpers';
import { ANON_STORAGE_STATE } from '../support/fixture';
import { GROUP_TOKEN, groupPageStub } from '../support/sharing-stubs';

test.use({ storageState: ANON_STORAGE_STATE });

test.beforeEach(async ({ page }) => {
  await pinPortuguese(page);
  await page.route(`**/api/shared/decks/${GROUP_TOKEN}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(groupPageStub(null)) }),
  );
});

for (const width of [1440, 1024]) {
  test(`at ${width} px the title column stays at the left and the list fills the rest`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/d/${GROUP_TOKEN}`, { waitUntil: 'networkidle' });

    const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    const give = (await page.getByRole('heading', { name: 'Quem tiver, fala com Caio' }).boundingBox())!;
    const copy = (await page.getByRole('button', { name: 'Copiar lista em texto' }).boundingBox())!;
    const glossary = (await page.getByRole('link', { name: 'O que querem dizer estas palavras?' }).first().boundingBox())!;
    const list = (await page.getByTestId('shared-card').first().boundingBox())!;

    for (const [name, box] of Object.entries({ title, give, copy, glossary })) {
      expect(box.x + box.width, `${name} sits left of the list`).toBeLessThanOrEqual(list.x);
    }
    expect(list.width, 'the list takes the larger part').toBeGreaterThan(width / 2);
    expect(Math.abs(list.y - title.y), 'the list starts at the height of the title').toBeLessThan(120);

    await expect(page.getByTestId('shared-deck-footer')).toContainText('Os preços são da Cúpula DT e podem mudar.');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
  });
}

test('at 1440 px the left column stays in view while the list scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto(`/d/${GROUP_TOKEN}`, { waitUntil: 'networkidle' });
  const heading = page.getByRole('heading', { name: 'Quem tiver, fala com Caio' });
  const before = (await heading.boundingBox())!;

  await page.mouse.wheel(0, 300);
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

  const after = (await heading.boundingBox())!;
  expect(after.y, 'the column is still on screen').toBeGreaterThanOrEqual(0);
  expect(after.y, 'the column stuck near the top instead of scrolling away').toBeLessThanOrEqual(Math.max(before.y, 120));
});

test('at 1440 px the bar appears at the bottom of the screen once a card is ticked, and "Limpar" removes it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto(`/d/${GROUP_TOKEN}`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('offer-bar')).toHaveCount(0);

  await page.getByRole('checkbox', { name: 'Marcar Reckless Swing (Azul)' }).check();
  const bar = page.getByTestId('offer-bar');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('1 carta selecionada · 3 cópias');
  await expect(bar.getByRole('button', { name: 'Oferecer no WhatsApp' })).toBeVisible();

  // The page is taller than the screen, and the bar stays at the screen's bottom edge.
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(pageHeight, 'the page is taller than the screen').toBeGreaterThan(700);
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = (await bar.boundingBox())!;
  expect(box.y + box.height, 'the bar sits at the bottom of the screen').toBeGreaterThan(700 - 4);
  expect(box.y + box.height).toBeLessThanOrEqual(700);

  // On a computer the summary and the buttons share one line.
  const send = (await bar.getByRole('button', { name: 'Oferecer no WhatsApp' }).boundingBox())!;
  const summary = (await bar.getByRole('status').boundingBox())!;
  expect(Math.abs(send.y + send.height / 2 - (summary.y + summary.height / 2)), 'one line').toBeLessThan(30);
  expect(summary.x, 'the summary is at the left of the button').toBeLessThan(send.x);

  await page.getByRole('button', { name: 'Limpar' }).click();
  await expect(page.getByTestId('offer-bar')).toHaveCount(0);
});

test('at 1440 px the bar opens the message that the old per-card button used to build', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/d/${GROUP_TOKEN}`, { waitUntil: 'networkidle' });
  await page.getByRole('checkbox', { name: 'Marcar Reckless Swing (Azul)' }).check();
  await page.getByRole('checkbox', { name: 'Marcar Nullrune Hood' }).check();

  await page.getByRole('button', { name: 'Oferecer no WhatsApp' }).click();

  const message = page.getByTestId('share-dialog').getByTestId('offer-message');
  await expect(message).toContainText('Oi Caio, vi seu pedido no Rathe Arsenal. Tenho:');
  await expect(message).toContainText('3 Reckless Swing (Azul), edição __, condição __, R$ __ cada');
  await expect(message).toContainText('1 Nullrune Hood, edição __, condição __, R$ __ cada');
});
