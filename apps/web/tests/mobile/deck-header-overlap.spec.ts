import { test, expect, type Page } from '@playwright/test';
import { loadFixture, resetFixture } from '../support/fixture';
import { openCompositionEditor } from '../support/pages';

interface IBox {
  readonly label: string;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const CONTROLS = 'button, a[href], [role="button"], [role="combobox"], select, input';
const TOUCH_TOLERANCE_PX = 1;

async function controlBoxes(page: Page, rootSelector: string): Promise<readonly IBox[]> {
  return page.evaluate(
    ({ rootSelector: root, controls }) => {
      const container = document.querySelector(root);
      if (!container) throw new Error(`no element matches ${root}`);
      return Array.from(container.querySelectorAll<HTMLElement>(controls))
        .filter((el) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
        })
        .map((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const own = el.getBoundingClientRect();
          const content = range.getBoundingClientRect();
          const rect = {
            left: Math.min(own.left, content.width > 0 ? content.left : own.left),
            top: Math.min(own.top, content.height > 0 ? content.top : own.top),
            right: Math.max(own.right, content.width > 0 ? content.right : own.right),
            bottom: Math.max(own.bottom, content.height > 0 ? content.bottom : own.bottom),
          };
          const label = el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName;
          return { label: label.slice(0, 40), left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        });
    },
    { rootSelector, controls: CONTROLS },
  );
}

function intersections(boxes: readonly IBox[]): readonly string[] {
  const found: string[] = [];
  boxes.forEach((a, index) => {
    boxes.slice(index + 1).forEach((b) => {
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapX > TOUCH_TOLERANCE_PX && overlapY > TOUCH_TOLERANCE_PX) found.push(`${a.label} x ${b.label}`);
    });
  });
  return found;
}

async function expectInsideScreen(page: Page, boxes: readonly IBox[]): Promise<void> {
  const width = await page.evaluate(() => window.visualViewport?.width ?? window.innerWidth);
  const outside = boxes.filter((box) => box.left < -TOUCH_TOLERANCE_PX || box.right > width + TOUCH_TOLERANCE_PX);
  expect(outside.map((box) => box.label), 'controls drawn past the screen edge').toEqual([]);
}

test.describe('deck edit header controls', () => {
  test.beforeAll(async () => {
    await resetFixture();
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rathe.lang', 'pt-BR'));
  });

  test('do not intersect on the composition editor', async ({ page }) => {
    await openCompositionEditor(page, loadFixture().readyDeckId);

    const boxes = await controlBoxes(page, '[data-testid="deck-detail-header"]');

    expect(boxes.map((box) => box.label)).toEqual(expect.arrayContaining(['deck-detail-cancel-btn', 'deck-detail-save-btn']));
    expect(intersections(boxes)).toEqual([]);
    await expectInsideScreen(page, boxes);
  });

  test('do not intersect when the save error shows', async ({ page }) => {
    await page.route('**/api/decks/*', (route) =>
      route.request().method() === 'PUT' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.continue(),
    );
    await openCompositionEditor(page, loadFixture().readyDeckId);
    await page.getByTestId('deck-detail-save-btn').click();
    await expect(page.getByTestId('deck-detail-save-error')).toBeVisible();

    const boxes = await controlBoxes(page, '[data-testid="deck-detail-header"]');

    expect(intersections(boxes)).toEqual([]);
    await expectInsideScreen(page, boxes);
  });

  test('do not intersect on the Edit deck screen', async ({ page }) => {
    await page.goto(`/decks/${loadFixture().readyDeckId}/edit`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('deck-edit-panel')).toBeVisible();

    const boxes = await controlBoxes(page, '[data-testid="deck-edit-page"]');

    expect(boxes.map((box) => box.label)).toEqual(expect.arrayContaining(['deck-edit-cancel', 'deck-edit-save']));
    expect(intersections(boxes)).toEqual([]);
    await expectInsideScreen(page, boxes);
  });
});
