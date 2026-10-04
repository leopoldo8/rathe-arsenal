/**
 * E2E for swap state transitions through the single-swap endpoints (SWAP-04..08, SWAP-14).
 *
 * PREREQUISITES: dev server up and the fixture user with at least three
 * pending swaps (docs/dev-fixtures.md). No conditional skips: a missing
 * fixture fails the test.
 */
import { test, expect } from '@playwright/test';
import { BASE_URL, openSwaps, pinPortuguese, swapRows, tab, tabCount } from './swaps-helpers';
import { arrangeApprovedSwaps, resetFixture } from '../support/fixture';

test.describe('Swaps state transitions — E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetFixture();
    await pinPortuguese(page);
  });

  test.afterAll(async () => {
    await resetFixture();
  });

  test('approve, revert, reject, restore walks the whole lifecycle on one swap', async ({ page }) => {
    await openSwaps(page);
    const row = swapRows(page).first();
    const rowId = await row.getAttribute('data-row-id');
    const same = page.locator(`[data-testid="swap-row"][data-row-id="${rowId}"]`);

    await row.getByRole('button', { name: /^Aprovar/ }).click();
    await expect(row.getByRole('status')).toHaveText('Aprovada: já vale no deck');
    await tab(page, 'Aplicadas').click();
    await same.getByRole('button', { name: /^Reverter/ }).click();
    await expect(same).toHaveCount(0);

    await tab(page, 'Pendentes').click();
    await same.getByRole('button', { name: /^Recusar/ }).click();
    await page.getByRole('button', { name: 'Recusar troca' }).click();
    await expect(same.getByRole('status')).toBeVisible();
    await tab(page, 'Recusadas').click();
    await same.getByRole('button', { name: /^Restaurar/ }).click();
    await expect(same).toHaveCount(0);

    await tab(page, 'Pendentes').click();
    await expect(same).toBeVisible();
  });

  test('Desfazer takes an approval back without leaving the page', async ({ page }) => {
    await openSwaps(page);
    const pendingBefore = await tabCount(page, 'Pendentes');
    const row = swapRows(page).first();

    await row.getByRole('button', { name: /^Aprovar/ }).click();
    await row.getByRole('button', { name: /^Desfazer/ }).click();

    await expect(row.getByRole('button', { name: /^Aprovar/ })).toBeVisible();
    expect(await tabCount(page, 'Pendentes')).toBe(pendingBefore);
  });

  test('bulk approve calls one endpoint per row and moves them to Aplicadas', async ({ page }) => {
    await openSwaps(page);
    const pendingBefore = await tabCount(page, 'Pendentes');
    const appliedBefore = await tabCount(page, 'Aplicadas');
    const approvals: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && /\/api\/swaps\/[^/]+\/approve$/.test(request.url())) {
        approvals.push(request.url());
      }
    });

    const checkboxes = swapRows(page).getByRole('checkbox');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await page.getByRole('region', { name: 'Ações em lote' }).getByRole('button', { name: 'Aprovar selecionadas' }).click();

    await expect.poll(() => tabCount(page, 'Aplicadas')).toBe(appliedBefore + 2);
    expect(await tabCount(page, 'Pendentes')).toBe(pendingBefore - 2);
    expect(approvals).toHaveLength(2);
  });

  test('bulk "Voltar a pendentes" reverts the applied rows it selected', async ({ page }) => {
    await arrangeApprovedSwaps(2);
    await openSwaps(page, 'approved');
    const pendingBefore = await tabCount(page, 'Pendentes');

    await swapRows(page).getByRole('checkbox').first().check();
    await page.getByRole('region', { name: 'Ações em lote' }).getByRole('button', { name: 'Voltar a pendentes' }).click();

    await expect.poll(() => tabCount(page, 'Pendentes')).toBe(pendingBefore + 1);
  });
});
