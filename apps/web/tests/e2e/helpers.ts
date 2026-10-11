import type { Page } from '@playwright/test';

import { BASE_URL } from '../support/fixture';

export { BASE_URL };

export async function pinPortuguese(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
}
