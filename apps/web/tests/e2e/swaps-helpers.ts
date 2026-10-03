import { expect, type Locator, type Page } from '@playwright/test';

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const FIXTURE_EMAIL = process.env.FIXTURE_EMAIL ?? 'fixture@test.local';
const FIXTURE_PASS = process.env.FIXTURE_PASS ?? 'test-password-1234';

export const SETTLE_MS = 1500;

export async function signIn(page: Page): Promise<string> {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
  const jwt = await page.evaluate(
    async ([apiBase, email, pass]) => {
      const res = await fetch(`${apiBase}/api/auth/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      if (!res.ok) throw new Error(`sign-in failed: ${res.status}`);
      const body = (await res.json()) as { jwt?: string };
      if (!body.jwt) throw new Error('sign-in returned no jwt');
      return body.jwt;
    },
    [BASE_URL, FIXTURE_EMAIL, FIXTURE_PASS] as [string, string, string],
  );
  await seedSession(page, jwt);
  return jwt;
}

// Pins the language so every selector below can use the pt-BR copy.
export async function seedSession(page: Page, jwt: string): Promise<void> {
  await page.evaluate((token: string) => {
    localStorage.setItem('rathe-arsenal:jwt', token);
    localStorage.setItem('rathe.lang', 'pt-BR');
  }, jwt);
}

export async function openSwaps(page: Page, state = 'pending'): Promise<void> {
  await page.goto(`${BASE_URL}/swaps?state=${state}`, { waitUntil: 'networkidle', timeout: 20000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Trocas' })).toBeVisible();
}

export const swapRows = (page: Page): Locator => page.getByTestId('swap-row');

export function tab(page: Page, name: 'Pendentes' | 'Aplicadas' | 'Recusadas' | 'Todas'): Locator {
  return page.getByRole('tab', { name: new RegExp(`^${name}`) });
}

export async function tabCount(page: Page, name: 'Pendentes' | 'Aplicadas' | 'Recusadas'): Promise<number> {
  const label = (await tab(page, name).getAttribute('aria-label')) ?? '';
  const count = Number(label.split('—').pop()?.trim());
  if (Number.isNaN(count)) throw new Error(`no count in tab label "${label}"`);
  return count;
}
