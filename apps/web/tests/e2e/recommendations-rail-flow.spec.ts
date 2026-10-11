/**
 * E2E for the recommendations rail: while a run is in progress the deck page shows the candidate pile; when the answer
 * arrives the cards are dealt from the pile into their slots. A real run needs Gemini, so the read route is mocked.
 *
 * PREREQUISITES: dev server up (api :3000, web :5173); the Playwright global setup seeds the fixture deck.
 */
import { test, expect, type Page } from '@playwright/test';
import { BASE_URL, pinPortuguese } from './swaps-helpers';
import { loadFixture } from '../support/fixture';

const IMAGE_BASE = 'https://legendstory-production-s3-public.s3.amazonaws.com/media/cards';

function image(code: string) {
  return { small: `${IMAGE_BASE}/small/${code}.webp`, large: `${IMAGE_BASE}/large/${code}.webp`, sources: [] };
}

function card(id: string, rank: number, cardIdentifier: string, name: string, code: string) {
  return {
    id,
    rank,
    cardIdentifier,
    name,
    pitch: 1,
    cost: 1,
    imageUrl: image(code),
    slot: 'mainboard',
    strength: rank === 1 ? 'clear_upgrade' : 'consider',
    reason: `Motivo para ${name}.`,
    cutCardIdentifier: null,
    cutName: null,
    cutPitch: null,
    cutCost: null,
    cutSlot: null,
    freeCopies: 0,
    priceCents: null,
    productUrl: null,
  };
}

const GENERATING = {
  run: null,
  pending: true,
  failure: null,
  generation: {
    status: 'running',
    elapsedMs: 42_000,
    typicalMs: 120_000,
    poolSize: 821,
    poolSample: [
      { cardIdentifier: 'spire-sniping-yellow', name: 'Spire Sniping', imageUrl: image('SAZ031') },
      { cardIdentifier: 'drop-the-anchor-red', name: 'Drop the Anchor', imageUrl: image('SAZ021') },
    ],
  },
  recommendations: [],
};

const DONE = {
  run: { id: 'run-new', status: 'done', trigger: 'manual', finishedAt: '2026-10-11T10:00:00.000Z', stale: false },
  pending: false,
  failure: null,
  generation: null,
  recommendations: [
    card('rec-1', 1, 'increase-the-tension-red', 'Increase the Tension', 'RIP022'),
    card('rec-2', 2, 'fletch-a-red-tail-red', 'Fletch a Red Tail', 'OUT109'),
    card('rec-3', 3, 'lace-with-frailty-red', 'Lace with Frailty', 'SAZ023'),
  ],
};

async function serveRecommendations(page: Page, body: () => unknown): Promise<void> {
  await page.route('**/api/decks/*/recommendations', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body()) }),
  );
}

/** Records, for every dealt card, its box when its flight finishes and the box of the slot it was flying to. */
async function recordLandings(page: Page): Promise<void> {
  await page.evaluate(() => {
    const record = window as unknown as { __landings: unknown[]; __delays: number[]; __railHeights: number[]; __reasonOpacityAfterLanding: number[] };
    record.__landings = [];
    record.__reasonOpacityAfterLanding = [];
    record.__delays = [];
    record.__railHeights = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function animate(this: Element, keyframes, options) {
      const animation = original.call(this, keyframes, options);
      if (this.getAttribute('data-testid') === 'dealt-card') {
        const index = record.__delays.length;
        const delay = typeof options === 'object' && options !== null ? Number(options.delay ?? 0) : 0;
        record.__delays.push(delay);
        const rail = document.querySelector('[data-testid="recommendations-rail"]');
        if (index === 0 && rail) record.__railHeights.push(rail.getBoundingClientRect().height);
        void animation.finished.then(() => {
          const slot = document.querySelectorAll('[data-deal-slot]')[index];
          const box = this.getBoundingClientRect();
          const target = slot?.getBoundingClientRect();
          const reason = [...(slot?.closest('[data-testid="recommendation-row"]')?.querySelectorAll('p') ?? [])].find((p) =>
            p.textContent?.startsWith('Motivo'),
          );
          window.setTimeout(() => {
            if (reason) record.__reasonOpacityAfterLanding.push(Number(getComputedStyle(reason).opacity));
          }, 60);
          record.__landings.push({
            index,
            card: target ? [box.left - target.left, box.top - target.top, box.width - target.width, box.height - target.height] : null,
          });
        });
      }
      return animation;
    };
  });
}

