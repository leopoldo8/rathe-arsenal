import { expect, type Locator, type Page } from '@playwright/test';

import { BASE_URL } from '../support/fixture';

export { BASE_URL };

export const SETTLE_MS = 1500;

export async function pinPortuguese(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
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
