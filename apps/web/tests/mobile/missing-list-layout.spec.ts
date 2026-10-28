/**
 * Phone layout of the owner's missing list (`r3-list-phone`, `r3-tenho-phone`). The list is served from a stub
 * so the screen does not depend on the fixture user's collection or on the store's stock today.
 */
import { test, expect } from '@playwright/test';
import { pinPortuguese } from '../e2e/helpers';
import { loadFixture } from '../support/fixture';
import { missingListStub, stubMissingList } from '../support/missing-list-stubs';
import { stubOwnerSharing, stubSignedIn } from '../support/sharing-stubs';

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

test('the phone list follows r6-alternatives-a-phone', async ({ page }) => {
  await pinPortuguese(page);
  await stubMissingList(page);
  // The sheet reads the deck's own alternatives; the card of the stub is not in the fixture deck, so it is served too.
  await page.route('**/api/decks/*/alternatives*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ needed: 3, groups: [] }) }),
  );
  await page.goto(`/decks/${loadFixture().readyDeckId}/missing`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('missing-list-page')).toBeVisible();

  // Under the name line and above the store notice and the two buttons, in the accent color, underlined.
  const bloodrush = page.getByTestId('missing-row').filter({ hasText: 'Bloodrush Bellow (Amarelo)' }).first();
  const link = bloodrush.getByRole('button', { name: 'Ver alternativas para Bloodrush Bellow (Amarelo)' });
  await expect(link).toHaveText('Alternativas');
  const meta = (await bloodrush.locator('p').filter({ hasText: 'faltam' }).boundingBox())!;
  const linkBox = (await link.boundingBox())!;
  const have = (await bloodrush.getByRole('button', { name: /^Já tenho Bloodrush Bellow/ }).boundingBox())!;
  const buy = (await bloodrush.getByRole('link', { name: /^Comprar Bloodrush Bellow/ }).boundingBox())!;
  expect(linkBox.y, 'the link is under the name line').toBeGreaterThan(meta.y);
  expect(linkBox.y + linkBox.height, 'the link is above the buttons').toBeLessThanOrEqual(have.y);
  expect(have.x, '"Já tenho…" and "Comprar" stay last, in that order').toBeLessThan(buy.x);
  expect(linkBox.height, 'the tap target is at least 44 px').toBeGreaterThanOrEqual(44);
  const style = await link.evaluate((node) => {
    const computed = getComputedStyle(node);
    return { decoration: computed.textDecorationLine, color: computed.color };
  });
  expect(style.decoration).toBe('underline');
  const accent = await bloodrush.getByRole('link', { name: /^Comprar Bloodrush Bellow/ }).evaluate((node) => getComputedStyle(node).color);
  expect(style.color, 'the link uses the accent color of "Comprar"').toBe(accent);

  // Every row of the priced section has one.
  const rows = page.getByTestId('missing-row');
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    await expect(rows.nth(index).getByRole('button', { name: /^Ver alternativas para / })).toHaveCount(1);
  }

  await link.click();
  const sheet = page.getByTestId('alternatives-sheet');
  await expect(sheet.getByRole('heading', { name: 'Alternativas para Bloodrush Bellow (Amarelo)' })).toBeVisible();
  await expect(sheet.getByText('Ocupa o lugar de 3 cópias que faltam.')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
});

