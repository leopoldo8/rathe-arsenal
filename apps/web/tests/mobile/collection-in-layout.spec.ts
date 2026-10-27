/**
 * Phone layout of the "getting cards in" screens. The data belongs to a throwaway account created
 * through the API, never to the fixture user: copies added to the fixture would shift the readiness
 * of its decks and the visual baselines.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { ANON_STORAGE_STATE, BASE_URL } from '../support/fixture';

test.use({ storageState: ANON_STORAGE_STATE });

const PASSWORD = 'collection-in-layout-password-123';

test('the remove picker opens inside the screen', async ({ page, context }) => {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const email = `layout-${Date.now().toString(36)}@test.local`;
  const signUp = await api.post('/api/auth/sign-up', { data: { email, password: PASSWORD } });
  expect(signUp.status()).toBe(201);
  const session = (signUp.headers()['set-cookie'] ?? '').match(/ra_session=([^;]+)/)?.[1];
  expect(session, 'the sign-up set the session cookie').toBeTruthy();

  // One card at two versions: the "−" has two rows to take from.
  const copies = await api.post('/api/collection/cards/batch', {
    data: {
      items: [
        { cardIdentifier: 'snatch-red', quantity: 2 },
        { cardIdentifier: 'snatch-red', quantity: 1, printingCode: 'WTR167' },
      ],
    },
  });
  expect(copies.ok()).toBe(true);

  await context.addCookies([
    { name: 'ra_session', value: session!, domain: new URL(BASE_URL).hostname, path: '/api', httpOnly: true, secure: false, sameSite: 'Lax' },
  ]);
  await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
  await page.goto('/library');

  const remove = page.getByRole('button', { name: /Remover um.*Snatch/ });
  await remove.waitFor();
  await remove.click({ force: true });

  const picker = page.getByRole('menu');
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('menuitem')).toHaveCount(2);
  const box = await picker.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box, 'the picker has a box').not.toBeNull();
  expect(box!.x, 'left edge').toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, 'right edge').toBeLessThanOrEqual(viewport.width);
  expect(box!.y, 'top edge').toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, 'bottom edge').toBeLessThanOrEqual(viewport.height);

  await api.dispose();
});

async function openResolverWithThreeLines(page: Page, context: BrowserContext): Promise<APIRequestContext> {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const email = `resolve-${Date.now().toString(36)}@test.local`;
  const signUp = await api.post('/api/auth/sign-up', { data: { email, password: PASSWORD } });
  expect(signUp.status()).toBe(201);
  const session = (signUp.headers()['set-cookie'] ?? '').match(/ra_session=([^;]+)/)?.[1];
  expect(session, 'the sign-up set the session cookie').toBeTruthy();

  const created = await api.post('/api/collection/imports', {
    data: {
      kind: 'csv',
      name: 'colecao-com-um-nome-muito-comprido-para-conferir-a-quebra.csv',
      ready: [{ cardIdentifier: 'snatch-red', quantity: 1 }],
      pending: [
        { lineNumber: 12, originalText: 'Snach,2,Vermelho', reason: 'suggestion', suggestedCardIdentifier: 'snatch-red' },
        { lineNumber: 31, originalText: 'Mistery Card,1,', reason: 'not_found' },
        { lineNumber: 141, originalText: 'Savage Beatdown,três,Vermelho', reason: 'bad_quantity', suggestedCardIdentifier: 'savage-beatdown-red' },
      ],
    },
  });
  expect(created.status()).toBe(201);

  await context.addCookies([
    { name: 'ra_session', value: session!, domain: new URL(BASE_URL).hostname, path: '/api', httpOnly: true, secure: false, sameSite: 'Lax' },
  ]);
  await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
  await page.goto('/library-pending');
  return api;
}

test('the page behind "Resolver" fits a phone with no control over another', async ({ page, context }) => {
  const api = await openResolverWithThreeLines(page, context);

  const viewport = page.viewportSize()!;
  const steps = [/^Adicionar 2 Snatch/, /^Adicionar$/, /^Adicionar 3 Savage/];
  for (const [index, addName] of steps.entries()) {
    const add = page.getByRole('button', { name: addName });
    await add.waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `step ${index + 1}: no horizontal scroll`).toBeLessThanOrEqual(0);

    // This route renders outside the app shell and has no <main>, so the whole body is the page.
    const boxes = await page.locator('body').locator('a, button, input').evaluateAll((elements) =>
      elements
        .map((element) => ({ name: element.textContent?.trim() || element.getAttribute('aria-label') || element.tagName, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0)
        .map(({ name, rect }) => ({ name, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom })),
    );
    expect(boxes.length, `step ${index + 1}: controls were collected`).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.x, `${box.name}: left edge`).toBeGreaterThanOrEqual(0);
      expect(box.right, `${box.name}: right edge`).toBeLessThanOrEqual(viewport.width);
    }
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const overlaps = a.x < b.right - 0.5 && b.x < a.right - 0.5 && a.y < b.bottom - 0.5 && b.y < a.bottom - 0.5;
        expect(overlaps, `step ${index + 1}: "${a.name}" overlaps "${b.name}"`).toBe(false);
      }
    }
    await page.getByRole('button', { name: 'Pular' }).click();
  }

  await api.dispose();
});

test('the page behind Resolver follows r4-resolve-b-phone at 390 px', async ({ page, context }) => {
  const api = await openResolverWithThreeLines(page, context);

  const steps = [
    { add: /^Adicionar 2 Snatch/, raw: 'Snach,2,Vermelho', buttons: ['Não é esta, buscar', 'Pular', 'Excluir esta linha'] },
    { add: /^Adicionar$/, raw: 'Mistery Card,1,', buttons: ['Pular', 'Excluir esta linha'] },
    { add: /^Adicionar 3 Savage/, raw: 'Savage Beatdown,três,Vermelho', buttons: ['Pular', 'Excluir esta linha'] },
  ];
  for (const [index, step] of steps.entries()) {
    await page.getByRole('button', { name: step.add }).waitFor();
    await expect(page.getByText(step.raw, { exact: true })).toBeVisible();
    for (const name of step.buttons) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `step ${index + 1}: no horizontal scroll`).toBeLessThanOrEqual(0);

    const heights = await page.locator('button').evaluateAll((buttons) =>
      buttons
        .map((button) => ({ name: button.textContent?.trim() || button.getAttribute('aria-label') || 'button', rect: button.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0)
        .map(({ name, rect }) => ({ name, height: rect.height, width: rect.width })),
    );
    expect(heights.length, `step ${index + 1}: buttons found`).toBeGreaterThanOrEqual(step.buttons.length + 3);
    for (const { name, height, width } of heights) {
      expect(height, `step ${index + 1}: "${name}" height`).toBeGreaterThanOrEqual(44);
      expect(width, `step ${index + 1}: "${name}" width`).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Pular' }).click();
  }

  await api.dispose();
});

test('long import names wrap on a phone', async ({ page, context }) => {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const email = `names-${Date.now().toString(36)}@test.local`;
  const signUp = await api.post('/api/auth/sign-up', { data: { email, password: PASSWORD } });
  expect(signUp.status()).toBe(201);
  const session = (signUp.headers()['set-cookie'] ?? '').match(/ra_session=([^;]+)/)?.[1];
  expect(session, 'the sign-up set the session cookie').toBeTruthy();

  const name = 'colecao-lucas-importada-em-outubro-2026';
  expect(name).toHaveLength(39);
  const longName = `${name}!`;
  const created = await api.post('/api/collection/imports', {
    data: { kind: 'csv', name: longName, ready: [{ cardIdentifier: 'snatch-red', quantity: 1 }], pending: [] },
  });
  expect(created.status()).toBe(201);

  await context.addCookies([
    { name: 'ra_session', value: session!, domain: new URL(BASE_URL).hostname, path: '/api', httpOnly: true, secure: false, sameSite: 'Lax' },
  ]);
  await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
  await page.goto('/library-csv-sources');

  const label = page.getByRole('button', { name: /Renomear/ }).first();
  await label.waitFor();
  await expect(label).toHaveText(longName);
  const measured = await label.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      textOverflow: style.textOverflow,
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(style.lineHeight),
    };
  });
  expect(measured.textOverflow).not.toBe('ellipsis');
  expect(measured.scrollWidth).toBeLessThanOrEqual(measured.clientWidth);
  expect(measured.height, 'the name takes a second line').toBeGreaterThan(measured.lineHeight * 1.5);

  await api.dispose();
});

test('the imports page follows r6-update-import-a-phone', async ({ page, context }) => {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const email = `update-${Date.now().toString(36)}@test.local`;
  const signUp = await api.post('/api/auth/sign-up', { data: { email, password: PASSWORD } });
  expect(signUp.status()).toBe(201);
  const session = (signUp.headers()['set-cookie'] ?? '').match(/ra_session=([^;]+)/)?.[1];
  expect(session, 'the sign-up set the session cookie').toBeTruthy();
  const first = Buffer.from('Name,Quantity\nSnatch (Red),2\nPummel (Red),1\nPack Hunt (Blue),3\n');
  const created = await api.post('/api/collection/csv', { multipart: { file: { name: 'colecao-lucas.csv', mimeType: 'text/csv', buffer: first } } });
  expect(created.status()).toBe(201);

  await context.addCookies([
    { name: 'ra_session', value: session!, domain: new URL(BASE_URL).hostname, path: '/api', httpOnly: true, secure: false, sameSite: 'Lax' },
  ]);
  await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
  await page.goto('/library-csv-sources');
  const row = page.getByRole('listitem').filter({ hasText: 'colecao-lucas.csv' });
  await expect(row).toBeVisible();

  // The "•••" menu: Renomear, Enviar nova versão, a separator, Excluir in the danger color; each item 44 px or more.
  await row.getByRole('button', { name: /^Opções para/ }).click();
  const items = page.getByRole('menuitem');
  await expect(items).toHaveText(['Renomear', 'Enviar nova versão', 'Excluir']);
  const boxes = await Promise.all([0, 1, 2].map((index) => items.nth(index).boundingBox()));
  for (const box of boxes) expect(Math.round(box!.height), 'each menu item is at least 44 px high').toBeGreaterThanOrEqual(44);
  const separator = (await page.getByRole('separator').boundingBox())!;
  expect(separator.y).toBeGreaterThanOrEqual(boxes[1]!.y + boxes[1]!.height - 1);
  expect(separator.y + separator.height).toBeLessThanOrEqual(boxes[2]!.y + 1);
  const danger = await items.nth(2).evaluate((node) => getComputedStyle(node).color);
  const accent = await items.nth(1).evaluate((node) => getComputedStyle(node).color);
  expect(danger, 'Excluir is not the color of the other items').not.toBe(accent);

  // The chooser belongs to this import: picking a file opens the window with the counts the server returned.
  const update = Buffer.from('Name,Quantity\nSnatch (Red),3\nCommand and Conquer (Red),2\nSink Below (Yellow),1\n');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'nova-versao.csv', mimeType: 'text/csv', buffer: update });
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Atualizar fonte existente?')).toBeVisible();
  const rows = await dialog.locator('tr').evaluateAll((nodes) => nodes.map((node) => [...node.querySelectorAll('td')].map((cell) => cell.textContent)));
  expect(rows).toEqual([['Cartas novas', '2'], ['Aumentaram', '1'], ['Diminuíram', '0'], ['Removidas', '2']]);
  const buttons = dialog.getByRole('button');
  await expect(buttons).toHaveText(['Atualizar a existente', 'Substituir pela nova', 'Cancelar']);
  const buttonBoxes = await Promise.all([0, 1, 2].map((index) => buttons.nth(index).boundingBox()));
  for (const box of buttonBoxes) expect(Math.round(box!.height), 'each window button is at least 44 px high').toBeGreaterThanOrEqual(44);
  expect(buttonBoxes[0]!.y).toBeLessThan(buttonBoxes[1]!.y);
  expect(buttonBoxes[1]!.y).toBeLessThan(buttonBoxes[2]!.y);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);

  await buttons.nth(0).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('· 6 cópias')).toBeVisible();
  await api.dispose();
});
