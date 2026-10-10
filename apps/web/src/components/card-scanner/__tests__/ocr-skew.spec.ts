import type { ICardImage, IGrayImage } from '../ocr-image';
import { cropLevelled, estimateSkewDegrees } from '../ocr-skew';

const WIDTH = 600;
const HEIGHT = 840;
const PAPER = 230;
const INK = 20;

/**
 * A card with dark horizontal bands near the bottom, as the border, type bar
 * and code line make on a real card, rotated clockwise by `degrees` about the
 * guide's centre (image y grows downwards). A margin draws the scene around
 * the guide too, as a capture wider than the guide does.
 */
function tiltedCard(degrees: number, margin = 0, dashed = false): ICardImage {
  const radians = (degrees * Math.PI) / 180;
  const bands = [0.8, 0.86, 0.95].map((fraction) => (fraction - 0.5) * HEIGHT);
  const width = WIDTH + 2 * margin;
  const height = HEIGHT + 2 * margin;
  const pixels = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - width / 2;
      const dy = y + 0.5 - height / 2;
      const along = dx * Math.cos(radians) + dy * Math.sin(radians);
      const across = -dx * Math.sin(radians) + dy * Math.cos(radians);
      const inked = !dashed || Math.floor((along + WIDTH) / 12) % 2 === 0;
      const onBand = inked && Math.abs(along) < WIDTH / 2 && bands.some((band) => Math.abs(across - band) < 4);
      pixels[y * width + x] = onBand ? INK : PAPER;
    }
  }
  const image = { width, height, pixels };
  return margin === 0 ? image : { ...image, guide: { x: margin, y: margin, width: WIDTH, height: HEIGHT } };
}

function meanDifference(a: IGrayImage, b: IGrayImage): number {
  return a.pixels.reduce((sum, value, i) => sum + Math.abs(value - b.pixels[i]!), 0) / a.pixels.length;
}

function darkRows(image: IGrayImage, share = 0.6): number[] {
  const rows: number[] = [];
  for (let y = 0; y < image.height; y += 1) {
    let dark = 0;
    for (let x = 0; x < image.width; x += 1) if (image.pixels[y * image.width + x]! < 128) dark += 1;
    if (dark > image.width * share) rows.push(y);
  }
  return rows;
}

describe('estimateSkewDegrees', () => {
  it.each([0, 3, -3, 6.5, -8, 11])('finds a %s° tilt within half a degree', (degrees) => {
    expect(Math.abs(estimateSkewDegrees(tiltedCard(degrees)) - degrees)).toBeLessThanOrEqual(0.5);
  });

  it('reads a blank frame as level', () => {
    const blank: IGrayImage = { width: WIDTH, height: HEIGHT, pixels: new Uint8ClampedArray(WIDTH * HEIGHT).fill(PAPER) };

    expect(estimateSkewDegrees(blank)).toBe(0);
  });
});

describe('cropLevelled', () => {
  const band = { left: 0.1, top: 0.93, width: 0.8, height: 0.04 };

  it.each([0, 5, -7])('crops a %s° tilted line as a level line across the whole band', (degrees) => {
    const crop = cropLevelled(tiltedCard(degrees), band);

    expect([crop.width, crop.height]).toEqual([480, 34]);
    expect(darkRows(crop).length).toBeGreaterThan(0);
  });

  it('reads past the guide when the tilted line leaves it', () => {
    const fullWidthBand = { left: 0, top: 0.93, width: 1, height: 0.04 };
    const level = cropLevelled(tiltedCard(0, 0, true), fullWidthBand);

    const guideOnly = cropLevelled(tiltedCard(7, 0, true), fullWidthBand);
    const withMargin = cropLevelled(tiltedCard(7, 60, true), fullWidthBand);

    expect(meanDifference(withMargin, level)).toBeLessThan(meanDifference(guideOnly, level) * 0.6);
  });

  it('estimates the tilt inside the guide of a wider capture', () => {
    expect(estimateSkewDegrees(tiltedCard(7, 60))).toBeCloseTo(7, 0);
  });

  it('loses the line at 7° when cropping without levelling', () => {
    const card = tiltedCard(7);
    const left = Math.round(band.left * WIDTH);
    const top = Math.round(band.top * HEIGHT);
    const straight: IGrayImage = {
      width: 480,
      height: 34,
      pixels: Uint8ClampedArray.from({ length: 480 * 34 }, (_, i) => card.pixels[(top + Math.floor(i / 480)) * WIDTH + left + (i % 480)]!),
    };

    expect(darkRows(straight)).toEqual([]);
  });
});
