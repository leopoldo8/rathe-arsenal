import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium, expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { BASE_URL, STORAGE_STATE_PATH } from '../support/fixture';
import { guideRectInVideo } from '../../src/components/card-scanner/guide-geometry';

const SCANNED_CODE = 'HNT135';
const SCANNED_NAME = 'Knife Through Butter';
// A History Pack 1 card (dark code on a white border) dropped into a light box:
// smaller than the guide and higher than it, as in the 2026-11-13 report.
const OFF_GUIDE_CODE = '1HP096';
const OFF_GUIDE_NAME = 'Breaking Scales';
const OFF_GUIDE_PLACEMENT: IPlacement = { scale: 0.85, shift: -0.05, background: { r: 205, g: 205, b: 200 } };
const CARD_IMAGE_BASE = 'https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/';
const CACHE_DIR = fileURLToPath(new URL('../../.cache/ocr-reference', import.meta.url));
const FAKE_VIDEO = path.join(CACHE_DIR, `${SCANNED_CODE}-camera.mjpeg`);
const OFF_GUIDE_VIDEO = path.join(CACHE_DIR, `${OFF_GUIDE_CODE}-off-guide-camera.mjpeg`);

// Chromium's fake camera delivers this file as a square 1080 x 1080 track.
const FRAME = { width: 1080, height: 1080 } as const;
const STAGE_ASPECT = { width: 3, height: 4 } as const;
const OCR_ASSET = /\/ocr\/(worker\.min\.js|tesseract-core[^/]*\.wasm\.js|eng\.traineddata\.gz)$/;
const THIRD_PARTY_HOSTS = ['cdn.jsdelivr.net', 'unpkg.com'];

interface IPlacement {
  /** Card height as a fraction of the guide's. */
  readonly scale: number;
  /** How far the card's bottom edge sits below the guide's, as a fraction of the guide's height. */
  readonly shift: number;
  readonly background: { readonly r: number; readonly g: number; readonly b: number };
}

const FILLS_THE_GUIDE: IPlacement = { scale: 1, shift: 0, background: { r: 10, g: 10, b: 10 } };

async function ensureFakeCameraVideo(code: string, file: string, placement: IPlacement): Promise<void> {
  if (fs.existsSync(file)) return;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const response = await fetch(`${CARD_IMAGE_BASE}${code}.webp`);
  if (!response.ok) throw new Error(`Could not download ${code}: ${response.status}`);
  const box = guideRectInVideo(FRAME, STAGE_ASPECT);
  const height = Math.round(box.height * placement.scale);
  const width = Math.round((box.width * height) / box.height);
  const card = await sharp(Buffer.from(await response.arrayBuffer()))
    .resize(width, height)
    .toBuffer();
  const frame = await sharp({
    create: { width: FRAME.width, height: FRAME.height, channels: 3, background: placement.background },
  })
    .composite([
      {
        input: card,
        left: Math.round(box.x + (box.width - width) / 2),
        top: Math.round(box.y + box.height * (1 + placement.shift) - height),
      },
    ])
    .jpeg({ quality: 95 })
    .toBuffer();
  fs.writeFileSync(file, Buffer.concat([frame, frame, frame]));
}

function launchWithFakeCamera(video: string): Promise<Browser> {
  return chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${video}`,
    ],
  });
}

test.describe('Card scanner', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    await ensureFakeCameraVideo(SCANNED_CODE, FAKE_VIDEO, FILLS_THE_GUIDE);
    browser = await launchWithFakeCamera(FAKE_VIDEO);
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test.beforeEach(async () => {
    context = await browser.newContext({ storageState: STORAGE_STATE_PATH, permissions: ['camera'] });
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await context?.close();
  });

  async function scanOneCard(): Promise<void> {
    await page.goto(`${BASE_URL}/add-cards/scan`);
    await expect(page.getByTestId('scan-notice')).toContainText(SCANNED_NAME, { timeout: 90_000 });
    await expect(page.getByTestId('scanner-bar-count')).toHaveText(/^1 (card|carta)$/);
  }

  test('scans a card from the fake camera', async () => {
    test.setTimeout(120_000);

    await scanOneCard();
  });

  test('takes the whole screen without the app navigation', async () => {
    await page.goto(`${BASE_URL}/add-cards/scan`);

    await expect(page.getByTestId('card-guide')).toBeVisible();
    await expect(page.getByRole('link', { name: /^(Close the scanner|Fechar o scanner)$/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^(Library|Biblioteca)$/ })).toHaveCount(0);
    await expect(page.locator('footer')).toHaveCount(0);
  });

  test('asks before leaving with a non-empty tray', async () => {
    test.setTimeout(120_000);
    await scanOneCard();

    await page.getByRole('link', { name: /^(Close the scanner|Fechar o scanner)$/ }).click();

    const keep = page.getByTestId('discard-confirm-keep-btn');
    await expect(keep).toBeVisible();
    await keep.click();
    await expect(page).toHaveURL(/\/add-cards\/scan$/);
    await expect(page.getByTestId('scanner-bar-count')).toHaveText(/^1 (card|carta)$/);
  });

  test('loads OCR assets from its own origin', async () => {
    test.setTimeout(120_000);
    const requested: URL[] = [];
    page.on('request', (request) => requested.push(new URL(request.url())));

    await scanOneCard();

    const origin = new URL(BASE_URL).origin;
    const ocrRequests = requested.filter((url) => OCR_ASSET.test(url.pathname));
    expect(ocrRequests.map((url) => path.basename(url.pathname))).toEqual(
      expect.arrayContaining(['worker.min.js', 'eng.traineddata.gz']),
    );
    expect(ocrRequests.some((url) => /tesseract-core.*\.wasm\.js$/.test(url.pathname))).toBe(true);
    expect(ocrRequests.every((url) => url.origin === origin)).toBe(true);
    expect(requested.filter((url) => THIRD_PARTY_HOSTS.includes(url.hostname))).toEqual([]);
  });

  test('other routes never load OCR assets', async () => {
    const requested: string[] = [];
    page.on('request', (request) => requested.push(new URL(request.url()).pathname));

    for (const route of ['/home', '/library', '/add-cards/manual']) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
    }

    expect(requested.filter((pathname) => pathname.includes('/ocr/'))).toEqual([]);
  });
});

test.describe('Card scanner, card off the guide', () => {
  let browser: Browser;

  test.beforeAll(async () => {
    await ensureFakeCameraVideo(OFF_GUIDE_CODE, OFF_GUIDE_VIDEO, OFF_GUIDE_PLACEMENT);
    browser = await launchWithFakeCamera(OFF_GUIDE_VIDEO);
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test('scans a History Pack 1 card smaller than the guide and above it', async () => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ storageState: STORAGE_STATE_PATH, permissions: ['camera'] });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/add-cards/scan`);

    await expect(page.getByTestId('scan-notice')).toContainText(OFF_GUIDE_NAME, { timeout: 90_000 });
    await expect(page.getByTestId('scanner-bar-count')).toHaveText(/^1 (card|carta)$/);
    await context.close();
  });
});
