import { expect, request as playwrightRequest, type BrowserContext, type Page } from '@playwright/test';
import { BASE_URL } from './fixture';

const PASSWORD = 'spare-layout-password-123';

const SPARE_CARDS = ['snatch-red', 'savage-beatdown-red', 'pummel-red', 'head-jab-red', 'wounding-blow-red'];

/** The throwaway account is made once per run: sign-ups are limited to 20 an hour per address. */
let sharedSession: string | null = null;

async function sessionOfSpareAccount(): Promise<string> {
  if (sharedSession !== null) return sharedSession;
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const email = `spare-${Date.now().toString(36)}@test.local`;
  const signUp = await api.post('/api/auth/sign-up', { data: { email, password: PASSWORD } });
  expect(signUp.status()).toBe(201);
  const session = (signUp.headers()['set-cookie'] ?? '').match(/ra_session=([^;]+)/)?.[1];
  expect(session, 'the sign-up set the session cookie').toBeTruthy();

  const copies = await api.post('/api/collection/cards/batch', {
    data: { items: SPARE_CARDS.map((cardIdentifier, index) => ({ cardIdentifier, quantity: index + 2 })) },
  });
  expect(copies.ok()).toBe(true);
  await api.dispose();
  sharedSession = session!;
  return sharedSession;
}

/**
 * Opens /spare as a throwaway account that owns a few cards and no deck, so every copy is spare and no rule
 * question is asked. The fixture user is never touched: its copies would shift the visual baselines.
 */
export async function openSparePageWithCards(page: Page, context: BrowserContext): Promise<{ dispose: () => Promise<void> }> {
  const session = await sessionOfSpareAccount();
  await context.addCookies([
    { name: 'ra_session', value: session, domain: new URL(BASE_URL).hostname, path: '/api', httpOnly: true, secure: false, sameSite: 'Lax' },
  ]);
  await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
  await page.goto('/spare');
  await page.getByTestId('spare-row').first().waitFor();
  return { dispose: async () => undefined };
}
