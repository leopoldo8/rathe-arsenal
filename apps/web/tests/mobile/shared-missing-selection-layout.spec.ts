/**
 * Phone layout of the shared "missing" page with the selection (`t3a-s1` of the desktop patterns, phone frame):
 * a checkbox per card, a stepper under the ticked ones, and a bar with the summary, the full-width WhatsApp button and "Limpar".
 * The answer is served from a stub, so nothing depends on the fixture user or on the store.
 */
import { test, expect } from '@playwright/test';
import { pinPortuguese } from '../e2e/helpers';
import { ANON_STORAGE_STATE } from '../support/fixture';
import { GROUP_TOKEN, groupPageStub } from '../support/sharing-stubs';

test.use({ storageState: ANON_STORAGE_STATE });

test('the selection fits the phone: no overlap, no sideways scroll, a full-width button and 44 px targets', async ({ page }) => {
  await pinPortuguese(page);
  await page.route(`**/api/shared/decks/${GROUP_TOKEN}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(groupPageStub(null)) }),
  );
  await page.goto(`/d/${GROUP_TOKEN}`, { waitUntil: 'networkidle' });
  const viewport = page.viewportSize()!;

  await page.getByRole('checkbox', { name: 'Marcar Reckless Swing (Azul)' }).check();
  await page.getByRole('checkbox', { name: 'Marcar Nullrune Hood' }).check();
  await page.getByRole('checkbox', { name: 'Marcar Primeval Bellow (Vermelho)' }).check();
  const bar = page.getByTestId('offer-bar');
  await expect(bar).toContainText('3 cartas selecionadas · 6 cópias');
  await expect(page.getByTestId('offer-stepper')).toHaveCount(3);

  // At the end of the page the sticky bar sits in the flow, under the list and above the store section.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);

  const controls = await page.locator('main').locator('a, button, input').evaluateAll((elements) =>
    elements
      .map((element) => ({
        name: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName,
        rect: element.getBoundingClientRect(),
      }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0)
      .map(({ name, rect }) => ({ name, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height })),
  );
  expect(controls.length, 'controls were collected').toBeGreaterThan(8);
  for (const box of controls) {
    expect(box.x, `${box.name}: left edge`).toBeGreaterThanOrEqual(0);
    expect(box.right, `${box.name}: right edge`).toBeLessThanOrEqual(viewport.width);
  }
  for (const [index, a] of controls.entries()) {
    for (const b of controls.slice(index + 1)) {
      const overlaps = a.x < b.right - 0.5 && b.x < a.right - 0.5 && a.y < b.bottom - 0.5 && b.y < a.bottom - 0.5;
      expect(overlaps, `"${a.name}" overlaps "${b.name}"`).toBe(false);
    }
  }

  for (const name of ['Marcar Reckless Swing (Azul)', 'Uma cópia a mais de Reckless Swing (Azul)', 'Uma cópia a menos de Reckless Swing (Azul)']) {
    const box = (await page.getByRole(name.startsWith('Marcar') ? 'checkbox' : 'button', { name }).boundingBox())!;
    expect(box.height, `${name}: height`).toBeGreaterThanOrEqual(44);
    expect(box.width, `${name}: width`).toBeGreaterThanOrEqual(44);
  }

  // The bar is stacked: the summary, then the full-width button, then "Limpar" at full width too.
  const send = (await bar.getByRole('button', { name: 'Oferecer no WhatsApp' }).boundingBox())!;
  const clear = (await bar.getByRole('button', { name: 'Limpar' }).boundingBox())!;
  const summary = (await bar.getByRole('status').boundingBox())!;
  expect(summary.y, 'the summary is above the button').toBeLessThan(send.y);
  expect(clear.y, '"Limpar" is under the button').toBeGreaterThan(send.y + send.height - 1);
  expect(send.width, 'the button spans the page').toBeGreaterThan(viewport.width - 48);
  expect(clear.width, '"Limpar" spans the page').toBeGreaterThan(viewport.width - 48);
  expect(send.height).toBeGreaterThanOrEqual(44);
  expect(clear.height).toBeGreaterThanOrEqual(44);

  // "Limpar" empties the selection and the bar goes away.
  await bar.getByRole('button', { name: 'Limpar' }).click();
  await expect(page.getByTestId('offer-bar')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(0);
});
