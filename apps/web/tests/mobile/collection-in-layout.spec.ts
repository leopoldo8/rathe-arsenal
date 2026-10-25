/**
 * Phone layout of the "getting cards in" screens. The data belongs to a throwaway account created
 * through the API, never to the fixture user: copies added to the fixture would shift the readiness
 * of its decks and the visual baselines.
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';
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

test('the page behind "Resolver" fits a phone with no control over another', async ({ page, context }) => {
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

  const viewport = page.viewportSize()!;
  const steps = [/^Adicionar 2 Snatch/, /^Adicionar$/, /^Adicionar 3 Savage/];
  for (const [index, addName] of steps.entries()) {
    const add = page.getByRole('button', { name: addName });
    await add.waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `step ${index + 1}: no horizontal scroll`).toBeLessThanOrEqual(0);

    const boxes = await page.locator('main').locator('a, button, input').evaluateAll((elements) =>
      elements
        .map((element) => ({ name: element.textContent?.trim() || element.getAttribute('aria-label') || element.tagName, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0)
        .map(({ name, rect }) => ({ name, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom })),
    );
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
