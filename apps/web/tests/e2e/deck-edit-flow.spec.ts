/**
 * E2E — deck-edit-flow (U16)
 *
 * Flow: open fixture deck → toggle Edit → verify Edit canvas renders →
 * Cancel → view mode restored. Also tests: legality badge renders, tag
 * filter chip on /home, and Save (no-change) exits Edit without errors.
 *
 * PREREQUISITES:
 *   1. Dev server running: pnpm dev (api on :3000, web on :5173)
 *   2. Fixture user exists. See docs/dev-fixtures.md for seed instructions.
 *   3. FIXTURE_EMAIL + FIXTURE_PASS env vars set (defaults from dev-fixtures.md apply).
 *   4. At least one Fabrary-imported deck in the fixture user's collection.
 *
 * Tests skip gracefully when dev server is not running or auth fails.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const FIXTURE_EMAIL = process.env.FIXTURE_EMAIL ?? 'fixture@test.local';
const FIXTURE_PASS = process.env.FIXTURE_PASS ?? 'test-password-1234';

/** ms to wait for network and animations to settle. */
const SETTLE_MS = 2000;

// ---------------------------------------------------------------------------
// Helpers
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
        localStorage.setItem('rathe-arsenal:theme', 'dark');
        return { ok: true, jwt: body.jwt };
      },
      [BASE_URL, FIXTURE_EMAIL, FIXTURE_PASS] as [string, string, string],
    );
    return result.ok ? result.jwt : null;
  } catch {
    return null;
  }
}

async function seedJwt(page: Page, jwt: string): Promise<void> {
  await page.evaluate((token: string) => {
    localStorage.setItem('rathe-arsenal:jwt', token);
    localStorage.setItem('rathe-arsenal:theme', 'dark');
  }, jwt);
}

async function resolveFirstDeckUrl(page: Page, jwt: string): Promise<string | null> {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await seedJwt(page, jwt);
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(SETTLE_MS);
  return page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>('a[href^="/decks/"]');
    return link?.getAttribute('href') ?? null;
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Deck edit flow — E2E (U16)', () => {
  let jwt: string | null = null;
  let firstDeckUrl: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    jwt = await seedAuth(page);
    if (jwt) firstDeckUrl = await resolveFirstDeckUrl(page, jwt);
    await page.close();
  });

  test('deck detail loads with Edit button in view mode', async ({ page }) => {
    if (!jwt) { test.skip(true, 'no JWT — dev server not running'); return; }
    if (!firstDeckUrl) { test.skip(true, 'no tracked deck on /home'); return; }

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await seedJwt(page, jwt);
    await page.goto(`${BASE_URL}${firstDeckUrl}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(SETTLE_MS);

    await expect(page.getByTestId('deck-detail-layout')).toBeVisible();
    await expect(page.getByTestId('deck-detail-edit-btn')).toBeVisible();
  });

  test('enter Edit mode → Edit canvas + Save/Cancel buttons render', async ({ page }) => {
    if (!jwt) { test.skip(true, 'no JWT'); return; }
    if (!firstDeckUrl) { test.skip(true, 'no tracked deck on /home'); return; }

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await seedJwt(page, jwt);
    await page.goto(`${BASE_URL}${firstDeckUrl}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(SETTLE_MS);

    await page.getByTestId('deck-detail-edit-btn').click();
    await page.waitForTimeout(SETTLE_MS);

    expect(page.url()).toContain('edit=1');
    await expect(page.getByTestId('deck-canvas-edit')).toBeVisible();
    await expect(page.getByTestId('deck-detail-cancel-btn')).toBeVisible();
    await expect(page.getByTestId('deck-detail-save-btn')).toBeVisible();
  });

  test('Cancel from Edit → returns to view mode', async ({ page }) => {
    if (!jwt) { test.skip(true, 'no JWT'); return; }
    if (!firstDeckUrl) { test.skip(true, 'no tracked deck on /home'); return; }

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await seedJwt(page, jwt);
    await page.goto(`${BASE_URL}${firstDeckUrl}?edit=1`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(SETTLE_MS);

    // Dismiss stale restore modal if present
    const discardBtn = page.getByTestId('draft-restore-discard-btn');
    if (await discardBtn.isVisible().catch(() => false)) {
      await discardBtn.click();
      await page.waitForTimeout(500);
    }

    await expect(page.getByTestId('deck-canvas-edit')).toBeVisible();
    await page.getByTestId('deck-detail-cancel-btn').click();
    await page.waitForTimeout(SETTLE_MS);

    await expect(page.getByTestId('deck-detail-edit-btn')).toBeVisible();
    expect(page.url()).not.toContain('edit=1');
  });

  test('tag filter chip on /home toggles to active state', async ({ page }) => {
    if (!jwt) { test.skip(true, 'no JWT'); return; }

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await seedJwt(page, jwt);
    await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(SETTLE_MS);

    const tagGroup = page.getByRole('group', { name: /Filter by tag/i });
    if (!(await tagGroup.isVisible().catch(() => false))) {
      // No tags on fixture decks — acceptable; home still renders
      return;
    }

    const firstChip = tagGroup.locator('button[aria-pressed]').first();
    await firstChip.click();
    await page.waitForTimeout(500);
    await expect(firstChip).toHaveAttribute('aria-pressed', 'true');
  });

  test('legality badge renders in sidebar with valid data-legality attribute', async ({ page }) => {
    if (!jwt) { test.skip(true, 'no JWT'); return; }
    if (!firstDeckUrl) { test.skip(true, 'no tracked deck on /home'); return; }

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await seedJwt(page, jwt);
    await page.goto(`${BASE_URL}${firstDeckUrl}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(SETTLE_MS);

    await expect(page.getByTestId('sidebar-legality-slot')).toBeVisible();
    const badge = page.getByTestId('legality-badge');
    await expect(badge).toBeVisible();
    const legalityValue = await badge.getAttribute('data-legality');
    expect(['legal', 'incomplete', 'illegal']).toContain(legalityValue);
  });

  test('Save (no changes) → no inline save-error, cascade confirm absent', async ({ page }) => {
    if (!jwt) { test.skip(true, 'no JWT'); return; }
    if (!firstDeckUrl) { test.skip(true, 'no tracked deck on /home'); return; }

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await seedJwt(page, jwt);
    await page.goto(`${BASE_URL}${firstDeckUrl}?edit=1`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(SETTLE_MS);

    // Dismiss stale restore modal if present
    const discardBtn = page.getByTestId('draft-restore-discard-btn');
    if (await discardBtn.isVisible().catch(() => false)) {
      await discardBtn.click();
      await page.waitForTimeout(500);
    }

    await page.getByTestId('deck-detail-save-btn').click();
    await page.waitForTimeout(SETTLE_MS * 2);

    expect(
      await page.getByTestId('deck-detail-save-error').isVisible().catch(() => false),
    ).toBe(false);
    expect(
      await page.getByTestId('cascade-confirm-save-btn').isVisible().catch(() => false),
    ).toBe(false);
  });
});
