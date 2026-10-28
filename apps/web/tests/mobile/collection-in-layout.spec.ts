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
    await expectResolverLook(page, index);
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
  await expectUpdateMenuLook(page);

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
  await expectUpdateWindowLook(page);

  await buttons.nth(0).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('· 6 cópias')).toBeVisible();
  await api.dispose();
});

// The look of a Resolver step (`r4-resolve-b-phone`), checked inside the step-by-step walk above so it adds no account.
async function expectResolverLook(page: Page, index: number): Promise<void> {
  const SKIP_NOTE = 'Pular deixa a linha na lista. Ela volta na próxima vez que você abrir Resolver.';
  const boxOf = async (locator: ReturnType<Page['locator']>) => (await locator.first().boundingBox())!;

  if (index === 0) {
    // The bar: "‹ Coleção" on the left and "Sair e continuar depois" on the right, on one row, above the progress.
    const back = await boxOf(page.getByRole('link', { name: /Coleção/ }));
    const exit = await boxOf(page.getByRole('link', { name: 'Sair e continuar depois' }));
    const position = await boxOf(page.getByRole('heading', { level: 1 }));
    expect(Math.abs(back.y - exit.y), 'the two links share the bar').toBeLessThan(20);
    expect(back.x, '"‹ Coleção" is on the left').toBeLessThan(exit.x);
    expect(Math.max(back.y + back.height, exit.y + exit.height), 'the bar is above the progress').toBeLessThanOrEqual(position.y + 1);

    // The raw line is in the monospace face of the design system.
    const mono = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.fontFamily = 'var(--ra-font-mono)';
      document.body.append(probe);
      const family = getComputedStyle(probe).fontFamily;
      probe.remove();
      return family;
    });
    expect(mono, 'the monospace token resolves').toMatch(/mono|Mono|Courier/);
    expect(await page.getByText('Snach,2,Vermelho', { exact: true }).evaluate((node) => getComputedStyle(node).fontFamily)).toBe(mono);

    // The stepper reads "−" 2 "+" on one row, above the primary button.
    const less = await boxOf(page.getByRole('button', { name: 'Menos uma cópia' }));
    const value = await boxOf(page.getByText('2', { exact: true }));
    const more = await boxOf(page.getByRole('button', { name: 'Mais uma cópia' }));
    const add = await boxOf(page.getByRole('button', { name: /^Adicionar 2 Snatch/ }));
    expect(less.x + less.width, '"−" then the count').toBeLessThanOrEqual(value.x + 1);
    expect(value.x + value.width, 'the count then "+"').toBeLessThanOrEqual(more.x + 1);
    expect(Math.abs(less.y - more.y), 'one row').toBeLessThan(4);
    expect(more.y + more.height, 'the stepper is above the primary button').toBeLessThanOrEqual(add.y + 1);

    // "Não é esta, buscar" and "Pular" share a row, "Excluir esta linha" is under them, the note last.
    const notThis = await boxOf(page.getByRole('button', { name: 'Não é esta, buscar' }));
    const skip = await boxOf(page.getByRole('button', { name: 'Pular', exact: true }));
    const remove = await boxOf(page.getByRole('button', { name: 'Excluir esta linha' }));
    const note = await boxOf(page.getByText(SKIP_NOTE, { exact: true }));
    expect(Math.abs(notThis.y - skip.y), 'one row').toBeLessThan(4);
    expect(notThis.x, 'search first, skip second').toBeLessThan(skip.x);
    expect(remove.y, 'delete under the pair').toBeGreaterThanOrEqual(Math.max(notThis.y + notThis.height, skip.y + skip.height) - 1);
    expect(note.y, 'the note comes last').toBeGreaterThanOrEqual(remove.y + remove.height - 1);
    return;
  }

  // Every other step: no skip note.
  await expect(page.getByText(SKIP_NOTE, { exact: true })).toHaveCount(0);
  if (index === 1) {
    // Unknown word: "Mistery" goes in the search box and the no-card sentence follows it, above Adicionar.
    const box = page.getByRole('searchbox');
    await box.fill('Mistery');
    const sentence = page.getByText('Nenhuma carta com esse nome. Tente só uma palavra.');
    await expect(sentence).toBeVisible();
    const searchBox = await boxOf(box);
    const sentenceBox = await boxOf(sentence);
    const addBox = await boxOf(page.getByRole('button', { name: /^Adicionar$/ }));
    expect(searchBox.y + searchBox.height, 'the sentence is under the search box').toBeLessThanOrEqual(sentenceBox.y + 1);
    expect(sentenceBox.y + sentenceBox.height, 'Adicionar is under the sentence').toBeLessThanOrEqual(addBox.y + 1);
  }
}

