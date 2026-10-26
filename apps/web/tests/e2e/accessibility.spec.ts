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

async function deckShareToken(deckId: number, sessionToken: string): Promise<string> {
  const headers = { 'Content-Type': 'application/json', Cookie: `ra_session=${sessionToken}` };
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

async function firstSourceId(sessionToken: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/collection/sources`, { headers: { Cookie: `ra_session=${sessionToken}` } });
  const sources = (await response.json()) as Array<{ id: string }>;
  return sources[0]?.id ?? '00000000-0000-4000-8000-000000000000';
}

test.describe('accessibility scan', () => {
  let context: IScanContext;

  test.beforeAll(async () => {
    const { sessionToken, readyDeckId } = loadFixture();
    context = {
      readyDeckId,
      shareToken: await deckShareToken(readyDeckId, sessionToken),
      sourceId: await firstSourceId(sessionToken),
    };
  });

  test('no serious or critical axe issue on the scan list: it starts with exactly the five named pages', () => {
    const firstFive = SCAN_PAGES.slice(0, 5).map((scanPage) => ({
      name: scanPage.name,
      path: scanPage.path({ readyDeckId: 42, shareToken: 'TOKEN', sourceId: 'SRC' }),
      signedOut: scanPage.signedOut === true,
    }));

    expect(firstFive).toEqual([
      { name: 'home', path: '/home', signedOut: false },
      { name: 'deck page', path: '/decks/42', signedOut: false },
      { name: 'library', path: '/library', signedOut: false },
      { name: 'shared deck page', path: '/d/TOKEN', signedOut: false },
      { name: 'sign-in', path: '/sign-in', signedOut: true },
    ]);
  });

  test('no serious or critical axe issue on a failing page: the message names the rule id and the selector', () => {
    const failing: TAxeViolation = {
      ...violation('color-contrast', 'serious'),
      nodes: [{ target: ['#app', '.hero > a'] } as TAxeViolation['nodes'][number]],
    };

    expect(describeViolations(blockingViolations([failing]))).toEqual(['color-contrast (serious): #app .hero > a']);
  });

  for (const scanPage of SCAN_PAGES) {
    test(`no serious or critical axe issue on ${scanPage.name}`, async ({ browser, page }) => {
      const scanned = scanPage.signedOut
        ? await (await browser.newContext({ storageState: ANON_STORAGE_STATE })).newPage()
        : page;

      // The product's language is pt-BR; without the pin the browser's own language decides.
      await scanned.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
      await scanned.goto(`${BASE_URL}${scanPage.path(context)}`, { waitUntil: 'networkidle', timeout: 20000 });
      await scanPage.prepare?.(scanned);
      const { violations } = await new AxeBuilder({ page: scanned }).analyze();

      expect(describeViolations(blockingViolations(violations))).toEqual([]);
      if (scanPage.signedOut) await scanned.context().close();
    });
  }
});
