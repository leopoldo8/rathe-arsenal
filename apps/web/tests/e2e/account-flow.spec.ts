/**
 * Journey 1 end to end, signed out: the pitch on a computer, an account made from a shared deck
 * that comes back to it, and the code sign-in where a newer code replaces the older one.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, request, type Page } from '@playwright/test';
import { ANON_STORAGE_STATE, BASE_URL, STORAGE_STATE_PATH, fixtureCredentials, loadFixture } from '../support/fixture';
import { stubCodeSignIn, STUB_EMAIL } from '../support/account-stubs';

test.use({ storageState: ANON_STORAGE_STATE });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
});

async function enableDeckShare(deckId: number, sessionToken: string): Promise<{ token: string; deckName: string }> {
  const headers = { 'Content-Type': 'application/json', Cookie: `ra_session=${sessionToken}` };
  await fetch(`${BASE_URL}/api/users/me/display-name`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ displayName: 'Fixture' }),
  });
  const current = await fetch(`${BASE_URL}/api/decks/${deckId}/share`, { headers });
  const state = (await current.json()) as { deck: { token: string } | null };
  let token = state.deck?.token;
  if (!token) {
    const created = await fetch(`${BASE_URL}/api/decks/${deckId}/share`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ intent: 'deck' }),
    });
    if (!created.ok) throw new Error(`could not enable the fixture deck share link: ${created.status}`);
    token = ((await created.json()) as { token: string }).token;
  }
  const shared = await fetch(`${BASE_URL}/api/shared/decks/${token}`);
  return { token, deckName: ((await shared.json()) as { name: string }).name };
}

test('the pitch is visible on a computer', async ({ page }) => {
  await page.goto('/');

  for (const text of [
    'Monte seus decks de Flesh and Blood, veja quais cartas você já tem e quanto custa o que falta.',
    'Confere se o deck pode jogar no torneio',
    'Lista o que falta, com o preço na loja',
    'Manda a lista pronta no WhatsApp',
    'Seu e-mail',
  ]) {
    await expect(page.getByText(text).first()).toBeInViewport({ ratio: 1 });
  }
});

test('an account made from a shared deck comes back to it', async ({ page }) => {
  const { sessionToken, readyDeckId } = loadFixture();
  const { token, deckName } = await enableDeckShare(readyDeckId, sessionToken);
  const email = `renata.${Date.now().toString(36)}@cupuladt.com.br`;

  await page.goto(`/d/${token}`);
  await page.getByTestId('shared-invite').getByRole('link', { name: 'Criar conta' }).click();
  await expect(page.getByText(`${deckName} · por Fixture`)).toBeVisible();
  await expect(page.getByText('Crie a conta para comparar o deck do Fixture com as suas cartas.')).toBeVisible();
  await expect(page.getByText(/Monte seus decks/)).toHaveCount(0);
  await page.getByLabel('Seu e-mail').fill(email);
  await page.getByRole('button', { name: 'Continuar' }).click();
  const signUpRequest = page.waitForRequest('**/api/auth/sign-up');
  await page.getByRole('button', { name: 'Criar conta e entrar' }).click();
  expect((await signUpRequest).postDataJSON()).toMatchObject({ email, returnPath: `/d/${token}`, shareToken: token });

  await expect(page).toHaveURL(new RegExp(`/d/${token}$`));
  await expect(page.getByText('Conta criada. Você voltou para o deck do Fixture.', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Você ainda não tem cartas no Rathe Arsenal. Para comparar, coloque as suas cartas:'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Colar uma lista' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Enviar uma planilha (.csv)' })).toBeVisible();
});

test('the second code works and the first does not', async ({ page }) => {
  const { sessionToken } = loadFixture();
  const { issued } = await stubCodeSignIn(page, { sessionToken, email: STUB_EMAIL });
  await page.goto('/entrar');

  await page.getByLabel('Seu e-mail').fill(STUB_EMAIL);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Digite o código' })).toBeVisible();
  await expect.poll(() => issued.length).toBe(1);
  await page.getByRole('button', { name: 'Reenviar' }).click();
  await expect.poll(() => issued.length).toBe(2);
  const [first, second] = issued as [string, string];

  await page.getByLabel('Dígito 1 de 6').click();
  await page.keyboard.type(first);
  await expect(page.getByText('Este código não confere. Confira no e-mail.')).toBeVisible();
  await page.getByLabel('Dígito 1 de 6').click();
  await page.keyboard.type(second);

  await expect(page).toHaveURL(/\/home/);
});

