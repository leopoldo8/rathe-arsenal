import sharp, { type Sharp } from 'sharp';
import { buildFanLayers } from './card-layers';
import {
  COLORS,
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  JPEG_QUALITY,
  MAX_JPEG_BYTES,
  fanSlots,
} from './image-layout';
import {
  WORDMARK_ADVANCE_UNITS,
  WORDMARK_ASCENT_UNITS,
  WORDMARK_DESCENT_UNITS,
  WORDMARK_PATH,
  WORDMARK_UNITS_PER_EM,
} from './wordmark-path';
import { renderText, renderTextFitting, type ITextLayer } from './text-layer';

export interface IShareImageInput {
  readonly kindLabel: string;
  readonly sharerName: string;
  readonly title: string;
  readonly heroName: string;
  readonly detail: string;
  readonly shareAddress: string;
  readonly legalLine: string;
  readonly byLabel: string;
}

export interface IShareImageFaces {
  // Hero first; null where a face failed to load or must not be drawn.
  readonly faces: readonly (Buffer | null)[];
  readonly backdrop: Buffer | null;
}

interface ILayer {
  readonly input: Buffer;
  readonly left: number;
  readonly top: number;
  readonly raw?: { width: number; height: number; channels: 4 };
}

const MARGIN = 48;
const TITLE_MAX_WIDTH = 660;
const RIGHT_COLUMN_MAX_WIDTH = 410;
const FALLBACK_QUALITIES = [JPEG_QUALITY, 75, 65, 55];

const svg = (body: string): Buffer =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}">${body}</svg>`);

const place = (layer: ITextLayer, left: number, top: number): ILayer => ({
  input: layer.input,
  left: Math.round(left),
  top: Math.round(top),
});

async function backdropLayer(backdrop: Buffer | null): Promise<ILayer[]> {
  const scrim = svg(
    `<defs><radialGradient id="v" cx="50%" cy="40%" r="75%">` +
      `<stop offset="0" stop-color="${COLORS.canvas}" stop-opacity="${backdrop ? 0.72 : 0}"/>` +
      `<stop offset="1" stop-color="${COLORS.canvas}" stop-opacity="${backdrop ? 0.92 : 0.6}"/></radialGradient></defs>` +
      `<rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="url(#v)"/>`,
  );
  if (!backdrop) {
    const glow = svg(
      `<defs><radialGradient id="g" cx="50%" cy="35%" r="55%"><stop offset="0" stop-color="#1b1e26"/>` +
        `<stop offset="1" stop-color="${COLORS.canvas}"/></radialGradient></defs>` +
        `<rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="url(#g)"/>`,
    );
    return [{ input: glow, left: 0, top: 0 }];
  }
  const blurred = await sharp(backdrop)
    .resize({ width: 1400 })
    .extract({ left: 100, top: 300, width: IMAGE_WIDTH, height: IMAGE_HEIGHT })
    .blur(26)
    .png()
    .toBuffer();
  return [
    { input: blurred, left: 0, top: 0 },
    { input: scrim, left: 0, top: 0 },
  ];
}

const WORDMARK_SIZE_PX = 46;

