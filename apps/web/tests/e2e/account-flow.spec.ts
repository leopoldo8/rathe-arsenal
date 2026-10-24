/**
 * Journey 1 end to end, signed out: the pitch on a computer, an account made from a shared deck
 * that comes back to it, and the code sign-in where a newer code replaces the older one.
 */
import { test, expect } from '@playwright/test';
import { ANON_STORAGE_STATE, BASE_URL, loadFixture } from '../support/fixture';
import { stubCodeSignIn, STUB_EMAIL } from '../support/account-stubs';

test.use({ storageState: ANON_STORAGE_STATE });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
});

async function enableDeckShare(deckId: number, jwt: string): Promise<{ token: string; deckName: string }> {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };
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
  const { jwt, readyDeckId } = loadFixture();
  const { token, deckName } = await enableDeckShare(readyDeckId, jwt);
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
  const { jwt } = loadFixture();
  const { issued } = await stubCodeSignIn(page, { jwt, email: STUB_EMAIL });
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
