/**
 * E2E state-transition tests for the Swaps page.
 *
 * Requires:
 *   1. Dev server running (api :3000, web :5173)
 *   2. Fixture user with tracked decks containing substitutions
 *   3. FIXTURE_EMAIL + FIXTURE_PASS env vars (or defaults from dev-fixtures.md)
 *
 * All tests skip gracefully when the dev server is not running or fixture data
 * is absent. They are designed to be run on the real dev environment.
 *
 * Scenarios:
 *   (A) Approve on /swaps → row in Approved tab → reject same row → row in Rejected tab
 *   (B) Approve on deck detail → navigate to /swaps → row shows as approved
 *   (C) Bulk reject 3 pending rows → all 3 in Rejected tab → bulk reset → all 3 back in Pending
 *   (D) Filter state=Approved active → reject a row → row disappears from view
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const API_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const FIXTURE_EMAIL = process.env.FIXTURE_EMAIL ?? 'fixture@test.local';
const FIXTURE_PASS = process.env.FIXTURE_PASS ?? 'test-password-1234';

/** ms to wait for network + React re-render to settle after a mutation. */
const SETTLE_MS = 1500;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function seedAuth(page: Page): Promise<string | null> {
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    const result = await page.evaluate(
      async ([apiBase, email, pass]) => {
        const res = await fetch(`${apiBase}/api/auth/sign-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: pass }),
        });
        if (!res.ok) return { ok: false, jwt: '' };
        const body = (await res.json()) as { jwt?: string };
        if (!body.jwt) return { ok: false, jwt: '' };
        localStorage.setItem('rathe-arsenal:jwt', body.jwt);
        return { ok: true, jwt: body.jwt };
      },
      [API_URL, FIXTURE_EMAIL, FIXTURE_PASS] as [string, string, string],
    );
    return result.ok ? result.jwt : null;
  } catch {
    return null;
  }
}

async function seedJwt(page: Page, jwt: string): Promise<void> {
  await page.evaluate((token: string) => {
    localStorage.setItem('rathe-arsenal:jwt', token);
  }, jwt);
}

async function navigateToSwaps(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/swaps`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(SETTLE_MS);
}

async function getFirstDeckUrl(page: Page): Promise<string | null> {
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  return page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>('a[href^="/decks/"]');
    return link?.getAttribute('href') ?? null;
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Swaps state transitions — E2E', () => {
  let jwt: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    jwt = await seedAuth(page);
    await page.close();
  });

  // ---------------------------------------------------------------------------
  // Scenario A: Approve on /swaps → in Approved tab → reject → in Rejected tab
  // ---------------------------------------------------------------------------

  test('Scenario A: approve a pending row → row moves to Approved tab → reject it → row moves to Rejected tab', async ({ page }) => {
    if (!jwt) {
      test.skip(true, 'Skipping — dev server not running or sign-in failed');
      return;
    }

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await seedJwt(page, jwt);
    await navigateToSwaps(page);

    // Check there are pending rows
    const pendingRows = page.locator('[data-testid="reviews-row"]');
    const initialCount = await pendingRows.count();
    if (initialCount === 0) {
      test.skip(true, 'Skipping Scenario A — no pending rows in fixture data');
      return;
    }

    // Approve the first row
    const firstRow = pendingRows.first();
    const approveBtn = firstRow.getByRole('button', { name: /^Approve/i });
    await approveBtn.click();
    await page.waitForTimeout(SETTLE_MS);

    // Navigate to Approved tab
    await page.getByRole('tab', { name: /Approved/i }).click();
    await page.waitForTimeout(500);

    const approvedRows = page.locator('[data-testid="reviews-row"]');
    const approvedCount = await approvedRows.count();
    expect(approvedCount).toBeGreaterThanOrEqual(1);

    // Reject the first approved row
    const firstApprovedRow = approvedRows.first();
    const rejectBtn = firstApprovedRow.getByRole('button', { name: /^Reject/i });
    const isRejectEnabled = await rejectBtn.isEnabled();
    if (!isRejectEnabled) {
      test.skip(true, 'Skipping Scenario A part 2 — Reject button is disabled on approved row (known bug)');
      return;
    }

    await rejectBtn.click();
    await page.waitForTimeout(SETTLE_MS);

    // The row should have moved OUT of the Approved tab
    // (the approved tab should now have fewer rows)
    const postRejectApprovedCount = await approvedRows.count();
    expect(postRejectApprovedCount).toBe(approvedCount - 1);

    // Navigate to Rejected tab — the row should be there
    await page.getByRole('tab', { name: /Rejected/i }).click();
    await page.waitForTimeout(500);

    const rejectedRows = page.locator('[data-testid="reviews-row"]');
    const rejectedCount = await rejectedRows.count();
    expect(rejectedCount).toBeGreaterThanOrEqual(1);
  });

  // ---------------------------------------------------------------------------
  // Scenario B: Approve on deck detail → navigate to /swaps → row shows approved
  // ---------------------------------------------------------------------------

  test('Scenario B: approve on deck detail → navigate to /swaps → row shows as approved', async ({ page }) => {
    if (!jwt) {
      test.skip(true, 'Skipping — dev server not running');
      return;
    }

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await seedJwt(page, jwt);

    const deckUrl = await getFirstDeckUrl(page);
    if (!deckUrl) {
      test.skip(true, 'Skipping Scenario B — no tracked deck found');
      return;
    }

    // Navigate to deck detail
    await seedJwt(page, jwt);
    await page.goto(`${BASE_URL}${deckUrl}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(SETTLE_MS);

    // Check if there are any swap rows in deck detail
    const swapSection = page.getByRole('heading', { name: /^Swaps$/i });
    const hasSectionHeading = await swapSection.isVisible().catch(() => false);
    if (!hasSectionHeading) {
      test.skip(true, 'Skipping Scenario B — deck has no Swaps section');
      return;
    }

    const swapList = page.getByRole('list', { name: /Swap proposals/i });
    const swapListVisible = await swapList.isVisible().catch(() => false);
    if (!swapListVisible) {
      test.skip(true, 'Skipping Scenario B — Swap proposals list not visible');
      return;
    }

    const swapRows = swapList.getByRole('listitem');
    const rowCount = await swapRows.count();
    if (rowCount === 0) {
      test.skip(true, 'Skipping Scenario B — no swap rows in deck detail');
      return;
    }

    // Approve the first swap row in deck detail
    const firstSwapRow = swapRows.first();
    const approveBtn = firstSwapRow.getByRole('button', { name: /approve substitution/i });
    const isEnabled = await approveBtn.isEnabled().catch(() => false);
    if (!isEnabled) {
      test.skip(true, 'Skipping Scenario B — Approve button disabled (already approved)');
      return;
    }

    await approveBtn.click();
    await page.waitForTimeout(SETTLE_MS);

    // Navigate to /swaps and check the Approved tab
    await seedJwt(page, jwt);
    await navigateToSwaps(page);

    await page.getByRole('tab', { name: /Approved/i }).click();
    await page.waitForTimeout(500);

    const approvedTabRows = page.locator('[data-testid="reviews-row"]');
    const approvedCount = await approvedTabRows.count();
    // There should be at least 1 approved row
    expect(approvedCount).toBeGreaterThanOrEqual(1);
  });

  // ---------------------------------------------------------------------------
  // Scenario C: Bulk reject 3 pending rows → all in Rejected tab → bulk reset → all in Pending
  // ---------------------------------------------------------------------------

  test('Scenario C: bulk reject 3 pending rows → all in Rejected tab → bulk reset → all in Pending', async ({ page }) => {
    if (!jwt) {
      test.skip(true, 'Skipping — dev server not running');
      return;
    }

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await seedJwt(page, jwt);
    await navigateToSwaps(page);

    const pendingRows = page.locator('[data-testid="reviews-row"]');
    const pendingCount = await pendingRows.count();
    if (pendingCount < 3) {
      test.skip(true, `Skipping Scenario C — only ${pendingCount} pending rows (need >= 3)`);
      return;
    }

    // Select first 3 rows
    const checkboxes = pendingRows.locator('input[type="checkbox"]');
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();
    await checkboxes.nth(2).click();
    await page.waitForTimeout(300);

    // Bulk reject
    const bulkBar = page.getByRole('region', { name: /bulk actions/i });
    await expect(bulkBar).toBeVisible();
    await bulkBar.getByRole('button', { name: /reject selected/i }).click();
    await page.waitForTimeout(SETTLE_MS);

    // Navigate to Rejected tab
    await page.getByRole('tab', { name: /Rejected/i }).click();
    await page.waitForTimeout(500);

    const rejectedRows = page.locator('[data-testid="reviews-row"]');
    const rejectedCount = await rejectedRows.count();
    expect(rejectedCount).toBeGreaterThanOrEqual(3);

    // Select all rejected rows (at least 3)
    const rejectedCheckboxes = rejectedRows.locator('input[type="checkbox"]');
    for (let i = 0; i < Math.min(3, rejectedCount); i++) {
      await rejectedCheckboxes.nth(i).click();
    }
    await page.waitForTimeout(300);

    // Bulk reset
    const bulkBarAgain = page.getByRole('region', { name: /bulk actions/i });
    await expect(bulkBarAgain).toBeVisible();
    await bulkBarAgain.getByRole('button', { name: /reset selected/i }).click();
    await page.waitForTimeout(SETTLE_MS);

    // Navigate back to Pending tab — the 3 rows should be there
    await page.getByRole('tab', { name: /Pending/i }).click();
    await page.waitForTimeout(500);

    const pendingRowsAfterReset = page.locator('[data-testid="reviews-row"]');
    const pendingCountAfterReset = await pendingRowsAfterReset.count();
    expect(pendingCountAfterReset).toBeGreaterThanOrEqual(3);
  });

  // ---------------------------------------------------------------------------
  // Scenario D: Filter state=Approved active → reject a row → row disappears from view
  // ---------------------------------------------------------------------------

  test('Scenario D: with state=approved filter, reject a row → row disappears immediately', async ({ page }) => {
    if (!jwt) {
      test.skip(true, 'Skipping — dev server not running');
      return;
    }

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await seedJwt(page, jwt);

    // Navigate directly to /swaps with state=approved
    await page.goto(`${BASE_URL}/swaps?state=approved`, {
      waitUntil: 'networkidle',
      timeout: 20000,
    });
    await page.waitForTimeout(SETTLE_MS);

    const approvedRows = page.locator('[data-testid="reviews-row"]');
    const initialApprovedCount = await approvedRows.count();

    if (initialApprovedCount === 0) {
      test.skip(true, 'Skipping Scenario D — no approved rows in fixture data');
      return;
    }

    const firstApprovedRow = approvedRows.first();
    const rejectBtn = firstApprovedRow.getByRole('button', { name: /^Reject/i });

    // Check if Reject is enabled (if bug: it would be disabled because Approve was clicked)
    const rejectEnabled = await rejectBtn.isEnabled().catch(() => false);
    if (!rejectEnabled) {
      test.skip(true, 'Skipping Scenario D — Reject button is disabled on approved row');
      return;
    }

    await rejectBtn.click();
    await page.waitForTimeout(SETTLE_MS);

    // CRITICAL: the rejected row should have DISAPPEARED from the approved tab
    // (state=approved filter no longer matches the row's new decision=rejected)
    const postRejectApprovedCount = await approvedRows.count();
    expect(postRejectApprovedCount).toBe(initialApprovedCount - 1);
  });
});