function wordmarkLogo(): { input: Buffer; width: number; height: number } {
  const scale = WORDMARK_SIZE_PX / WORDMARK_UNITS_PER_EM;
  const width = Math.ceil(WORDMARK_ADVANCE_UNITS * scale);
  const height = Math.ceil((WORDMARK_ASCENT_UNITS + WORDMARK_DESCENT_UNITS) * scale);
  const input = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<path transform="translate(0 ${WORDMARK_ASCENT_UNITS * scale}) scale(${scale})" fill="${COLORS.accent}" d="${WORDMARK_PATH}"/></svg>`,
  );
  return { input, width, height };
}

async function wordmarkLayers(): Promise<ILayer[]> {
  const logo = wordmarkLogo();
  const arsenal = await renderText({
    text: 'ARSENAL',
    font: 'bodyBold',
    sizePx: 11,
    color: '#f0d289',
    letterSpacingPx: 4.8,
  });
  const logoTop = 34;
  const ruleY = logoTop + logo.height + 2;
  const rule = svg(
    `<rect x="${MARGIN}" y="${ruleY}" width="${Math.max(logo.width, arsenal.width)}" height="1" ` +
      `fill="${COLORS.accent}" fill-opacity="0.5"/>`,
  );
  return [
    { input: logo.input, left: MARGIN, top: logoTop },
    { input: rule, left: 0, top: 0 },
    place(arsenal, MARGIN, ruleY + 6),
  ];
}

// The kind pill and the "by <name>" row are left out when their text is empty (the generic image has neither).
async function bylineLayers(input: IShareImageInput): Promise<ILayer[]> {
  const rowTop = 470;
  const layers: ILayer[] = [];
  let cursorX = MARGIN;
  let rowHeight = 0;
  let pillWidth = 0;

  if (input.kindLabel) {
    const pill = await renderText({
      text: input.kindLabel.toUpperCase(),
      font: 'bodyBold',
      sizePx: 18,
      color: COLORS.accent,
      letterSpacingPx: 2.9,
    });
    pillWidth = pill.width + 32;
    rowHeight = pill.height + 12;
    layers.push({
      input: svg(
        `<rect x="${MARGIN + 0.75}" y="${rowTop + 0.75}" width="${pillWidth - 1.5}" height="${rowHeight - 1.5}" ` +
          `rx="4" fill="none" stroke="${COLORS.accent}" stroke-width="1.5"/>`,
      ),
      left: 0,
      top: 0,
    });
    layers.push(place(pill, MARGIN + 16, rowTop + 6));
    cursorX = MARGIN + pillWidth + 16;
  }

  if (input.sharerName) {
    const by = await renderText({ text: input.byLabel, font: 'body', sizePx: 23, color: COLORS.muted });
    const sharer = await renderTextFitting(
      { text: input.sharerName, font: 'bodyBold', sizePx: 23, color: COLORS.text },
      TITLE_MAX_WIDTH - pillWidth - by.width - 40,
    );
    const rowMiddle = rowTop + (rowHeight || by.height) / 2;
    layers.push(place(by, cursorX, rowMiddle - by.height / 2));
    layers.push(place(sharer, cursorX + by.width + 6, rowMiddle - sharer.height / 2));
  }
  return layers;
}

async function infoLayers(input: IShareImageInput): Promise<ILayer[]> {
  const title = await renderTextFitting(
    { text: input.title, font: 'display', sizePx: 58, color: COLORS.title },
    TITLE_MAX_WIDTH,
  );
  const hero = await renderTextFitting(
    { text: input.heroName, font: 'bodyBold', sizePx: 25, color: COLORS.text },
    RIGHT_COLUMN_MAX_WIDTH,
  );
  const detail = await renderTextFitting(
    { text: input.detail, font: 'body', sizePx: 25, color: COLORS.muted },
    RIGHT_COLUMN_MAX_WIDTH,
  );
  const legal = await renderText({ text: input.legalLine, font: 'body', sizePx: 16.5, color: COLORS.legal });
  const address = await renderTextFitting(
    { text: input.shareAddress, font: 'body', sizePx: 16.5, color: COLORS.legal },
    IMAGE_WIDTH - MARGIN * 2 - legal.width - 40,
  );
  const right = IMAGE_WIDTH - MARGIN;

  return [
    ...(await bylineLayers(input)),
    place(title, MARGIN, 510),
    place(hero, right - hero.width, 487),
    place(detail, right - detail.width, 527),
    place(legal, MARGIN, 586),
    place(address, right - address.width, 586),
  ];
}

const BOTTOM_FADE = svg(
  `<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COLORS.canvas}" stop-opacity="0"/>` +
    `<stop offset="0.23" stop-color="${COLORS.canvas}"/></linearGradient></defs>` +
    `<rect x="0" y="430" width="${IMAGE_WIDTH}" height="200" fill="url(#b)"/>`,
);

async function encodeJpeg(composed: Sharp): Promise<Buffer> {
  const flat = await composed.flatten({ background: COLORS.canvas }).png({ compressionLevel: 1 }).toBuffer();
  let last = Buffer.alloc(0);
  for (const quality of FALLBACK_QUALITIES) {
    last = await sharp(flat).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (last.length <= MAX_JPEG_BYTES) return last;
  }
  return last;
}

export async function renderShareImage(
  input: IShareImageInput,
  artwork: IShareImageFaces,
): Promise<Buffer> {
  const slots = fanSlots(artwork.faces.length);
  const heroSlotIndex = slots.findIndex((slot) => slot.isHeroSlot);
  const otherSlots = slots.map((_, index) => index).filter((index) => index !== heroSlotIndex);
  const facesInSlotOrder: (Buffer | null)[] = new Array(slots.length).fill(null);
  artwork.faces.forEach((face, faceIndex) => {
    const slotIndex = faceIndex === 0 ? heroSlotIndex : otherSlots[faceIndex - 1];
    if (slotIndex !== undefined) facesInSlotOrder[slotIndex] = face;
  });

  const layers: ILayer[] = [
    ...(await backdropLayer(artwork.backdrop)),
    ...(await wordmarkLayers()),
    ...(await buildFanLayers(slots, facesInSlotOrder)),
    { input: BOTTOM_FADE, left: 0, top: 0 },
    ...(await infoLayers(input)),
  ];

  const canvas = sharp({
    create: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, channels: 4, background: COLORS.canvas },
  }).composite(layers);
  return encodeJpeg(canvas);
}
