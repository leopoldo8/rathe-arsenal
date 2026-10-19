import sharp, { type Sharp } from 'sharp';
import { CARD_HEIGHT, CARD_RADIUS, CARD_WIDTH, COLORS, type IFanSlot } from './image-layout';

interface IPositionedLayer {
  readonly input: Buffer;
  readonly raw: { width: number; height: number; channels: 4 };
  readonly left: number;
  readonly top: number;
}

const SHADOW_PADDING = 40;
const SHADOW_OFFSET_Y = 18;
const SHADOW_BLUR = 12;

function roundedRectSvg(width: number, height: number, extra = ''): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect x="0" y="0" width="${width}" height="${height}" rx="${CARD_RADIUS}" ry="${CARD_RADIUS}" ${extra}/></svg>`,
  );
}

function frameSvg(isHero: boolean): Buffer {
  const stroke = isHero ? COLORS.accent : 'rgba(255,255,255,0.18)';
  const strokeWidth = isHero ? 4 : 2;
  const inset = strokeWidth / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}">` +
      `<rect x="${inset}" y="${inset}" width="${CARD_WIDTH - strokeWidth}" height="${CARD_HEIGHT - strokeWidth}" ` +
      `rx="${CARD_RADIUS}" ry="${CARD_RADIUS}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/></svg>`,
  );
}

/** Drawn in place of a face that could not be fetched or that must not be shown. Contains no text. */
function cardBackSvg(): Buffer {
  const cx = CARD_WIDTH / 2;
  const cy = CARD_HEIGHT / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="#1b1e26"/><stop offset="1" stop-color="#0e1016"/></linearGradient></defs>` +
      `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#g)"/>` +
      `<rect x="14" y="14" width="${CARD_WIDTH - 28}" height="${CARD_HEIGHT - 28}" rx="6" fill="none" ` +
      `stroke="${COLORS.accent}" stroke-opacity="0.55" stroke-width="2"/>` +
      `<polygon points="${cx},${cy - 46} ${cx + 32},${cy} ${cx},${cy + 46} ${cx - 32},${cy}" fill="none" ` +
      `stroke="${COLORS.accent}" stroke-opacity="0.8" stroke-width="3"/>` +
      `<polygon points="${cx},${cy - 20} ${cx + 14},${cy} ${cx},${cy + 20} ${cx - 14},${cy}" fill="${COLORS.accent}" fill-opacity="0.8"/>` +
      `</svg>`,
  );
}

async function toRaw(pipeline: Sharp): Promise<{ input: Buffer; width: number; height: number }> {
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { input: data, width: info.width, height: info.height };
}

async function cardFace(face: Buffer | null, isHero: boolean): Promise<Buffer> {
  const base = face
    ? sharp(face).resize(CARD_WIDTH, CARD_HEIGHT, { fit: 'cover' })
    : sharp(cardBackSvg());
  return base
    .ensureAlpha()
    .composite([
      { input: roundedRectSvg(CARD_WIDTH, CARD_HEIGHT, 'fill="#fff"'), blend: 'dest-in' },
      { input: frameSvg(isHero) },
    ])
    .png()
    .toBuffer();
}

async function placeRotated(
  source: Buffer | Sharp,
  angleDegrees: number,
  centerX: number,
  centerY: number,
): Promise<IPositionedLayer> {
  const rotated = await toRaw(
    sharp(source as Buffer).rotate(angleDegrees, { background: { r: 0, g: 0, b: 0, alpha: 0 } }),
  );
  return {
    input: rotated.input,
    raw: { width: rotated.width, height: rotated.height, channels: 4 },
    left: Math.round(centerX - rotated.width / 2),
    top: Math.round(centerY - rotated.height / 2),
  };
}

async function cardShadow(slot: IFanSlot): Promise<IPositionedLayer> {
  const width = CARD_WIDTH + SHADOW_PADDING * 2;
  const height = CARD_HEIGHT + SHADOW_PADDING * 2;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect x="${SHADOW_PADDING}" y="${SHADOW_PADDING}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" ` +
      `rx="${CARD_RADIUS}" fill="#000" fill-opacity="${slot.isHeroSlot ? 0.7 : 0.6}"/></svg>`,
  );
  const blurred = await sharp(svg).blur(SHADOW_BLUR).png().toBuffer();
  const radians = (slot.angleDegrees * Math.PI) / 180;
  return placeRotated(
    blurred,
    slot.angleDegrees,
    slot.centerX - SHADOW_OFFSET_Y * Math.sin(radians),
    slot.centerY + SHADOW_OFFSET_Y * Math.cos(radians),
  );
}

/**
 * Layers for the fan, bottom to top: each card's shadow then its face, farthest cards first.
 * The centre card gets the gold frame only when it is the hero.
 */
export async function buildFanLayers(
  slots: readonly IFanSlot[],
  facesInSlotOrder: readonly (Buffer | null)[],
  emphasizeCenter: boolean,
): Promise<IPositionedLayer[]> {
  const order = slots
    .map((slot, index) => ({ slot, face: facesInSlotOrder[index] ?? null }))
    .sort((a, b) => a.slot.zIndex - b.slot.zIndex);

  const layers: IPositionedLayer[] = [];
  for (const { slot, face } of order) {
    layers.push(await cardShadow(slot));
    const faceImage = await cardFace(face, slot.isHeroSlot && emphasizeCenter);
    layers.push(await placeRotated(faceImage, slot.angleDegrees, slot.centerX, slot.centerY));
  }
  return layers;
}