test('the missing message step follows r6-turnoff-a-phone', async ({ page }) => {
  await pinPortuguese(page);
  await stubSignedIn(page);
  await stubMissingList(page);
  await stubOwnerSharing(page);
  let deletes = 0;
  await page.route('**/api/decks/*/share/missing', (route) => {
    deletes += route.request().method() === 'DELETE' ? 1 : 0;
    return route.fulfill({ status: 204 });
  });
  await page.goto(`/decks/${loadFixture().swapDeckId}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Compartilhar', exact: true }).first().click();
  const dialog = page.getByTestId('share-dialog');
  await dialog.getByTestId('share-intent-missing').click();
  await expect(dialog.getByTestId('group-ask-message')).toBeVisible();

  // Under the green button: a divider, then one centered "Desativar link" in the danger color, and nothing after it.
  const send = dialog.getByRole('button', { name: 'Abrir no WhatsApp' });
  const turnOff = dialog.getByRole('button', { name: 'Desativar link' });
  await expect(dialog.getByText('Desativar link')).toHaveCount(1);
  const [sendBox, turnOffBox] = await Promise.all([send.boundingBox(), turnOff.boundingBox()]);
  expect(turnOffBox!.y, 'the row is under "Abrir no WhatsApp"').toBeGreaterThanOrEqual(sendBox!.y + sendBox!.height);
  const centerOfRow = turnOffBox!.x + turnOffBox!.width / 2;
  expect(Math.abs(centerOfRow - (sendBox!.x + sendBox!.width / 2)), 'the row is centered').toBeLessThan(4);
  expect(turnOffBox!.height, 'the row is at least 44 px high').toBeGreaterThanOrEqual(44);
  expect(await turnOff.evaluate((node) => getComputedStyle(node).color), 'the row is in the danger color').toBe(
    await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--ra-ready-low)';
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    }),
  );
  const divider = await turnOff.evaluate((node) => getComputedStyle(node.parentElement!).borderTopStyle);
  expect(divider, 'a divider sits above the row').toBe('solid');
  const buttonsBelow = await dialog.getByRole('button').evaluateAll(
    (nodes, top) => nodes.filter((node) => node.getBoundingClientRect().top > top + 1).length,
    turnOffBox!.y,
  );
  expect(buttonsBelow, 'nothing after the row').toBe(0);

  // Tapping it swaps the row in place for the question, "Desativar" and "Manter"; the rest stays.
  const messageBefore = await dialog.getByTestId('group-ask-message').boundingBox();
  await turnOff.click();
  await expect(dialog.getByText('Desativar? Quem tem o link não vai mais conseguir abrir.')).toBeVisible();
  const confirm = dialog.getByRole('button', { name: 'Desativar', exact: true });
  const keep = dialog.getByRole('button', { name: 'Manter' });
  await expect(send).toBeVisible();
  await expect(dialog.getByRole('switch', { name: /Incluir também as/ })).toBeVisible();
  const [confirmBox, keepBox] = await Promise.all([confirm.boundingBox(), keep.boundingBox()]);
  expect(confirmBox!.height).toBeGreaterThanOrEqual(44);
  expect(keepBox!.height).toBeGreaterThanOrEqual(44);
  expect(confirmBox!.x, '"Desativar" is left of "Manter"').toBeLessThan(keepBox!.x);
  expect(keepBox!.x + keepBox!.width, '"Manter" is at the right edge').toBeGreaterThan(sendBox!.x + sendBox!.width - 24);
  const messageAfter = await dialog.getByTestId('group-ask-message').boundingBox();
  expect({ width: messageAfter!.width, height: messageAfter!.height }, 'the message keeps its size').toEqual({ width: messageBefore!.width, height: messageBefore!.height });

  await keep.click();
  await expect(turnOff).toBeVisible();
  expect(deletes).toBe(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
});

test('the missing message step carries the drawn texts and colors of r6-turnoff-a-phone', async ({ page }) => {
  await pinPortuguese(page);
  await stubSignedIn(page);
  await stubMissingList(page);
  await stubOwnerSharing(page);
  await page.goto(`/decks/${loadFixture().swapDeckId}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Compartilhar', exact: true }).first().click();
  const dialog = page.getByTestId('share-dialog');
  await dialog.getByTestId('share-intent-missing').click();
  await expect(dialog.getByTestId('group-ask-message')).toBeVisible();

  await expect(dialog.getByText('Pedir as cartas que faltam', { exact: true }).first()).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Mensagem para o WhatsApp' })).toBeVisible();
  await expect(dialog.getByText('Você pode editar antes de enviar.', { exact: true })).toBeVisible();
  // The picture draws 43; the stub holds 7 store-side copies, and the label is the same sentence around the count.
  await expect(dialog.getByRole('switch', { name: 'Incluir também as 7 que a loja tem' })).toBeVisible();

  // Nothing after the row: no text starts below its bottom edge.
  const turnOff = dialog.getByRole('button', { name: 'Desativar link' });
  const turnOffBox = (await turnOff.boundingBox())!;
  const textBelow = await dialog.evaluate(
    (node, bottom) =>
      [...node.querySelectorAll('*')].filter(
        (element) => element.children.length === 0 && (element.textContent ?? '').trim() !== '' && element.getBoundingClientRect().top >= bottom - 0.5,
      ).length,
    turnOffBox.y + turnOffBox.height,
  );
  expect(textBelow, 'no text after the row').toBe(0);

  const colorOf = (token: string) =>
    page.evaluate((value) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${value})`;
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    }, token);
  await turnOff.click();
  const confirm = dialog.getByRole('button', { name: 'Desativar', exact: true });
  const keep = dialog.getByRole('button', { name: 'Manter' });
  expect(await confirm.evaluate((node) => getComputedStyle(node).color), '"Desativar" is in the danger color').toBe(await colorOf('--ra-ready-low'));
  expect(await keep.evaluate((node) => getComputedStyle(node).color), '"Manter" is in the accent color').toBe(await colorOf('--ra-accent-body'));
});
