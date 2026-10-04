/**
 * E2E for the redesigned Swaps screen (SWAP-04..12, SWAP-14).
 *
 * PREREQUISITES: dev server up (api :3000, web :5173) and the fixture user
 * from docs/dev-fixtures.md with at least two pending swaps. Run by the
 * orchestrator; no test skips when data is missing, a missing fixture fails.
 */
import { test, expect } from '@playwright/test';
import { BASE_URL, openSwaps, pinPortuguese, swapRows, tab, tabCount, SETTLE_MS } from './swaps-helpers';
import { arrangeApprovedSwaps, resetFixture } from '../support/fixture';

test.describe('Swaps screen — E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetFixture();
    await pinPortuguese(page);
  });

  test.afterAll(async () => {
    await resetFixture();
  });

  test('renders the heading, the three tabs plus the all pill, with counts from the rows', async ({ page }) => {
    await openSwaps(page);

    await expect(page.getByRole('tab')).toHaveCount(4);
    const pending = await tabCount(page, 'Pendentes');
    expect(pending).toBeGreaterThanOrEqual(1);
    await expect(swapRows(page)).toHaveCount(pending);
  });

  test('approving a row keeps it in place with the confirmation, then migrates on a tab switch', async ({ page }) => {
    await openSwaps(page);
    const pendingBefore = await tabCount(page, 'Pendentes');
    const appliedBefore = await tabCount(page, 'Aplicadas');
    const firstRow = swapRows(page).first();
    const rowId = await firstRow.getAttribute('data-row-id');

    await firstRow.getByRole('button', { name: /^Aprovar/ }).click();

    await expect(firstRow.getByRole('status')).toHaveText('Aprovada: já vale no deck');
    await expect(firstRow.getByRole('button', { name: /^Desfazer/ })).toBeVisible();
    await expect(swapRows(page)).toHaveCount(pendingBefore);
    expect(await tabCount(page, 'Pendentes')).toBe(pendingBefore - 1);
    expect(await tabCount(page, 'Aplicadas')).toBe(appliedBefore + 1);

    await tab(page, 'Aplicadas').click();
    await expect(page.locator(`[data-testid="swap-row"][data-row-id="${rowId}"]`)).toBeVisible();
    await tab(page, 'Pendentes').click();
    await expect(page.locator(`[data-testid="swap-row"][data-row-id="${rowId}"]`)).toHaveCount(0);
  });

  test('Reverter sends an applied swap back to Pendentes', async ({ page }) => {
    await arrangeApprovedSwaps(1);
    await openSwaps(page, 'approved');
    const pendingBefore = await tabCount(page, 'Pendentes');
    const row = swapRows(page).first();

    await row.getByRole('button', { name: /^Reverter/ }).click();

    await expect.poll(() => tabCount(page, 'Pendentes')).toBe(pendingBefore + 1);
  });

  test('rejecting with a reason shows the quoted reason in Recusadas, and Restaurar brings it back', async ({ page }) => {
    await openSwaps(page);
    const row = swapRows(page).first();
    const rowId = await row.getAttribute('data-row-id');

    await row.getByRole('button', { name: /^Recusar/ }).click();
    await page.getByRole('button', { name: 'Prefiro comprar a original' }).click();
    await page.getByRole('button', { name: 'Recusar troca' }).click();
    await expect(row.getByRole('status')).toHaveText('Recusada: não volta a ser sugerida');

    await tab(page, 'Recusadas').click();
    const rejected = page.locator(`[data-testid="swap-row"][data-row-id="${rowId}"]`);
    await expect(rejected).toContainText('“Prefiro comprar a original”');

    await rejected.getByRole('button', { name: /^Restaurar/ }).click();
    await expect(rejected).toHaveCount(0);
  });

  test('records the post-play outcome on an applied swap', async ({ page }) => {
    await arrangeApprovedSwaps(1);
    await openSwaps(page, 'approved');
    const row = swapRows(page).first();

    await row.getByRole('button', { name: 'Funcionou' }).click();

    await expect(row.getByRole('button', { name: 'Funcionou' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('hides the filter rail behind one Filtros trigger and opens it', async ({ page }) => {
    await openSwaps(page);

    await expect(page.getByRole('button', { name: /^Nível/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Filtros' }).click();
    await expect(page.getByRole('button', { name: /^Nível/ })).toBeVisible();
  });

  test('an approval shows up on the deck detail page', async ({ page }) => {
    await openSwaps(page);
    const row = swapRows(page).first();
    const deckHref = await row.getByRole('link').first().getAttribute('href');
    await row.getByRole('button', { name: /^Aprovar/ }).click();
    await expect(row.getByRole('status')).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);

    await page.goto(`${BASE_URL}${deckHref}`, { waitUntil: 'networkidle' });

    await expect(page.getByTestId('deck-detail-view')).toBeVisible();
  });

  test('/reviews redirects to /swaps', async ({ page }) => {
    await page.goto(`${BASE_URL}/reviews`, { waitUntil: 'networkidle' });

    expect(page.url()).toContain('/swaps');
  });

  test('highlights Trocas in the navigation', async ({ page }) => {
    await openSwaps(page);

    await expect(page.getByRole('navigation', { name: 'Principal' }).getByText('Trocas')).toHaveAttribute(
      'data-active',
      'true',
    );
  });
});
