import { expect, request as playwrightRequest, type BrowserContext, type Page } from '@playwright/test';
import { BASE_URL } from './fixture';

const PASSWORD = 'pending-layout-password-123';

/**
 * Opens /library-pending as a throwaway account with three lines to resolve. The fixture user is never
 * touched: copies added to it would shift the readiness of its decks and the visual baselines.
 */
export async function openPendingResolver(page: Page, context: BrowserContext): Promise<void> {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const email = `pending-${Date.now().toString(36)}@test.local`;
  const signUp = await api.post('/api/auth/sign-up', { data: { email, password: PASSWORD } });
  expect(signUp.status()).toBe(201);
  const session = (signUp.headers()['set-cookie'] ?? '').match(/ra_session=([^;]+)/)?.[1];
  expect(session, 'the sign-up set the session cookie').toBeTruthy();

  const created = await api.post('/api/collection/imports', {
    data: {
      kind: 'csv',
      name: 'tablet.csv',
      ready: [{ cardIdentifier: 'snatch-red', quantity: 1 }],
      pending: [
        { lineNumber: 12, originalText: 'Snach,2,Vermelho', reason: 'suggestion', suggestedCardIdentifier: 'snatch-red' },
        { lineNumber: 31, originalText: 'Mistery Card,1,', reason: 'not_found' },
      ],
    },
  });
  expect(created.status()).toBe(201);
  await api.dispose();

  await context.addCookies([
    { name: 'ra_session', value: session!, domain: new URL(BASE_URL).hostname, path: '/api', httpOnly: true, secure: false, sameSite: 'Lax' },
  ]);
  await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
  await page.goto('/library-pending');
  await page.getByRole('button', { name: /^Adicionar 2 Snatch/ }).waitFor();
}
