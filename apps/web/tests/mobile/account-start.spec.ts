/**
 * The one-field start on a phone (screens `r3-arrive-phone` and `r2-typo-phone`): the pitch is
 * visible, a typo sends nothing, and an address typed two ways is one account. Signed out, so every
 * test starts with an empty browser.
 */
import { test, expect, type Page } from '@playwright/test';
import { ANON_STORAGE_STATE } from '../support/fixture';

test.use({ storageState: ANON_STORAGE_STATE });

test.beforeEach(async ({ page }) => {
  // The product's language is pt-BR; without the pin the browser's own language decides.
  await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
});

async function expectInView(page: Page, text: string | RegExp): Promise<void> {
  const target = page.getByText(text).first();
  await expect(target).toBeVisible();
  await expect(target).toBeInViewport({ ratio: 1 });
}

test('the pitch is visible on a phone', async ({ page }) => {
  await page.goto('/');

  await expectInView(page, 'Monte seus decks de Flesh and Blood, veja quais cartas você já tem e quanto custa o que falta.');
  await expectInView(page, 'Confere se o deck pode jogar no torneio');
  await expectInView(page, 'Lista o que falta, com o preço na loja');
  await expectInView(page, 'Manda a lista pronta no WhatsApp');
  await expectInView(page, 'Seu e-mail');
});

test('a typo sends no request', async ({ page }) => {
  const authRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/auth/')) authRequests.push(request.url());
  });
  await page.goto('/entrar');

  await page.getByLabel('Seu e-mail').fill('bia@gmail');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByText('Falta o final do e-mail, por exemplo bia@gmail.com')).toBeVisible();
  await expect(page.getByLabel('Seu e-mail')).toBeFocused();
  await expect(page.getByText('Nada foi enviado ainda.')).toBeVisible();
  expect(authRequests).toEqual([]);
});

test('an address typed two ways is one account', async ({ page }) => {
  const lower = `bia.${Date.now().toString(36)}@gmail.com`;
  const typed = ` ${lower.replace('bia', 'Bia').replace('gmail', 'Gmail')} `;
  await page.goto('/');

  await page.getByLabel('Seu e-mail').fill(typed);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Criar conta e entrar' }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByRole('button', { name: 'Menu do usuário' }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await page.goto('/');
  await page.getByLabel('Seu e-mail').fill(lower);
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: 'Digite o código' })).toBeVisible();
  await expect(page.getByText(`Mandamos para ${lower}.`)).toBeVisible();
});
