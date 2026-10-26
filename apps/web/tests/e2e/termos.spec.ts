import { test, expect } from '@playwright/test';
import { pinPortuguese } from './helpers';
import { ANON_STORAGE_STATE, loadFixture } from '../support/fixture';
import { GROUP_TOKEN, groupPageStub } from '../support/sharing-stubs';

test('a popover on a computer', async ({ page }) => {
  await pinPortuguese(page);
  await page.goto(`/decks/${loadFixture().readyDeckId}`, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: 'O que é Pitch?' }).click();

  const popover = page.getByRole('dialog', { name: 'Pitch' });
  await expect(popover).toBeVisible();
  await expect(popover).toHaveAttribute('data-testid', 'glossary-popover');
  await expect(popover.getByRole('heading', { name: 'Pitch' })).toBeVisible();
  await expect(popover).toContainText('O número de 1 a 3 da carta, mostrado também pela cor');
  await expect(popover.getByRole('link', { name: 'Ver todos os termos' })).toBeVisible();
  await expect(popover.getByRole('button', { name: 'Fechar' })).toBeVisible();
  const order = await Promise.all(
    [
      popover.getByRole('heading', { name: 'Pitch' }),
      popover.getByText('O número de 1 a 3 da carta', { exact: false }),
      popover.getByRole('link', { name: 'Ver todos os termos' }),
      popover.getByRole('button', { name: 'Fechar' }),
    ].map(async (part) => (await part.boundingBox())!.y),
  );
  expect([...order].sort((a, b) => a - b), 'heading, sentence, link, close').toEqual(order);
  await expect(page.getByTestId('glossary-sheet')).toHaveCount(0);
  const [box, question] = [(await popover.boundingBox())!, (await page.getByRole('button', { name: 'O que é Pitch?' }).boundingBox())!];
  expect(box.width, 'a popover, not a full-width sheet').toBeLessThan(500);
  expect(Math.abs(box.x - question.x), 'anchored to the word').toBeLessThan(400);
});

test.describe('signed out', () => {
  test.use({ storageState: ANON_STORAGE_STATE });

  test('the glossary is public', async ({ page }) => {
    await pinPortuguese(page);

    const response = await page.goto('/termos', { waitUntil: 'networkidle' });

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/termos');
    await expect(page.getByRole('heading', { level: 1, name: 'Termos do jogo' })).toBeVisible();
    await expect(page.getByTestId('glossary-entry')).toHaveCount(31);
    await expect(page.getByText(/Legend Story Studios/).first()).toBeVisible();
  });

  test('the back control returns to where the player came from: a shared list', async ({ page }) => {
    await pinPortuguese(page);
    await page.route(`**/api/shared/decks/${GROUP_TOKEN}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...groupPageStub(null), sharerName: 'Pedro' }) }),
    );
    await page.goto(`/d/${GROUP_TOKEN}`, { waitUntil: 'networkidle' });

    await page.getByRole('link', { name: 'O que querem dizer estas palavras?' }).click();

    await expect(page).toHaveURL(/\/termos$/);
    const back = page.getByRole('link', { name: 'Voltar para a lista do Pedro' });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(new RegExp(`/d/${GROUP_TOKEN}$`));
  });
});

test('the back control returns to where the player came from: the deck page', async ({ page }) => {
  await pinPortuguese(page);
  const deckPath = `/decks/${loadFixture().readyDeckId}`;
  await page.goto(deckPath, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: 'O que é Pitch?' }).click();
  await page.getByTestId('glossary-popover').getByRole('link', { name: 'Ver todos os termos' }).click();
  await expect(page).toHaveURL(/\/termos#pitch$/);

  await page.getByTestId('glossary-back').click();

  await expect(page).toHaveURL(new RegExp(`${deckPath}$`));
});

test('opened from a question mark it scrolls to the word', async ({ page }) => {
  await pinPortuguese(page);
  await page.goto(`/decks/${loadFixture().readyDeckId}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'O que é Pitch?' }).click();

  await page.getByTestId('glossary-popover').getByRole('link', { name: 'Ver todos os termos' }).click();

  await expect(page).toHaveURL(/\/termos#pitch$/);
  const entry = page.locator('#pitch');
  await expect(entry).toBeInViewport();
  await expect(entry).toContainText('Pitch');
});
