// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { ICollectorCodesResponse } from '../../../api/collector-codes';
import { buildCollectorCodeIndex, readCollectorCode } from '../collector-code';
import { createOcrEngine, type IOcrEngine } from '../ocr-engine';
import { cardCandidates } from '../code-line-locator';
import { rgbaToGray, type ICardImage } from '../ocr-image';
import { OCR_VARIANTS } from '../ocr-variants';
import { applyRecognition, EMPTY_SESSION, VOTE_WINDOW } from '../scan-session';

const REFERENCE_CODES = [
  '1HP108', '1HP211', 'AKO009', 'AKO010', 'AMX014', 'AMX026', 'ARC108', 'ARC169', 'CRU137', 'CRU153',
  'DTD017', 'DTD082', 'DYN155', 'DYN215', 'ELE057', 'ELE189', 'EVO084', 'EVO197', 'EVR035', 'EVR165',
  'HNT135', 'HNT235', 'HVY142', 'HVY217', 'MON042', 'MON194', 'MST010', 'MST172', 'OUT143', 'OUT227',
  'ROS024', 'ROS248', 'SEA156', 'SEA223', 'UPR073', 'UPR092', 'WTR036', 'WTR218',
] as const;

const TILT_BACKGROUND_COLOR = { r: 20, g: 20, b: 20 };
const TILT_BACKGROUND = TILT_BACKGROUND_COLOR;
// Measured 23/26 on 2026-11-13. The placed cases below read 32, 24 and 26 of
// 38; the scanner before the code-line locator read none of the shifted ones.
const MIN_RIGHT_HISTORY_PACK = 21;

// History Pack 1 prints its code line in dark text on a white border.
const HISTORY_PACK_CODES = [
  '1HP007', '1HP017', '1HP027', '1HP037', '1HP049', '1HP059', '1HP069', '1HP079', '1HP094', '1HP095',
  '1HP096', '1HP104', '1HP114', '1HP124', '1HP134', '1HP148', '1HP158', '1HP168', '1HP178', '1HP191',
  '1HP201', '1HP224', '1HP234', '1HP244', '1HP254', '1HP286',
] as const;

interface IBenchmarkCase {
  /** null keeps the official image's width; 885 is a card filling the guide on a phone filming at 1920x1080. */
  readonly width: number | null;
  /** Clockwise tilt of the card inside the guide. */
  readonly degrees: number;
  readonly minRight: number;
  readonly codes?: readonly string[];
  /** Where the card lies instead of filling the guide: none of the old cases set it. */
  readonly placement?: IPlacement;
}

interface IPlacement {
  /** Card height as a fraction of the guide's. */
  readonly scale: number;
  /** How far the card's bottom edge sits below the guide's, as a fraction of the guide's height. */
  readonly shift: number;
  readonly background: { readonly r: number; readonly g: number; readonly b: number };
}

const LIGHT_BOX = { r: 205, g: 205, b: 200 };

const BENCHMARK_CASES: readonly IBenchmarkCase[] = [
  { width: null, degrees: 0, minRight: 32 },
  { width: 885, degrees: 0, minRight: 32 },
  { width: 885, degrees: 6, minRight: 30 },
  { width: 885, degrees: -6, minRight: 30 },
  { width: 885, degrees: 0, minRight: MIN_RIGHT_HISTORY_PACK, codes: HISTORY_PACK_CODES },
  // A card dropped into a white box, smaller than the guide: the setup of the 2026-11-13 report.
  { width: 885, degrees: 0, minRight: 30, placement: { scale: 0.75, shift: 0, background: LIGHT_BOX } },
  { width: 885, degrees: 0, minRight: 22, placement: { scale: 1, shift: -0.05, background: TILT_BACKGROUND_COLOR } },
  { width: 885, degrees: 0, minRight: 24, placement: { scale: 0.85, shift: 0.05, background: TILT_BACKGROUND_COLOR } },
];
const CARD_ASPECT = 88 / 63;
// Matches the margins the scanner captures around its guide.
const CAPTURE_MARGIN = 0.08;
const CAPTURE_MARGIN_VERTICAL = 0.12;
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

