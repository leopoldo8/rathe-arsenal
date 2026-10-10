import type { ICardImage, IFractionRect, IGrayImage, IPixelBox } from './ocr-image';

const MAX_SKEW_DEGREES = 12;
const SKEW_STEP_DEGREES = 0.5;
const ESTIMATE_REGION_TOP = 0.72;
const ESTIMATE_WIDTH = 240;

const skewCache = new WeakMap<ICardImage, number>();

/**
 * Angle, clockwise in image coordinates, at which the card's horizontal
 * lines run: the one where the bottom region's horizontal edges pile up
 * into the fewest rows.
 */
export function estimateSkewDegrees(card: ICardImage): number {
  const cached = skewCache.get(card);
  if (cached !== undefined) return cached;
  const skew = findSkew(card);
  skewCache.set(card, skew);
  return skew;
}

/**
 * Crops `rect`, given in the card's own frame, from a card tilted by its
 * estimated skew; a tilted corner may reach into the capture's margin.
 */
export function cropLevelled(card: ICardImage, rect: IFractionRect): IGrayImage {
  return cropRotated(card, rect, estimateSkewDegrees(card));
}

function findSkew(card: ICardImage): number {
  const edges = horizontalEdges(card);
  let best = { degrees: 0, score: scoreAt(edges, 0) };
  for (let degrees = -MAX_SKEW_DEGREES; degrees <= MAX_SKEW_DEGREES; degrees += SKEW_STEP_DEGREES) {
    const score = scoreAt(edges, degrees);
    if (score > best.score) best = { degrees, score };
  }
  return best.degrees;
}

interface IEdgeMap {
  readonly width: number;
  readonly height: number;
  readonly centerY: number;
  readonly strength: Float32Array;
}

/** Vertical gradient of a downscaled copy of the card's bottom region, offset from the card centre. */
function horizontalEdges(card: ICardImage): IEdgeMap {
  const guide = guideOf(card);
  const step = Math.max(1, Math.floor(guide.width / ESTIMATE_WIDTH));
  const width = Math.floor(guide.width / step);
  const top = Math.floor((guide.height * ESTIMATE_REGION_TOP) / step);
  const height = Math.floor(guide.height / step) - top;
  const small = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let dy = 0; dy < step; dy += 1) {
        const row = (guide.y + (top + y) * step + dy) * card.width + guide.x;
        for (let dx = 0; dx < step; dx += 1) sum += card.pixels[row + x * step + dx]!;
      }
      small[y * width + x] = sum / (step * step);
    }
  }
  const strength = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 0; x < width; x += 1) {
      strength[y * width + x] = Math.abs(small[(y + 1) * width + x]! - small[(y - 1) * width + x]!);
    }
  }
  return { width, height, centerY: guide.height / step / 2 - top, strength };
}

/** Sum of squared row totals after projecting the edges onto the tilted card's vertical axis. */
function scoreAt(edges: IEdgeMap, degrees: number): number {
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const centerX = edges.width / 2;
  const margin = Math.ceil(edges.width * Math.abs(sin)) + 1;
  const rows = new Float32Array(edges.height + 2 * margin);
  for (let y = 0; y < edges.height; y += 1) {
    for (let x = 0; x < edges.width; x += 1) {
      const strength = edges.strength[y * edges.width + x]!;
      if (strength === 0) continue;
      const across = -(x - centerX) * sin + (y - edges.centerY) * cos + edges.centerY;
      const row = Math.round(across) + margin;
      rows[row] = rows[row]! + strength;
    }
  }
  return rows.reduce((sum, total) => sum + total * total, 0);
}

function cropRotated(card: ICardImage, rect: IFractionRect, degrees: number): IGrayImage {
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const guide = guideOf(card);
  const centerX = guide.x + guide.width / 2;
  const centerY = guide.y + guide.height / 2;
  const width = Math.max(1, Math.round(rect.width * guide.width));
  const height = Math.max(1, Math.round(rect.height * guide.height));
  const startAlong = rect.left * guide.width - guide.width / 2;
  const startAcross = rect.top * guide.height - guide.height / 2;
  const pixels = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    const across = startAcross + y + 0.5;
    for (let x = 0; x < width; x += 1) {
      const along = startAlong + x + 0.5;
      const sourceX = centerX + along * cos - across * sin - 0.5;
      const sourceY = centerY + along * sin + across * cos - 0.5;
      pixels[y * width + x] = sampleBilinear(card, sourceX, sourceY);
    }
  }
  return { width, height, pixels };
}

function guideOf(card: ICardImage): IPixelBox {
  return card.guide ?? { x: 0, y: 0, width: card.width, height: card.height };
}

function sampleBilinear(image: IGrayImage, x: number, y: number): number {
  const clampedX = Math.min(image.width - 1, Math.max(0, x));
  const clampedY = Math.min(image.height - 1, Math.max(0, y));
  const left = Math.floor(clampedX);
  const top = Math.floor(clampedY);
  const right = Math.min(image.width - 1, left + 1);
  const bottom = Math.min(image.height - 1, top + 1);
  const fx = clampedX - left;
  const fy = clampedY - top;
  const upper = image.pixels[top * image.width + left]! * (1 - fx) + image.pixels[top * image.width + right]! * fx;
  const lower = image.pixels[bottom * image.width + left]! * (1 - fx) + image.pixels[bottom * image.width + right]! * fx;
  return upper * (1 - fy) + lower * fy;
}
