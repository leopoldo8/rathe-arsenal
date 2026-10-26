/**
 * Phone layout of the owner's missing list (`r3-list-phone`, `r3-tenho-phone`). The list is served from a stub
 * so the screen does not depend on the fixture user's collection or on the store's stock today.
 */
import { test, expect } from '@playwright/test';
import { pinPortuguese } from '../e2e/helpers';
import { loadFixture } from '../support/fixture';
import { missingListStub, stubMissingList } from '../support/missing-list-stubs';

test('the phone list follows r3-list-phone', async ({ page }) => {
  await pinPortuguese(page);
  await stubMissingList(page);
  // r3-list-phone draws a row with both a flag and a stand-in line: the stub gives that row a flag too (the later route wins).
  await page.route('**/api/decks/*/missing', (route) => {
    const stub = missingListStub();
    const lines = stub.lines.map((line) => (line.cardIdentifier === 'bloodrush-bellow-yellow' ? { ...line, foilOnly: true } : line));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...stub, lines }) });
  });
  await page.goto(`/decks/${loadFixture().readyDeckId}/missing`, { waitUntil: 'networkidle' });
  const list = page.getByTestId('missing-list-page');
  await expect(list).toBeVisible();
  const viewport = page.viewportSize()!;

  const summary = list.locator('header').first();
  const chips = page.getByTestId('missing-chips');
  const firstRow = page.getByTestId('missing-row').first();
  const bar = page.getByRole('group', { name: 'Ações da lista' });
  const [summaryBox, chipsBox, rowBox] = await Promise.all([summary.boundingBox(), chips.boundingBox(), firstRow.boundingBox()]);
  expect(summaryBox!.y, 'the summary is above the chips').toBeLessThan(chipsBox!.y);
  expect(chipsBox!.y, 'the chips are above the rows').toBeLessThan(rowBox!.y);
  expect(await summary.evaluate((node) => getComputedStyle(node).position), 'the summary stays on screen').toBe('sticky');
  await expect(summary).toContainText('Falta comprar: 43 cópias · R$ 452,28 na Cúpula DT');

  const row = page.getByTestId('missing-row').filter({ hasText: 'Alpha Rampage' });
  await expect(row).toContainText('R$ 150,00');
  await expect(row).toContainText('só tem foil promo');
  await expect(row.getByRole('button', { name: 'Já tenho Alpha Rampage (Vermelho)' })).toBeVisible();
  await expect(row.getByRole('link', { name: /^Comprar Alpha Rampage/ })).toBeVisible();
  const image = row.locator('img');
  await expect(image).toBeVisible();
  expect(await image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0), 'the row image loads').toBe(true);

  // A row with a stand-in: unit price and line total are two different numbers, and the stand-in line sits under the flags.
  const bloodrush = page.getByTestId('missing-row').filter({ hasText: 'Bloodrush Bellow (Amarelo)' }).first();
  await expect(bloodrush.getByTestId('missing-row-price')).toHaveText('R$ 69,99 cada');
  await expect(bloodrush.getByTestId('missing-row-total')).toHaveText('R$ 139,98');
  const standIn = bloodrush.getByTestId('missing-stand-in');
  await expect(standIn).toContainText('Você tem 1 Bloodrush Bellow (Vermelho), que serve no lugar de 1 · economiza R$ 69,99');
  await expect(standIn.getByRole('button', { name: /^Usar Bloodrush Bellow \(Vermelho\)/ })).toBeVisible();
  const [standInBox, haveBox] = await Promise.all([
    standIn.boundingBox(),
    bloodrush.getByRole('button', { name: /^Já tenho Bloodrush Bellow/ }).boundingBox(),
  ]);
  expect(standInBox!.y, 'the stand-in line is above "Já tenho…"').toBeLessThan(haveBox!.y);

  // Inside the row: the needed count and unit price share one line ("faltam 3 · R$ 69,99 cada"), under the name;
  // the line total sits on the name's line, to its right; then the stand-in line, then the two actions.
  await expect(bloodrush.locator('p').filter({ hasText: 'faltam' })).toHaveText('faltam 3 · R$ 69,99 cada');
  const nameBox = (await bloodrush.locator('span[class*="name"]').last().boundingBox())!;
  const metaBox = (await bloodrush.locator('p').filter({ hasText: 'faltam' }).boundingBox())!;
  const totalBox = (await bloodrush.getByTestId('missing-row-total').boundingBox())!;
  const buyBox = (await bloodrush.getByRole('link', { name: /^Comprar Bloodrush Bellow/ }).boundingBox())!;
  expect(nameBox.y, 'the name is above the needed and unit price line').toBeLessThan(metaBox.y);
  expect(Math.abs(totalBox.y - nameBox.y), 'the line total is on the name line').toBeLessThan(nameBox.height);
  expect(totalBox.x, 'the line total is to the right of the name').toBeGreaterThan(nameBox.x + nameBox.width);
  expect(metaBox.y, 'the needed line is above the stand-in line').toBeLessThan(standInBox!.y);
  const bloodrushFlagsBox = (await bloodrush.locator('ul').boundingBox())!;
  expect(metaBox.y, 'the needed line is above the flags').toBeLessThan(bloodrushFlagsBox.y);
  expect(bloodrushFlagsBox.y, 'the flags are above the stand-in line').toBeLessThan(standInBox!.y);
  expect(haveBox!.x, '"Já tenho…" comes before "Comprar" on the row actions').toBeLessThan(buyBox.x);
  expect(Math.abs(haveBox!.y - buyBox.y), 'both actions share the last line').toBeLessThan(buyBox.height);

  // A row with an image and flags: the image is left of the name, the flags are under the needed line.
  const alphaImageBox = (await image.boundingBox())!;
  const alphaNameBox = (await row.locator('span[class*="name"]').last().boundingBox())!;
  const alphaMetaBox = (await row.locator('p').filter({ hasText: /falta/ }).boundingBox())!;
  const alphaFlagsBox = (await row.locator('ul').boundingBox())!;
  expect(alphaImageBox.x + alphaImageBox.width, 'the image is left of the name').toBeLessThanOrEqual(alphaNameBox.x + 1);
  expect(alphaMetaBox.y, 'the needed line is above the flags').toBeLessThan(alphaFlagsBox.y);

  const buttons = bar.getByRole('button');
  await expect(buttons).toHaveText(['Compartilhar a lista', 'Copiar lista de compras']);
  expect((await bar.boundingBox())!.y, 'the bar is below the rows').toBeGreaterThan(rowBox!.y);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);

  // "Já tenho…" opens the question inside its own row, and the toast that follows sits at the bottom.
  const pack = page.getByTestId('missing-row').filter({ hasText: 'Pack Hunt' }).first();
  await pack.scrollIntoViewIfNeeded();
  await pack.getByRole('button', { name: /^Já tenho Pack Hunt/ }).click();
  const stepper = pack.getByTestId('owned-stepper');
  await expect(stepper).toContainText('Quantas você já tem?');
  const [stepperBox, packBox] = await Promise.all([stepper.boundingBox(), pack.boundingBox()]);
  expect(stepperBox!.y).toBeGreaterThanOrEqual(packBox!.y);
  expect(stepperBox!.y + stepperBox!.height).toBeLessThanOrEqual(packBox!.y + packBox!.height + 1);
  expect(stepperBox!.x + stepperBox!.width).toBeLessThanOrEqual(viewport.width);

  await stepper.getByRole('button', { name: '3', exact: true }).click();
  const toast = page.getByRole('status').filter({ hasText: 'você tem 3' });
  await expect(toast).toBeVisible();
  const toastBox = await toast.boundingBox();
  expect(toastBox!.y, 'the toast sits at the bottom').toBeGreaterThan(viewport.height / 2);
});