async function colorOfToken(page: Page, token: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${value})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

// The look of the menu of `r6-update-import-a-phone`, checked inside the walk of its test so it adds no account.
async function expectUpdateMenuLook(page: Page): Promise<void> {
  const items = page.getByRole('menuitem');
  const danger = await colorOfToken(page, '--ra-ready-low');
  expect(await items.nth(2).evaluate((node) => getComputedStyle(node).color), '"Excluir" is in the danger color').toBe(danger);
  for (const index of [0, 1]) {
    expect(await items.nth(index).evaluate((node) => getComputedStyle(node).color), 'the other items are not in the danger color').not.toBe(danger);
  }
  const widths = await Promise.all([0, 1, 2].map(async (index) => Math.round((await items.nth(index).boundingBox())!.width)));
  expect(new Set(widths).size, 'the three items are as wide as each other').toBe(1);
}

// The look of the update window of `r6-update-import-a-phone`: title, rows with the label left and the count right, then the buttons.
async function expectUpdateWindowLook(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  const title = dialog.getByText('Atualizar fonte existente?');
  const dialogBox = (await dialog.boundingBox())!;
  const titleBox = (await title.boundingBox())!;
  const rows = dialog.locator('tr');
  await expect(rows).toHaveCount(4);
  const firstRowCells = rows.first().locator('td');
  const labelBox = (await firstRowCells.nth(0).boundingBox())!;
  const countBox = (await firstRowCells.nth(1).boundingBox())!;
  expect(titleBox.y + titleBox.height, 'the title is above the rows').toBeLessThanOrEqual(labelBox.y + 1);
  expect(labelBox.x, 'the label is on the left').toBeLessThan(countBox.x);
  expect(dialogBox.x + dialogBox.width - (countBox.x + countBox.width), 'the count is on the right edge').toBeLessThan(40);
  const lastRow = (await rows.last().boundingBox())!;

  const buttons = dialog.getByRole('button');
  const [primary, secondary, cancel] = [buttons.nth(0), buttons.nth(1), buttons.nth(2)];
  const boxes = await Promise.all([primary, secondary, cancel].map((button) => button.boundingBox()));
  expect(lastRow.y + lastRow.height, 'the buttons are under the rows').toBeLessThanOrEqual(boxes[0]!.y + 1);
  const widthsOfButtons = boxes.map((box) => Math.round(box!.width));
  expect(new Set(widthsOfButtons).size, 'the three buttons are as wide as each other').toBe(1);
  expect(widthsOfButtons[0]!, 'the buttons span the window').toBeGreaterThan(dialogBox.width - 60);
  const look = (button: typeof primary) =>
    button.evaluate((node) => {
      const style = getComputedStyle(node);
      return { background: style.backgroundColor, border: style.borderTopColor };
    });
  const [primaryLook, secondaryLook, cancelLook] = await Promise.all([look(primary), look(secondary), look(cancel)]);
  const transparent = 'rgba(0, 0, 0, 0)';
  expect(primaryLook.background, 'the primary button is filled with the accent').toBe(await colorOfToken(page, '--ra-accent'));
  expect(secondaryLook.background, 'the secondary button is not filled').toBe(transparent);
  expect(cancelLook.background, 'Cancelar is not filled').toBe(transparent);
  expect(cancelLook.border, 'Cancelar has no border').toBe(transparent);
  expect(secondaryLook.border, 'the secondary button has a border').not.toBe(transparent);
}
