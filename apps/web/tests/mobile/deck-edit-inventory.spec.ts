import { test, expect } from '@playwright/test';
import { loadFixture, resetFixture } from '../support/fixture';
import { openCompositionEditor } from '../support/pages';

// The proof of C57 is named under tests/e2e/deck-edit-flow.spec.ts, but the mobile-390 project only
// runs files under tests/mobile, where the other phone proofs of the editor live.
test.describe('the inventory in the deck editor on a phone', () => {
  test.beforeAll(async () => {
    await resetFixture();
  });

  test('the inventory steppers stack on the phone', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
    await openCompositionEditor(page, loadFixture().readyDeckId);
    const row = page.locator('[data-testid^="editable-card-row-"]').first();
    await row.scrollIntoViewIfNeeded();

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
