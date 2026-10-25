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
