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
  await page.goto('/entrar');
  // The page asks `/api/auth/me` who is signed in as it loads; the typo is judged after that settles.
  await page.waitForLoadState('networkidle');
  const authRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/auth/')) authRequests.push(request.url());
  });

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

test('the password change follows r6-password-b-phone', async ({ page }) => {
  const email = `lucas.${Date.now().toString(36)}@hotmail.com`;
  expect((await page.request.post('/api/auth/sign-up', { data: { email, password: 'the-old-password-123' } })).status()).toBe(201);
  await page.goto('/settings');
  const conta = page.getByRole('heading', { level: 2, name: 'Conta' }).locator('xpath=ancestor::section[1]');
  const asked = page.waitForResponse('**/api/users/me/password-code');
  await conta.getByRole('button', { name: 'Mudar a senha' }).click();
  const { _devCode: code } = (await (await asked).json()) as { _devCode: string };

  // Frame one: the row stays, then the e-mailed code step, then the note.
  await expect(conta.getByText(email, { exact: true }).first()).toBeVisible();
  const lead = conta.getByText(/Mandamos para/);
  await expect(lead).toContainText(`Mandamos para ${email}. Ele vale 15 minutos.`);
  expect(await lead.locator('b').innerText()).toBe(email);
  const firstBox = conta.getByLabel('Dígito 1 de 6');
  await expect(firstBox).toBeFocused();
  const boxes = await Promise.all([1, 2, 3, 4, 5, 6].map((position) => conta.getByLabel(`Dígito ${position} de 6`).boundingBox()));
  for (const box of boxes) expect(box!.height, 'each code box is at least 44 px high').toBeGreaterThanOrEqual(44);
  expect(new Set(boxes.map((box) => Math.round(box!.y))).size, 'the six boxes share one row').toBe(1);
  const resend = conta.getByRole('button', { name: /^Reenviar em \d+ s$/ });
  await expect(resend).toHaveAttribute('aria-disabled', 'true');
  const resendBox = (await resend.boundingBox())!;
  expect(resendBox.height).toBeGreaterThanOrEqual(44);
  expect(resendBox.width, 'the resend button is full width').toBeGreaterThan(boxes[5]!.x + boxes[5]!.width - boxes[0]!.x - 4);
  const cancelBox = (await conta.getByRole('button', { name: 'Cancelar' }).boundingBox())!;
  const noteBox = (await conta.getByText('Você também pode entrar com um código por e-mail, sem senha.').boundingBox())!;
  expect(boxes[0]!.y + boxes[0]!.height).toBeLessThan(resendBox.y);
  expect(resendBox.y + resendBox.height).toBeLessThan(cancelBox.y);
  expect(cancelBox.y + cancelBox.height).toBeLessThanOrEqual(noteBox.y);

  // Frame two: after the sixth digit, the new password field, then "Cancelar" and "Salvar senha" in one row at the right.
  await page.keyboard.type(code);
  const field = conta.getByLabel('Nova senha');
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('');
  await expect(conta.getByText('Pelo menos 10 caracteres.')).toBeVisible();
  const [cancel, save, fieldBox] = await Promise.all([
    conta.getByRole('button', { name: 'Cancelar' }).boundingBox(),
    conta.getByRole('button', { name: 'Salvar senha' }).boundingBox(),
    field.boundingBox(),
  ]);
  expect(Math.abs(cancel!.y - save!.y), 'both buttons share one row').toBeLessThan(4);
  expect(cancel!.x, '"Cancelar" is left of "Salvar senha"').toBeLessThan(save!.x);
  expect(save!.x + save!.width, 'the row is at the right').toBeGreaterThan(fieldBox!.x + fieldBox!.width - 4);
  expect(save!.height).toBeGreaterThanOrEqual(44);
  expect(cancel!.height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
});
