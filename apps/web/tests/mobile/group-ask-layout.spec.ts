/**
 * Phone layout of the group ask (`r3-share-phone`, `r3-message-phone`, `r3-group-phone`, `r3-group-friend-phone`,
 * `r3-offer-phone`). The answers are served from stubs, so nothing depends on the fixture user's deck or on the store.
 */
import { test, expect, type Page } from '@playwright/test';
import { pinPortuguese } from '../e2e/helpers';
import { ANON_STORAGE_STATE, loadFixture } from '../support/fixture';
import { stubMissingList } from '../support/missing-list-stubs';
import { GROUP_TOKEN, groupPageStub, stubOwnerSharing, stubSignedIn } from '../support/sharing-stubs';

async function y(page: Page, locator: ReturnType<Page['locator']>): Promise<number> {
  const box = await locator.first().boundingBox();
  expect(box, 'the block is drawn').not.toBeNull();
  return box!.y;
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
}

test.describe('the owner', () => {
  test('the group ask screens follow the r3 screens', async ({ page }) => {
    await pinPortuguese(page);
    await stubSignedIn(page);
    await stubMissingList(page);
    await stubOwnerSharing(page);
    await page.goto(`/decks/${loadFixture().swapDeckId}`, { waitUntil: 'networkidle' });

    // r3-share-phone: the sheet over the deck with the three options, top to bottom.
    await page.getByRole('button', { name: 'Compartilhar', exact: true }).first().click();
    const dialog = page.getByTestId('share-dialog');
    await expect(dialog.getByRole('heading', { name: 'Compartilhar' })).toBeVisible();
    const options = dialog.getByTestId(/^share-intent-/);
    await expect(options).toHaveCount(3);
    const titles = ['Mostrar o deck', 'Pedir as cartas que faltam', 'Pedir orçamento a uma loja'];
    const tops = await Promise.all(titles.map((title) => y(page, dialog.getByText(title, { exact: true }))));
    expect([...tops].sort((a, b) => a - b), 'the options keep their order').toEqual(tops);
    await expectNoHorizontalScroll(page);

    // r3-message-phone: the editor, from its heading down to the button.
    await dialog.getByTestId('share-intent-missing').click();
    const heading = dialog.getByRole('heading', { name: 'Mensagem para o WhatsApp' });
    await expect(heading).toBeVisible();
    const message = dialog.getByTestId('group-ask-message');
    await expect(dialog.getByText('Você pode editar antes de enviar.')).toBeVisible();
    await expect(message).toContainText(/Procuro estas cartas para o meu deck .+ \(Rhinar\):/);
    await expect(message.getByText('Da última vez · confira antes de enviar')).toBeVisible();
    await expect(message.getByRole('textbox', { name: 'Linha final da mensagem' })).toHaveValue('Pago no PIX ou troco. Estou em Pelotas.');
    await expect(message).toContainText('Lista completa: https://rathe-arsenal.app/d/');
    const toggle = dialog.getByRole('switch', { name: /Incluir também as/ });
    const send = dialog.getByRole('button', { name: 'Abrir no WhatsApp' });
    // The editor is titled "Pedir as cartas que faltam", above the heading of the message.
    const editorTitle = dialog.getByText('Pedir as cartas que faltam', { exact: true }).first();
    await expect(editorTitle).toBeVisible();
    const closingField = message.getByRole('textbox', { name: 'Linha final da mensagem' });
    const fullList = message.getByText(/^Lista completa: https:\/\/rathe-arsenal\.app\/d\//);
    const switchLine = dialog.getByText('Hoje a mensagem tem só as 16 que a loja não tem ou não achou.');
    const order = [
      await y(page, editorTitle),
      await y(page, heading),
      await y(page, dialog.getByText('Você pode editar antes de enviar.')),
      await y(page, message),
      await y(page, closingField),
      await y(page, fullList),
      await y(page, toggle),
      await y(page, switchLine),
      await y(page, send),
      await y(page, dialog.getByRole('button', { name: 'Desativar link' })),
    ];
    expect(
      [...order].sort((a, b) => a - b),
      'title, heading, hint, message, closing line, full list line, switch, its line, button, then the turn-off row last',
    ).toEqual(order);
    // The closing line is highlighted: a dashed box that the rest of the message does not have.
    const boxStyle = await closingField.evaluate((field) => getComputedStyle(field.closest('label')!).borderTopStyle);
    expect(boxStyle, 'the closing line sits in a dashed box').toBe('dashed');
    const messageStyle = await message.evaluate((node) => getComputedStyle(node).borderTopStyle);
    expect(messageStyle, 'the message box itself is not dashed').toBe('solid');
    await expect(switchLine).toBeVisible();
    const sendBox = (await send.boundingBox())!;
    expect(sendBox.x + sendBox.width, 'the button fits the phone').toBeLessThanOrEqual(page.viewportSize()!.width);
    await expectNoHorizontalScroll(page);
  });
});

test.describe('a visitor signed out', () => {
  test.use({ storageState: ANON_STORAGE_STATE });

  test('the group page puts what people can give above the store', async ({ page }) => {
    await pinPortuguese(page);
    await page.route(`**/api/shared/decks/${GROUP_TOKEN}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(groupPageStub(null)) }),
    );
    await page.goto(`/d/${GROUP_TOKEN}`, { waitUntil: 'networkidle' });

    const give = page.getByRole('heading', { name: 'Quem tiver, fala com Caio' });
    const store = page.getByRole('button', { name: /O resto dá para comprar na Cúpula DT/ });
    await expect(give).toBeVisible();
    await expect(store).toHaveAttribute('aria-expanded', 'false');
    expect(await y(page, give), 'the first section is above the store section').toBeLessThan(await y(page, store));
    expect(await y(page, page.getByRole('heading', { level: 1 })), 'the title is above the first section').toBeLessThan(await y(page, give));
    const rows = page.getByTestId('shared-card');
    expect(await rows.count()).toBeGreaterThan(5);
    expect(await rows.first().getByRole('button', { name: /^Oferecer / }).isVisible()).toBe(true);
    expect(await y(page, page.getByRole('button', { name: 'Copiar lista em texto' })), 'the copy button closes the page').toBeGreaterThan(await y(page, store));
    await expectNoHorizontalScroll(page);
  });
});

test.describe('a visitor who has some of the cards', () => {
  test('the friend view puts the summary above the first section and the combined button at its top', async ({ page }) => {
    await pinPortuguese(page);
    await stubSignedIn(page, { id: 'visitor-1', displayName: 'Dudu', shareClosingLine: null });
    await page.route(`**/api/shared/decks/${GROUP_TOKEN}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(groupPageStub({ 'reckless-swing-blue': 3, 'nullrune-hood': 1 })),
      }),
    );
    await page.goto(`/d/${GROUP_TOKEN}`, { waitUntil: 'networkidle' });

    const summary = page.getByText('Você tem 4 cópias de 2 cartas que Caio procura.');
    const give = page.getByRole('heading', { name: 'Quem tiver, fala com Caio' });
    const all = page.getByRole('button', { name: 'Oferecer as 2 cartas que você tem' });
    await expect(summary).toBeVisible();
    expect(await y(page, summary)).toBeLessThan(await y(page, give));
    expect(await y(page, give)).toBeLessThan(await y(page, all));
    expect(await y(page, all)).toBeLessThan(await y(page, page.getByTestId('shared-card').first()));
    const first = page.getByTestId('shared-card').first();
    await expect(first).toContainText('Você tem 3');

    // r3-offer-phone: the combined button opens the message before WhatsApp.
    await all.click();
    const sheet = page.getByTestId('share-dialog');
    await expect(sheet.getByText('Oferecer para Caio')).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'Mensagem para o WhatsApp' })).toBeVisible();
    await expect(sheet.getByText('Preencha edição, condição e preço no WhatsApp antes de enviar.')).toBeVisible();
    await expect(sheet.getByTestId('offer-message')).toContainText('Oi Caio, vi seu pedido no Rathe Arsenal. Tenho:');
    await expect(sheet.getByTestId('offer-message')).toContainText('3 Reckless Swing (Azul), edição __, condição __, R$ __ cada');
    await expect(sheet.getByRole('button', { name: 'Abrir no WhatsApp' })).toBeVisible();
    // Top to bottom: the sheet title, the heading, the hint, the text and the button last.
    const offerOrder = [
      await y(page, sheet.getByText('Oferecer para Caio')),
      await y(page, sheet.getByRole('heading', { name: 'Mensagem para o WhatsApp' })),
      await y(page, sheet.getByText('Preencha edição, condição e preço no WhatsApp antes de enviar.')),
      await y(page, sheet.getByTestId('offer-message')),
      await y(page, sheet.getByRole('button', { name: 'Abrir no WhatsApp' })),
    ];
    expect([...offerOrder].sort((a, b) => a - b), 'title, heading, hint, text, button').toEqual(offerOrder);
    await expectNoHorizontalScroll(page);
  });
});
