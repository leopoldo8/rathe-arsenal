import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { blockingViolations, describeViolations, SCAN_PAGES, type IScanContext, type TAxeViolation } from '../support/axe';
import { ANON_STORAGE_STATE, BASE_URL, loadFixture } from '../support/fixture';

function violation(id: string, impact: TAxeViolation['impact']): TAxeViolation {
  return { id, impact, nodes: [], tags: [], description: '', help: '', helpUrl: '' };
}

test.describe('axe filter', () => {
  test('the axe filter keeps serious and critical issues only', () => {
    const kept = blockingViolations([
      violation('a-minor', 'minor'),
      violation('b-moderate', 'moderate'),
      violation('c-serious', 'serious'),
      violation('d-critical', 'critical'),
    ]);

    expect(kept.map((v) => v.id)).toEqual(['c-serious', 'd-critical']);
  });
});

async function deckShareToken(deckId: number, jwt: string): Promise<string> {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };
  const url = `${BASE_URL}/api/decks/${deckId}/share`;
  const current = await fetch(url, { headers });
  const state = (await current.json()) as { deck: { token: string } | null };
  if (state.deck) return state.deck.token;

  // Creating a share link requires a display name; the fixture user has none.
  await fetch(`${BASE_URL}/api/users/me/display-name`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ displayName: 'Fixture' }),
  });
  const created = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ intent: 'deck' }) });
  if (!created.ok) throw new Error(`could not enable the fixture deck share link: ${created.status}`);
  return ((await created.json()) as { token: string }).token;
}

test.describe('accessibility scan', () => {
  let context: IScanContext;

  test.beforeAll(async () => {
    const { jwt, readyDeckId } = loadFixture();
    context = { readyDeckId, shareToken: await deckShareToken(readyDeckId, jwt) };
  });

  for (const scanPage of SCAN_PAGES) {
    test(`no serious or critical axe issue on ${scanPage.name}`, async ({ browser, page }) => {
      const scanned = scanPage.signedOut
        ? await (await browser.newContext({ storageState: ANON_STORAGE_STATE })).newPage()
        : page;

      // The product's language is pt-BR; without the pin the browser's own language decides.
      await scanned.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
      await scanned.goto(`${BASE_URL}${scanPage.path(context)}`, { waitUntil: 'networkidle', timeout: 20000 });
      const { violations } = await new AxeBuilder({ page: scanned }).analyze();

      expect(describeViolations(blockingViolations(violations))).toEqual([]);
      if (scanPage.signedOut) await scanned.context().close();
    });
  }
});
