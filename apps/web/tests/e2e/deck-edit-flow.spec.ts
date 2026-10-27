import { test, expect, type Page } from '@playwright/test';
import { BASE_URL, loadFixture, resetFixture } from '../support/fixture';
import { openCompositionEditor, openDeck } from '../support/pages';

test.describe('Deck edit flow', () => {
  // A desktop flow: the phone projects run the phone proofs of the editor below.
  test.skip(({ isMobile }) => isMobile, 'a desktop flow');
  const { readyDeckId } = loadFixture();

  test('deck detail loads with the Edit button in view mode', async ({ page }) => {
    await openDeck(page, readyDeckId);

    await expect(page.getByTestId('deck-detail-view')).toBeVisible();
    await expect(page.getByTestId('deck-detail-edit-btn')).toBeVisible();
  });

  test('the header Edit button opens the Edit deck screen with the deck name', async ({ page }) => {
    await openDeck(page, readyDeckId);
    const deckName = (await page.getByTestId('deck-hero-name').textContent())?.trim() ?? '';

    await page.getByTestId('deck-detail-edit-btn').click();

    await expect(page).toHaveURL(new RegExp(`/decks/${readyDeckId}/edit$`));
    await expect(page.getByTestId('deck-edit-page')).toBeVisible();
    await expect(page.getByTestId('deck-edit-panel')).toBeVisible();
    await expect(page.getByTestId('deck-edit-name')).not.toHaveValue('');
    expect(deckName).not.toBe('');
  });

  test('Cancel on the Edit deck screen returns to the deck without saving', async ({ page }) => {
    await page.goto(`${BASE_URL}/decks/${readyDeckId}/edit`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('deck-edit-panel')).toBeVisible();

    await page.getByTestId('deck-edit-cancel').click();

    await expect(page).toHaveURL(new RegExp(`/decks/${readyDeckId}$`));
    await expect(page.getByTestId('deck-detail-view')).toBeVisible();
  });

  test('the edit-cards button opens the composition editor with Save and Cancel', async ({ page }) => {
    await openDeck(page, readyDeckId);

    await page.getByTestId('deck-list-edit-cards-btn').click();

    await expect(page).toHaveURL(/edit=(%22)?1/);
    await expect(page.getByTestId('deck-canvas-edit')).toBeVisible();
    await expect(page.getByTestId('deck-detail-cancel-btn')).toBeVisible();
    await expect(page.getByTestId('deck-detail-save-btn')).toBeVisible();
  });

  test('Cancel from the composition editor returns to view mode', async ({ page }) => {
    await openCompositionEditor(page, readyDeckId);

    await page.getByTestId('deck-detail-cancel-btn').click();

    await expect(page.getByTestId('deck-detail-edit-btn')).toBeVisible();
    expect(page.url()).not.toMatch(/edit=/);
  });

  test('a tag pill on /home activates when clicked', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
    const pill = page.getByRole('group', { name: 'Filter by tag' }).getByRole('button', { name: /^Filter by tag:/ }).first();

    await pill.click();

    await expect(pill).toHaveAttribute('aria-pressed', 'true');
  });

  test('the legality badge sits next to the format and only flags a problem', async ({ page }) => {
    await openDeck(page, readyDeckId);

    await expect(page.getByTestId('analysis-readiness')).toHaveCount(0);
    const badges = page.getByTestId('deck-hero-banner').getByTestId('legality-badge');
    const count = await badges.count();
    expect(count).toBeLessThanOrEqual(1);
    if (count === 1) {
      expect(['incomplete', 'illegal']).toContain(await badges.first().getAttribute('data-legality'));
    }
  });

  test('Save with no changes leaves the editor without a save error or cascade prompt', async ({ page }) => {
    await openCompositionEditor(page, readyDeckId);

    await page.getByTestId('deck-detail-save-btn').click();

    await expect(page.getByTestId('deck-detail-edit-btn')).toBeVisible();
    await expect(page.getByTestId('deck-detail-save-error')).toHaveCount(0);
    await expect(page.getByTestId('cascade-confirm-save-btn')).toHaveCount(0);
  });
});

// The phone proofs of the deck editor (C36, C40, C57): only the phone projects run them.

const SHEET_MIN_RATIO = 0.4;
const SHEET_MAX_RATIO = 0.5;

