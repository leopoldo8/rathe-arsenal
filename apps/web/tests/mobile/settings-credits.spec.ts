/**
 * The credits bar of Settings for an admin (`r5-credits-b-phone`). The admin session and the three admin answers
 * are served from stubs, so the screen depends on neither the fixture user's role nor the Firecrawl budget.
 */
import { test, expect, type Page } from '@playwright/test';
import { pinPortuguese } from '../e2e/helpers';
import { stubSignedIn } from '../support/sharing-stubs';

const IDLE_SYNC = { state: 'idle', lastUrlSyncAt: '2026-10-22T03:10:00Z', lastProductCount: 412, lastError: null };

async function openSettings(page: Page, credits: { creditsUsed: number; budget: number; lookupsStopped: boolean }): Promise<void> {
  await pinPortuguese(page);
  await stubSignedIn(page, { role: 'admin' });
  await page.route('**/api/admin/stores/*/url-sync-status', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(IDLE_SYNC) }),
  );
  await page.route('**/api/admin/stores/*/credits', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(credits) }),
  );
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('store-credits')).toBeVisible();
}

async function colorOf(page: Page, token: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${value})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

test('the credits bar follows r5-credits-b-phone while lookups run', async ({ page }) => {
  await openSettings(page, { creditsUsed: 120, budget: 1000, lookupsStopped: false });
  const credits = page.getByTestId('store-credits');
  const label = credits.getByText('Créditos do Firecrawl este mês');
  const numbers = credits.getByText('120 de 1000');
  const meter = credits.getByRole('img', { name: '120 de 1000 créditos usados' });

  // Under the sync line, a divider, the label on the left and the numbers on the right, then the bar.
  const [syncBox, creditsBox, labelBox, numbersBox, meterBox] = await Promise.all([
    page.getByTestId('store-sync-status').boundingBox(),
    credits.boundingBox(),
    label.boundingBox(),
    numbers.boundingBox(),
    meter.boundingBox(),
  ]);
  expect(creditsBox!.y, 'the block is under the sync line').toBeGreaterThanOrEqual(syncBox!.y + syncBox!.height - 1);
  expect(Math.abs(labelBox!.y - numbersBox!.y), 'the label and the numbers share a row').toBeLessThan(6);
  expect(labelBox!.x, 'the label is on the left').toBeLessThan(numbersBox!.x);
  const rightEdge = creditsBox!.x + creditsBox!.width;
  expect(rightEdge - (numbersBox!.x + numbersBox!.width), 'the numbers end at the right edge').toBeLessThan(2);
  expect(numbersBox!.y + numbersBox!.height, 'the bar is under the numbers').toBeLessThanOrEqual(meterBox!.y + 1);

  const divider = await credits.evaluate((node) => {
    const style = getComputedStyle(node);
    return { style: style.borderTopStyle, width: style.borderTopWidth };
  });
  expect(divider, 'a divider above the label').toEqual({ style: 'solid', width: '1px' });

  const shape = await meter.evaluate((node) => {
    const style = getComputedStyle(node);
    return { height: style.height, radius: style.borderTopLeftRadius, role: node.getAttribute('role') };
  });
  expect(shape, 'a bar 8 px high with 4 px ends').toEqual({ height: '8px', radius: '4px', role: 'img' });

  const fill = meter.locator('rect');
  expect(await fill.evaluate((node) => getComputedStyle(node).fill), 'the fill is the accent color').toBe(await colorOf(page, '--ra-accent'));
  const fillWidth = (await fill.boundingBox())!.width;
  expect(fillWidth / meterBox!.width, 'the fill is 12% of the bar').toBeCloseTo(0.12, 2);
  await expect(page.getByText('As consultas automáticas de preço pararam.')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
});

test('the credits bar turns amber when lookups stop', async ({ page }) => {
  await openSettings(page, { creditsUsed: 880, budget: 1000, lookupsStopped: true });
  const credits = page.getByTestId('store-credits');
  const meter = credits.getByRole('img', { name: '880 de 1000 créditos usados' });
  const fill = meter.locator('rect');

  // --warn of the picture is #c8843c and its ink #d6954c.
  expect(await fill.evaluate((node) => getComputedStyle(node).fill), 'the fill is the amber').toBe('rgb(200, 132, 60)');
  const meterBox = (await meter.boundingBox())!;
  expect((await fill.boundingBox())!.width / meterBox.width, 'the fill is 88% of the bar').toBeCloseTo(0.88, 2);

  const lines = credits.getByTestId('store-credits-stopped');
  await expect(lines).toContainText('As consultas automáticas de preço pararam.');
  await expect(lines).toContainText('A sincronização manual continua funcionando.');
  expect(await lines.evaluate((node) => getComputedStyle(node).color), 'the first line is in the amber ink').toBe('rgb(214, 149, 76)');
  const note = lines.getByText('A sincronização manual continua funcionando.');
  expect(meterBox.y + meterBox.height, 'the lines are under the bar').toBeLessThanOrEqual((await lines.boundingBox())!.y + 1);
  expect(await note.evaluate((node) => getComputedStyle(node).color), 'the second line is muted').not.toBe('');
});
