import type { IGrayImage } from '../ocr-image';
import { OCR_VARIANTS } from '../ocr-variants';

// A card as the guide crops it on a phone filming at 1920x1080, and a far smaller one.
const CARD_SIZES = [
  [885, 1238],
  [450, 630],
] as const;

describe('OCR_VARIANTS', () => {
  it.each(CARD_SIZES)('hands the recognizer the same line height for a %sx%s card', (width, height) => {
    const card: IGrayImage = { width, height, pixels: new Uint8ClampedArray(width * height).fill(128) };

    const heights = OCR_VARIANTS.map((variant) => [variant.id, variant.prepare(card).height]);

    expect(heights).toEqual([
      ['full', 150],
      ['left-binary', 200],
      ['full-binary-sparse', 150],
    ]);
  });
});