// ---------------------------------------------------------------------------
// S32: the session is the httpOnly `ra_session` cookie (door 17).
// ---------------------------------------------------------------------------

async function signInThroughTheStartPage(page: Page): Promise<void> {
  const { email, password } = fixtureCredentials();
  await page.getByLabel('Seu e-mail').fill(email);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

test('the session is invisible to page scripts', async ({ page }) => {
  await page.goto('/entrar');
  await signInThroughTheStartPage(page);

  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByText('Rhinar Swap Test').first()).toBeVisible();
  expect(await page.evaluate(() => document.cookie)).not.toContain('ra_session');
  expect(await page.evaluate(() => localStorage.getItem('rathe-arsenal:jwt'))).toBeNull();
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === 'ra_session')).toMatchObject({ httpOnly: true, path: '/api' });
});

test('a protected page opened signed out comes back after sign-in', async ({ page }) => {
  const { readyDeckId } = loadFixture();

  await page.goto(`/decks/${readyDeckId}`);

  await expect(page.getByLabel('Seu e-mail')).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);
  await signInThroughTheStartPage(page);
  await expect(page).toHaveURL(new RegExp(`/decks/${readyDeckId}$`));
  await expect(page.getByTestId('deck-detail-view')).toBeVisible();
});

test('a session that ends mid-edit keeps the page and the draft', async ({ browser }) => {
  const { readyDeckId } = loadFixture();
  const { email, password } = fixtureCredentials();
  const context = await browser.newContext({ storageState: ANON_STORAGE_STATE, baseURL: BASE_URL });
  await context.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
  const signedIn = await context.request.post('/api/auth/sign-in', { data: { email, password } });
  expect(signedIn.status()).toBe(200);
  const page = await context.newPage();
  await page.goto(`/decks/${readyDeckId}?edit=1`);
  await expect(page.getByTestId('deck-canvas-edit')).toBeVisible();
  const row = page.locator('[data-testid^="editable-card-row-"]').first();
  const quantity = row.locator('[aria-live="polite"]');
  const before = Number(await quantity.textContent());
  await row.locator('[data-testid^="increment-"]').click();
  await expect(quantity).toHaveText(String(before + 1));

  // Another device signs this session out.
  const token = (await context.cookies()).find((cookie) => cookie.name === 'ra_session')?.value ?? '';
  const elsewhere = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { Cookie: `ra_session=${token}` } });
  expect((await elsewhere.post('/api/auth/sign-out')).status()).toBe(204);
  await elsewhere.dispose();
  await page.getByTestId('deck-detail-save-btn').click();

  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('Seu e-mail')).toBeVisible();
  await sheet.getByRole('button', { name: 'Continuar' }).click();
  await sheet.getByLabel('Senha').fill(password);
  await sheet.getByRole('button', { name: 'Entrar', exact: true }).click();

  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/decks/${readyDeckId}\\?edit=`));
  await expect(page.locator('[data-testid^="editable-card-row-"]').first().locator('[aria-live="polite"]')).toHaveText(
    String(before + 1),
  );
  await context.close();
});

test('the fixture session is a cookie', async ({ request: api }) => {
  const state = JSON.parse(readFileSync(STORAGE_STATE_PATH, 'utf8')) as {
    cookies: { name: string; httpOnly: boolean; domain: string; value: string }[];
    origins: { localStorage: { name: string }[] }[];
  };
  const cookie = state.cookies.find((entry) => entry.name === 'ra_session');
  expect(cookie).toMatchObject({ httpOnly: true, domain: new URL(BASE_URL).hostname });
  for (const origin of state.origins) {
    expect(origin.localStorage.map((entry) => entry.name)).not.toContain('rathe-arsenal:jwt');
  }

  const seed = readFileSync(fileURLToPath(new URL('../../../../scripts/fixture/fixture-seed.ts', import.meta.url)), 'utf8');
  expect(seed).toMatch(/Cookie/);
  expect(seed).not.toMatch(/Authorization/);
  const me = await api.get(`${BASE_URL}/api/auth/me`, { headers: { Cookie: `ra_session=${cookie?.value}` } });
  expect(me.status()).toBe(200);
});
