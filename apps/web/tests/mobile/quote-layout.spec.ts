/**
 * Phone layout of the store quote page (`r3-quote-phone`). The answer is served from a stub, so the page never
 * depends on the fixture user's deck or on what the store holds today.
 */
import { test, expect, type Page } from '@playwright/test';
import { pinPortuguese } from '../e2e/helpers';
import { ANON_STORAGE_STATE } from '../support/fixture';
import { QUOTE_TOKEN, quotePageStub } from '../support/sharing-stubs';

test.use({ storageState: ANON_STORAGE_STATE });

async function top(locator: ReturnType<Page['locator']>): Promise<number> {
  const box = await locator.first().boundingBox();
  expect(box, 'the block is drawn').not.toBeNull();
  return box!.y;
}

test('the quote page follows r3-quote-phone', async ({ page }) => {
  await pinPortuguese(page);
  await page.route(`**/api/shared/decks/${QUOTE_TOKEN}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(quotePageStub()) }),
  );
  await page.goto(`/d/${QUOTE_TOKEN}`, { waitUntil: 'networkidle' });
  const viewport = page.viewportSize()!;

  const title = page.getByText('Pedido de orçamento', { exact: true });
  const heading = page.getByRole('heading', { level: 1, name: 'Caio pediu um orçamento para estas cartas.' });
  const lead = page.getByText('Marque o que você tem e o preço; a resposta vai pelo WhatsApp.');
  const needs = page.getByText('Caio ainda precisa de 10 cópias (4 cartas menos as que ele já tem).');
  const firstRow = page.getByTestId('quote-row').first();
  const preview = page.getByTestId('quote-preview');
  const previewTitle = page.getByRole('heading', { level: 2, name: 'Prévia da mensagem' });
  const spreadsheet = page.getByRole('button', { name: 'Copiar a lista para a sua planilha' });
  const footer = page.getByTestId('shared-deck-footer');
  const bar = page.getByTestId('quote-bar');
  await expect(heading).toBeVisible();
  const order = [await top(title), await top(heading), await top(lead), await top(needs), await top(firstRow), await top(previewTitle), await top(preview), await top(spreadsheet), await top(footer)];
  expect([...order].sort((a, b) => a - b), 'title, two header lines, needed count, rows, standing preview, spreadsheet button, disclaimer').toEqual(order);

  await expect(previewTitle).toBeVisible();
  await expect(preview).toContainText('Marque as cartas que você tem para ver a mensagem.');

  // One block per card: name, "precisa de N", the "Tenho" stepper, the unit price with "R$", and the note.
  await expect(page.getByTestId('quote-row')).toHaveCount(4);
  await expect(firstRow).toContainText('Alpha Rampage (Vermelho)');
  await expect(firstRow).toContainText('precisa de 1');
  await expect(firstRow.getByRole('group', { name: 'Tenho' }).getByRole('button')).toHaveText(['0', '1']);
  await expect(firstRow.getByText('Preço por unidade')).toBeVisible();
  await expect(firstRow.getByText('R$', { exact: true })).toBeVisible();
  await expect(firstRow.getByPlaceholder('Observação (edição, condição)')).toBeVisible();
  const rowBox = (await firstRow.boundingBox())!;
  expect(rowBox.x + rowBox.width, 'a row fits the phone').toBeLessThanOrEqual(viewport.width);

  // The bar stays at the foot of the screen with the running total.
  await expect(bar).toContainText('Seu orçamento: 0 de 10 cópias · R$ 0,00');
  const barBox = (await bar.boundingBox())!;
  expect(barBox.y + barBox.height, 'the bar sits at the bottom').toBeGreaterThanOrEqual(viewport.height - 1);
  await firstRow.getByRole('button', { name: 'Tenho 1 de Alpha Rampage (Vermelho)' }).click();
  await firstRow.getByLabel('Preço por unidade de Alpha Rampage (Vermelho)').fill('120,00');
  await expect(bar).toContainText('Seu orçamento: 1 de 10 cópias · R$ 120,00');
  await expect(bar.getByRole('button', { name: 'Ver mensagem e enviar' })).toBeEnabled();

  await expect(page.getByText(/C[uú]pula/)).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
});
