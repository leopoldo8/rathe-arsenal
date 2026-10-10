// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { ICollectorCodesResponse } from '../../../api/collector-codes';
import { buildCollectorCodeIndex, resolveCollectorCode } from '../collector-code';
import { createOcrEngine, type IOcrEngine } from '../ocr-engine';
import { rgbaToGray, type IGrayImage } from '../ocr-image';
import { OCR_VARIANTS } from '../ocr-variants';
import { applyRecognition, EMPTY_SESSION, VOTE_WINDOW } from '../scan-session';

const REFERENCE_CODES = [
  '1HP108', '1HP211', 'AKO009', 'AKO010', 'AMX014', 'AMX026', 'ARC108', 'ARC169', 'CRU137', 'CRU153',
  'DTD017', 'DTD082', 'DYN155', 'DYN215', 'ELE057', 'ELE189', 'EVO084', 'EVO197', 'EVR035', 'EVR165',
  'HNT135', 'HNT235', 'HVY142', 'HVY217', 'MON042', 'MON194', 'MST010', 'MST172', 'OUT143', 'OUT227',
  'ROS024', 'ROS248', 'SEA156', 'SEA223', 'UPR073', 'UPR092', 'WTR036', 'WTR218',
] as const;

const MIN_RIGHT = 32;
// The official image's width, and the width a card takes in the guide on a phone filming at 1920x1080.
const CARD_WIDTHS = [null, 885] as const;
const CARD_ASPECT = 88 / 63;
const MAX_WRONG = 0;
const CARD_IMAGE_BASE = 'https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '../../../..');
const CACHE_DIR = path.join(WEB_ROOT, '.cache/ocr-reference');
const requireFromHere = createRequire(import.meta.url);

interface IDatasetCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch?: number;
  readonly types?: readonly string[];
  readonly printings?: readonly { readonly identifier?: string }[];
}

function loadFullIndexResponse(): ICollectorCodesResponse {
  // The dataset is installed under the engine package only.
  const datasetPath = requireFromHere.resolve('@flesh-and-blood/cards', {
    paths: [path.resolve(WEB_ROOT, '../../packages/engine')],
  });
  const cards = (requireFromHere(datasetPath) as { cards: readonly IDatasetCard[] }).cards;
  return {
    imageSmallBase: '',
    cards: cards
      .filter((card) => !(card.types ?? []).some((type) => type === 'Hero' || type === 'Token'))
      .map((card) => ({
        cardIdentifier: card.cardIdentifier,
        name: card.name,
        pitch: card.pitch ?? null,
        printings: [...new Set((card.printings ?? []).flatMap((p) => (p.identifier ? [p.identifier] : [])))].map(
          (code) => ({ code }),
        ),
      })),
  };
}

async function loadCardImage(code: string, width: number | null): Promise<IGrayImage> {
  const file = path.join(CACHE_DIR, `${code}.webp`);
  if (!fs.existsSync(file)) {
    const response = await fetch(`${CARD_IMAGE_BASE}${code}.webp`);
    if (!response.ok) throw new Error(`Could not download ${code}: ${response.status}`);
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  const image = width === null ? sharp(file) : sharp(file).resize(width, Math.round(width * CARD_ASPECT));
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return rgbaToGray(new Uint8ClampedArray(data), info.width, info.height);
}

describe('recognition pipeline over the reference set', () => {
  let engine: IOcrEngine;

  beforeAll(async () => {
    engine = await createOcrEngine({
      workerOptions: {
        langPath: path.dirname(requireFromHere.resolve('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz')),
        gzip: true,
        cacheMethod: 'none',
      },
      toInput: (bmp) => Buffer.from(bmp),
    });
  }, 60_000);

  afterAll(async () => {
    await engine?.terminate();
  });

  it.each(CARD_WIDTHS)(
    'accepts at least 32 right codes and no wrong code at card width %s',
    async (width) => {
      const index = buildCollectorCodeIndex(loadFullIndexResponse());
      let right = 0;
      const wrong: string[] = [];

      for (const code of REFERENCE_CODES) {
        const card = await loadCardImage(code, width);
        const readByVariant = new Map<string, string>();
        let session = EMPTY_SESSION;
        for (let attempt = 0; attempt < VOTE_WINDOW; attempt += 1) {
          const variant = OCR_VARIANTS[attempt % OCR_VARIANTS.length]!;
          const text = readByVariant.get(variant.id) ?? (await engine.recognize(card, variant));
          readByVariant.set(variant.id, text);
          const step = applyRecognition(session, variant.id, resolveCollectorCode(text, index));
          session = step.session;
          if (step.outcome.kind === 'added') {
            if (step.outcome.code === code) right += 1;
            else wrong.push(`${code}->${step.outcome.code}`);
            break;
          }
        }
      }

      console.info(`recognition benchmark (width ${width ?? 'native'}): ${right}/${REFERENCE_CODES.length} right, wrong: [${wrong.join(', ')}]`);
      expect(wrong.length).toBeLessThanOrEqual(MAX_WRONG);
      expect(right).toBeGreaterThanOrEqual(MIN_RIGHT);
    },
    300_000,
  );
});
