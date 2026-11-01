/**
 * Forms and steps on a computer (type 1A of the desktop patterns): a rail at the left, the content in the
 * remaining width, both inside the same container as the top bar and the footer.
 */
import { test, expect, type Page } from '@playwright/test';
import { pinPortuguese } from './helpers';
import { loadFixture } from '../support/fixture';

async function containerLeft(page: Page): Promise<number> {
  const footer = page.locator('footer').first();
  return (await footer.locator('p').first().boundingBox())!.x;
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
}

const RAIL_PAGES: ReadonlyArray<readonly [string, () => string]> = [
  ['the spreadsheet page', () => '/add-cards/sheet'],
  ['the pasted list page', () => '/add-cards/list'],
  ['the ready-made deck search', () => '/add-cards/product'],
  ['settings', () => '/settings'],
  ['the deck editor', () => `/decks/${loadFixture().readyDeckId}/edit`],
];

test.beforeEach(async ({ page }) => {
  await pinPortuguese(page);
});

for (const [name, path] of RAIL_PAGES) {
  test(`${name} has a rail at the left at 1440 px, aligned with the footer`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path(), { waitUntil: 'networkidle' });

    const rail = page.getByTestId('rail');
    await expect(rail).toBeVisible();
    const railBox = (await rail.boundingBox())!;
    const content = (await page.locator('main h1').first().boundingBox())!;
    expect(Math.abs(railBox.x - (await containerLeft(page))), 'the rail starts at the container edge').toBeLessThanOrEqual(2);
    expect(Math.abs(content.x - railBox.x), 'the title starts at the container edge too').toBeLessThanOrEqual(2);
    expect(railBox.width, 'the rail is a column, not the whole page').toBeLessThan(400);
    await noSidewaysScroll(page);
  });
}

test('the spreadsheet rail marks the step the player is on', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/add-cards/sheet', { waitUntil: 'networkidle' });

  const rail = page.getByTestId('rail');
  await expect(rail).toContainText('Escolher o arquivo');
  await expect(rail).toContainText('Ver o que foi lido');
  await expect(rail).toContainText('Adicionar as prontas');
  await expect(rail.locator('[aria-current="step"]')).toHaveText(/Escolher o arquivo/);
});

test('the ways to add cards sit at the left of the paste box at 1440 px and below it on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/add-cards', { waitUntil: 'networkidle' });
  let rows = (await page.getByRole('link', { name: /Comprei um deck pronto/ }).boundingBox())!;
  let paste = (await page.getByRole('textbox').boundingBox())!;
  expect(rows.x + rows.width, 'the ways in end before the paste box').toBeLessThanOrEqual(paste.x);
  expect(rows.width, 'the rows stop stretching across the container').toBeLessThan(400);
  await noSidewaysScroll(page);

  await page.setViewportSize({ width: 390, height: 844 });
  rows = (await page.getByRole('link', { name: /Comprei um deck pronto/ }).boundingBox())!;
  paste = (await page.getByRole('textbox').boundingBox())!;
  expect(rows.y, 'on a phone the ways in come after the paste box').toBeGreaterThan(paste.y + paste.height);
  await noSidewaysScroll(page);
});

test('the rail is hidden on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [, path] of RAIL_PAGES) {
    await page.goto(path(), { waitUntil: 'networkidle' });
    await expect(page.getByTestId('rail')).toBeHidden();
    await noSidewaysScroll(page);
  }
});

test('"Novo deck" puts its ways to start in a column at the left at 1440 px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/decks/new', { waitUntil: 'networkidle' });
  const option = (await page.getByRole('link', { name: /Comprei um deck pronto/ }).boundingBox())!;
  expect(option.width, 'the option stops stretching across the container').toBeLessThan(400);
  expect(Math.abs(option.x - (await containerLeft(page)))).toBeLessThanOrEqual(2);
  await page.getByRole('button', { name: /link do Fabrary/ }).click();
  const panel = (await page.locator('main input').first().boundingBox())!;
  expect(panel.x, 'the open way fills the column at the right').toBeGreaterThan(option.x + option.width);
  await noSidewaysScroll(page);
});
