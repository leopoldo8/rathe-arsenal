import { test, expect, type Page } from '@playwright/test';
import { loadFixture } from '../support/fixture';
import { openCompositionEditor } from '../support/pages';

const heroBlock = (page: Page) => page.getByTestId('sidebar-edit-hero-block');

async function pickHero(page: Page, cardIdentifier: string): Promise<void> {
  await heroBlock(page).getByTestId('hero-dropdown-selected').click();
  await heroBlock(page).getByTestId('hero-dropdown-input').fill(cardIdentifier.split('-')[0]);
  await page.getByTestId(`hero-option-${cardIdentifier}`).click();
}

test.describe('Hero cascade flow', () => {
  const { readyDeckId } = loadFixture();

  test('the hero dropdown is visible in the sidebar while editing', async ({ page }) => {
    await openCompositionEditor(page, readyDeckId);

    await expect(page.getByTestId('sidebar-edit-hero-block')).toBeVisible();
    await expect(heroBlock(page).getByTestId('hero-dropdown')).toBeVisible();
  });

  test('changing the hero to one that cannot play the deck shows the cascade warning', async ({ page }) => {
    await openCompositionEditor(page, readyDeckId);

    await pickHero(page, 'dorinthea-ironsong');

    await expect(page.getByTestId('cascade-warning-sidebar').or(page.getByTestId('cascade-warning-banner')).first()).toBeVisible();
  });

  test('Remove illegal cards in the cascade warning clears the warning', async ({ page }) => {
    await openCompositionEditor(page, readyDeckId);

    await pickHero(page, 'dorinthea-ironsong');

    const removeButton = page.getByTestId('cascade-warning-sidebar').getByTestId('cascade-remove-illegal-btn');
    await expect(removeButton).toBeEnabled();

    await removeButton.click();

    await expect(page.getByTestId('cascade-warning-sidebar')).toHaveCount(0);
  });
});