async function viewportHeight(page: Page): Promise<number> {
  return page.evaluate(() => window.visualViewport?.height ?? window.innerHeight);
}

test.describe('the rules bar of the deck editor', () => {
  test.skip(({ isMobile }) => !isMobile, 'a phone proof');
  test.beforeAll(async () => {
    await resetFixture();
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
    await openCompositionEditor(page, loadFixture().readyDeckId);
    await expect(page.getByTestId('rules-bar')).toBeVisible();
  });

  test('the rules bar stays visible while scrolling', async ({ page }) => {
    const bar = page.getByTestId('rules-bar');
    const height = await viewportHeight(page);
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(pageHeight, 'the editor is taller than the screen, so a bar that is not pinned would leave it').toBeGreaterThan(height * 2);

    // The bar must be on screen part-way down the list too, not only at the end: a bar that scrolls with the page
    // is on screen at the last row but far below the screen everywhere else.
    const scrollable = pageHeight - height;
    for (const [place, top] of [
      ['a quarter of the way down', Math.round(scrollable / 4)],
      ['the middle of the list', Math.round(scrollable / 2)],
      ['the last row', pageHeight],
    ] as const) {
      await page.evaluate((y) => window.scrollTo(0, y), top);
      const box = await bar.boundingBox();

      expect(box, `the bar is drawn at ${place}`).not.toBeNull();
      expect(box!.y, `the bar top is on screen at ${place}`).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height, `the bar bottom is on screen at ${place}`).toBeLessThanOrEqual(height);
      const coveredBy = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-testid="rules-bar"]') !== null,
        { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
      );
      expect(coveredBy, `nothing else is drawn over the bar at ${place}`).toBe(true);
    }
  });

  test('the checklist sheet opens at about half height and closes only by handle or Fechar', async ({ page }) => {
    await page.locator('[data-testid^="editable-card-row-"]').nth(3).scrollIntoViewIfNeeded();
    await page.getByTestId('rules-bar').click();
    const sheet = page.getByTestId('rules-checklist-sheet');
    await expect(sheet).toBeVisible();
    const height = await viewportHeight(page);

    const box = await sheet.boundingBox();
    expect(box!.height / height).toBeGreaterThanOrEqual(SHEET_MIN_RATIO);
    expect(box!.height / height).toBeLessThanOrEqual(SHEET_MAX_RATIO);
    const rowsAboveTheSheet = await page.evaluate((sheetTop) => {
      const rows = Array.from(document.querySelectorAll('[data-testid^="editable-card-row-"]'));
      return rows.filter((row) => {
        const rect = row.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= sheetTop;
      }).length;
    }, box!.y);
    expect(rowsAboveTheSheet, 'the list stays visible above the sheet').toBeGreaterThan(0);

    await page.mouse.wheel(0, 300);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeVisible();

    await page.getByTestId('rules-sheet-handle').click();
    await expect(sheet).toBeHidden();

    await page.getByTestId('rules-bar').click();
    await expect(sheet).toBeVisible();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(sheet).toBeHidden();
  });
});

test.describe('the inventory in the deck editor on a phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'a phone proof');
  test.beforeAll(async () => {
    await resetFixture();
  });

  test('the inventory steppers stack on the phone', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
    await openCompositionEditor(page, loadFixture().readyDeckId);
    const row = page.locator('[data-testid^="editable-card-row-"]').first();
    await row.scrollIntoViewIfNeeded();
    // The second stepper shows once a deck carries inventory copies: move one copy there first.
    await row.locator('[data-testid^="move-from-deck-"]').click();
    await page.getByRole('menuitem', { name: 'Mover 1 para o inventário' }).click();

    const name = await row.locator('[data-testid="row-name"]').boundingBox();
    const deck = await row.getByTestId('stepper-deck').boundingBox();
    const inventory = await row.getByTestId('stepper-inventory').boundingBox();

    expect(name).not.toBeNull();
    expect(deck).not.toBeNull();
    expect(inventory).not.toBeNull();
    expect(deck!.y, 'the deck stepper sits under the card name').toBeGreaterThanOrEqual(name!.y + name!.height - 1);
    expect(inventory!.y, 'the inventory stepper sits under the deck stepper').toBeGreaterThanOrEqual(deck!.y + deck!.height - 1);
    expect(Math.abs(inventory!.x - deck!.x), 'the two steppers share a left edge').toBeLessThanOrEqual(1);
  });
});