async function cachedCardFile(code: string): Promise<string> {
  const file = path.join(CACHE_DIR, `${code}.webp`);
  if (!fs.existsSync(file)) {
    const response = await fetch(`${CARD_IMAGE_BASE}${code}.webp`);
    if (!response.ok) throw new Error(`Could not download ${code}: ${response.status}`);
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  return file;
}

/** The capture of a guide sized for a `width` card, with the card placed per `placement`. */
async function loadPlacedCard(code: string, width: number, placement: IPlacement): Promise<ICardImage> {
  const guide = { width, height: Math.round(width * CARD_ASPECT) };
  const margin = Math.round(guide.width * CAPTURE_MARGIN);
  const marginVertical = Math.round(guide.height * CAPTURE_MARGIN_VERTICAL);
  const cardHeight = Math.round(guide.height * placement.scale);
  const cardWidth = Math.round(cardHeight / CARD_ASPECT);
  const card = await sharp(await cachedCardFile(code)).resize(cardWidth, cardHeight).png().toBuffer();
  const captureWidth = guide.width + 2 * margin;
  const captureHeight = guide.height + 2 * marginVertical;
  const { data, info } = await sharp({
    create: { width: captureWidth, height: captureHeight, channels: 3, background: placement.background },
  })
    .composite([
      {
        input: card,
        left: Math.round((captureWidth - cardWidth) / 2),
        top: Math.round(marginVertical + guide.height * (1 + placement.shift) - cardHeight),
      },
    ])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    ...rgbaToGray(new Uint8ClampedArray(data), info.width, info.height),
    guide: { x: margin, y: marginVertical, ...guide },
  };
}

async function loadCardImage(code: string, { width, degrees, placement }: IBenchmarkCase): Promise<readonly ICardImage[]> {
  if (placement) return cardCandidates(await loadPlacedCard(code, width ?? 885, placement));
  const file = await cachedCardFile(code);
  const sized = width === null ? sharp(file) : sharp(file).resize(width, Math.round(width * CARD_ASPECT));
  const { data: flat, info: flatInfo } = await sized.png().toBuffer({ resolveWithObject: true });
  const margin = Math.round(flatInfo.width * CAPTURE_MARGIN);
  const tilted = await sharp(flat)
    .extend({ top: margin, bottom: margin, left: margin, right: margin, background: TILT_BACKGROUND })
    .rotate(degrees, { background: TILT_BACKGROUND })
    .png()
    .toBuffer({ resolveWithObject: true });
  const captureWidth = flatInfo.width + 2 * margin;
  const captureHeight = flatInfo.height + 2 * margin;
  const { data, info } = await sharp(tilted.data)
    .extract({
      left: Math.round((tilted.info.width - captureWidth) / 2),
      top: Math.round((tilted.info.height - captureHeight) / 2),
      width: captureWidth,
      height: captureHeight,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return cardCandidates({
    ...rgbaToGray(new Uint8ClampedArray(data), info.width, info.height),
    guide: { x: margin, y: margin, width: flatInfo.width, height: flatInfo.height },
  });
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

  it.each(BENCHMARK_CASES)(
    'accepts at least $minRight right codes and no wrong code at card width $width tilted $degrees° placed $placement.scale $placement.shift',
    async (benchmarkCase) => {
      const index = buildCollectorCodeIndex(loadFullIndexResponse());
      let right = 0;
      const wrong: string[] = [];

      const codes = benchmarkCase.codes ?? REFERENCE_CODES;
      for (const code of codes) {
        // The scanner alternates between the guide's crop and the located card's, one per read.
        const crops = await loadCardImage(code, benchmarkCase);
        const readByVariant = new Map<string, string>();
        let session = EMPTY_SESSION;
        for (let attempt = 0; attempt < VOTE_WINDOW; attempt += 1) {
          const variant = OCR_VARIANTS[attempt % OCR_VARIANTS.length]!;
          const crop = attempt % crops.length;
          const key = `${variant.id}@${crop}`;
          const text = readByVariant.get(key) ?? (await engine.recognize(crops[crop]!, variant));
          readByVariant.set(key, text);
          const step = applyRecognition(session, variant.id, readCollectorCode(text, index));
          session = step.session;
          if (step.outcome.kind === 'added') {
            if (step.outcome.code === code) right += 1;
            else wrong.push(`${code}->${step.outcome.code}`);
            break;
          }
        }
      }

      const placed = benchmarkCase.placement ? `, card ${benchmarkCase.placement.scale} of the guide shifted ${benchmarkCase.placement.shift}` : '';
      console.info(`recognition benchmark (width ${benchmarkCase.width ?? 'native'}, ${benchmarkCase.degrees}°${placed}${benchmarkCase.codes ? ', History Pack 1' : ''}): ${right}/${codes.length} right, wrong: [${wrong.join(', ')}]`);
      expect(wrong.length).toBeLessThanOrEqual(MAX_WRONG);
      expect(right).toBeGreaterThanOrEqual(benchmarkCase.minRight);
    },
    300_000,
  );
});
