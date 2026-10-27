/** Desktop missing list (`r3-list-desktop`), served from a stub so it never depends on the store's stock today. */
import { test, expect } from '@playwright/test';
import { pinPortuguese } from './helpers';
import { loadFixture } from '../support/fixture';
import { stubMissingList } from '../support/missing-list-stubs';

test.describe('Missing list — E2E', () => {
  test('the desktop list follows r3-list-desktop', async ({ page }) => {
    await pinPortuguese(page);
    await stubMissingList(page);
    await page.goto(`/decks/${loadFixture().readyDeckId}/missing`, { waitUntil: 'networkidle' });
    const list = page.getByTestId('missing-list-page');
    await expect(list).toBeVisible();

    const summary = list.locator('header').first();
    await expect(summary).toContainText('Falta comprar: 43 cópias · R$ 452,28 na Cúpula DT');
    await expect(summary).toContainText('Já descontei 5 cópias que você tem e 2 que você troca por cartas suas.');
    await expect(summary.getByRole('button', { name: 'Copiar lista de compras' })).toBeVisible();
    await expect(summary.getByRole('button', { name: 'Compartilhar a lista' })).toBeVisible();

    const chips = page.getByTestId('missing-chips');
    await expect(chips.getByRole('button')).toHaveText([
      /Comprar na loja\s*43/,
      /A loja não tem\s*14/,
      /Fora do site\s*2/,
      /Já tenho\s*5/,
      /No lugar\s*2/,
    ]);

    const table = page.getByRole('table', { name: 'Cartas que faltam' });
    await expect(table.getByRole('columnheader')).toHaveText(['Carta', 'Faltam', 'Já tenho', 'No lugar', 'Preço cada', 'Total', 'Link']);
    const alpha = table.getByTestId('missing-row').filter({ hasText: 'Alpha Rampage' });
    // The four of the stepper and the stand-in, and the "Alternativas" entry the owner's round 6 pick gave every row.
    await expect(alpha.getByRole('button')).toHaveCount(5);
    await expect(alpha.getByRole('button', { name: 'Ver alternativas para Alpha Rampage (Vermelho)' })).toHaveText('Alternativas');
    await expect(alpha.getByRole('link', { name: /^Comprar/ })).toBeVisible();
    await expect(page.getByTestId('missing-footer')).toHaveText('19 cartas na loja · 43 cópias a comprar · R$ 452,28');

    await expect(page.getByRole('heading', { name: 'A loja não tem agora · 14 cópias' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fora do site · 2 cópias' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
  });
});