test.describe('Recommendations rail — E2E', () => {
  test.beforeEach(async ({ page }) => {
    await pinPortuguese(page);
  });

  test('deals the arriving cards exactly into place', async ({ page }) => {
    test.setTimeout(60_000);
    let body: unknown = GENERATING;
    await serveRecommendations(page, () => body);
    await page.goto(`${BASE_URL}/decks/${loadFixture().swapDeckId}`, { waitUntil: 'networkidle', timeout: 20000 });

    const section = page.getByTestId('recommendations-panel');
    await expect(section.getByTestId('recommendations-pile')).toBeVisible();
    await expect(section.getByTestId('recommendations-pile')).toContainText('821');
    await expect(section.getByTestId('generation-step')).toContainText('O modelo avalia 821 cartas');
    await recordLandings(page);

    body = DONE;
    await expect(section.getByTestId('recommendations-pile')).toHaveCount(0, { timeout: 20_000 });

    const record = await page.evaluate(() => {
      const recorded = window as unknown as {
        __landings: { index: number; card: number[] | null }[];
        __delays: number[];
        __railHeights: number[];
        __reasonOpacityAfterLanding: number[];
      };
      return {
        __landings: recorded.__landings,
        __delays: recorded.__delays,
        __railHeights: recorded.__railHeights,
        __reasonOpacityAfterLanding: recorded.__reasonOpacityAfterLanding,
      };
    });
    expect(record.__delays).toEqual([0, 190, 380]);
    expect(record.__landings).toHaveLength(3);
    for (const landing of record.__landings) {
      expect(landing.card).not.toBeNull();
      for (const difference of landing.card!) expect(Math.abs(difference)).toBeLessThanOrEqual(0.5);
    }
    const cards = section.getByTestId('recommendation-row');
    await expect(cards).toHaveCount(3);
    for (const name of ['Increase the Tension', 'Fletch a Red Tail', 'Lace with Frailty']) {
      await expect(section.getByText(`Motivo para ${name}.`)).toBeVisible();
    }
    const settledHeight = await section.getByTestId('recommendations-rail').evaluate((rail) => rail.getBoundingClientRect().height);
    expect(Math.abs(record.__railHeights[0]! - settledHeight)).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('dealt-card')).toHaveCount(0);
    expect(record.__reasonOpacityAfterLanding).toHaveLength(3);
    for (const opacity of record.__reasonOpacityAfterLanding) expect(opacity).toBeLessThan(0.5);
    for (const name of ['Increase the Tension', 'Fletch a Red Tail', 'Lace with Frailty']) {
      expect(await section.getByText(`Motivo para ${name}.`).evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
    }
  });

  test('arrives without motion when motion is reduced', async ({ page }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let body: unknown = GENERATING;
    await serveRecommendations(page, () => body);
    await page.goto(`${BASE_URL}/decks/${loadFixture().swapDeckId}`, { waitUntil: 'networkidle', timeout: 20000 });
    const section = page.getByTestId('recommendations-panel');
    await expect(section.getByTestId('recommendations-pile')).toBeVisible();
    await page.evaluate(() => {
      const seen = window as unknown as { __dealt: number };
      seen.__dealt = 0;
      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node instanceof Element && node.getAttribute('data-testid') === 'dealt-card') seen.__dealt += 1;
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    });

    body = DONE;

    await expect(section.getByTestId('recommendation-row')).toHaveCount(3, { timeout: 20_000 });
    await expect(section.getByTestId('recommendation-row').first()).toBeVisible();
    await expect(section.getByTestId('recommendations-pile')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __dealt: number }).__dealt)).toBe(0);
  });

  test('the mouse wheel scrolls the rail sideways, and the page once the rail ends', async ({ page }) => {
    const many = {
      ...DONE,
      recommendations: [
        ...DONE.recommendations,
        card('rec-4', 4, 'drop-the-anchor-red', 'Drop the Anchor', 'SAZ021'),
        card('rec-5', 5, 'take-aim-red', 'Take Aim', 'SAZ029'),
        card('rec-6', 6, 'read-the-glide-path-red', 'Read the Glide Path', 'SAZ026'),
      ],
    };
    await serveRecommendations(page, () => many);
    await page.goto(`${BASE_URL}/decks/${loadFixture().swapDeckId}`, { waitUntil: 'networkidle', timeout: 20000 });
    const rail = page.getByTestId('recommendations-rail');
    await expect(rail.getByTestId('recommendation-row')).toHaveCount(6);

    const shape = await rail.evaluate((element) => ({
      scrollbarWidth: getComputedStyle(element).scrollbarWidth,
      scrollbarSpace: element.offsetHeight - element.clientHeight,
      overflows: element.scrollWidth > element.clientWidth,
    }));
    expect(shape).toEqual({ scrollbarWidth: 'none', scrollbarSpace: 0, overflows: true });

    await page.evaluate(() => window.scrollTo(0, 200));
    const box = (await rail.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 120);
    const pageTop = await page.evaluate(() => window.scrollY);

    await page.mouse.wheel(0, 200);
    await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageTop);

    for (let step = 0; step < 15; step += 1) await page.mouse.wheel(0, 200);
    await expect
      .poll(() => rail.evaluate((element) => element.scrollWidth - element.clientWidth - element.scrollLeft))
      .toBeLessThanOrEqual(1);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(pageTop);
  });

  test('a finished run renders without a deal', async ({ page }) => {
    await serveRecommendations(page, () => DONE);
    await page.goto(`${BASE_URL}/decks/${loadFixture().swapDeckId}`, { waitUntil: 'networkidle', timeout: 20000 });

    const section = page.getByTestId('recommendations-panel');
    await expect(section.getByTestId('recommendation-row')).toHaveCount(3);
    await expect(section.getByTestId('recommendation-row').first()).toBeVisible();
    await expect(section.getByTestId('recommendations-pile')).toHaveCount(0);
    await expect(page.getByTestId('dealt-card')).toHaveCount(0);
  });
});
