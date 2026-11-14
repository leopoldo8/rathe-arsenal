import type { ICardImage, IGrayImage } from '../ocr-image';
import { cardCandidates, findTextLines, locateCard } from '../code-line-locator';

const PAPER = 215;
const INK = 40;

interface IWordsOptions {
  readonly centerX: number;
  readonly centerY: number;
  readonly charHeight: number;
  readonly words: number;
  /** Clockwise slope of the line; each character keeps upright and moves down the slope. */
  readonly degrees?: number;
}

/** Draws a line of block "words" (four characters each) centred on (centerX, centerY). */
function drawLine(image: IGrayImage, options: IWordsOptions): void {
  const { charHeight, words } = options;
  const charWidth = Math.round(charHeight * 0.6);
  const charGap = Math.max(1, Math.round(charHeight * 0.25));
  const wordWidth = 4 * charWidth + 3 * charGap;
  const wordGap = charHeight;
  const total = words * wordWidth + (words - 1) * wordGap;
  const slope = Math.tan(((options.degrees ?? 0) * Math.PI) / 180);
  let x = Math.round(options.centerX - total / 2);
  for (let word = 0; word < words; word += 1) {
    for (let char = 0; char < 4; char += 1) {
      const top = Math.round(options.centerY - charHeight / 2 + (x + charWidth / 2 - options.centerX) * slope);
      for (let y = top; y < top + charHeight; y += 1) image.pixels.fill(INK, y * image.width + x, y * image.width + x + charWidth);
      x += charWidth + charGap;
    }
    x += wordGap - charGap;
  }
}

/** A light card's bottom: a type line, and the code line 0.044 card heights below it. */
function cardBottom(cardHeight: number, codeLineY: number, degrees = 0): ICardImage {
  const width = 900;
  const height = 1400;
  const image: IGrayImage = { width, height, pixels: new Uint8ClampedArray(width * height).fill(PAPER) };
  const codeHeight = Math.round(cardHeight * 0.0125);
  const radians = (degrees * Math.PI) / 180;
  const gap = cardHeight * 0.044;
  const typeLine = { centerX: 450 + gap * Math.sin(radians), centerY: codeLineY - gap * Math.cos(radians) };
  drawLine(image, { ...typeLine, charHeight: Math.round(codeHeight * 1.3), words: 4, degrees });
  drawLine(image, { centerX: 450, centerY: codeLineY, charHeight: codeHeight, words: 6, degrees });
  return { ...image, guide: { x: 50, y: 100, width: 800, height: 1200 } };
}

describe('findTextLines', () => {
  it('finds a line of dark words on a light background with its character height', () => {
    const card = cardBottom(1000, 900);

    const lines = findTextLines(card, { x: 0, y: 700, width: card.width, height: 400 }, { minCharHeight: 5, maxCharHeight: 40 });

    const code = lines.find((line) => Math.abs(line.centerY - 900) < 3);
    expect(code?.charHeight).toBe(13);
    expect(Math.abs(code!.degrees)).toBeLessThan(0.5);
  });
});

describe('locateCard', () => {
  it('puts the code line where it is and sizes the card from the two lines', () => {
    const located = locateCard(cardBottom(1000, 1000));

    expect(located).not.toBeNull();
    const codeLineY = located!.guide.y + located!.guide.height * 0.957;
    expect(Math.abs(codeLineY - 1000)).toBeLessThan(4);
    expect(located!.guide.height / 1000).toBeGreaterThan(0.85);
    expect(located!.guide.height / 1000).toBeLessThan(1.15);
  });

  it.each([5, -5])('follows a card tilted %s°', (degrees) => {
    const located = locateCard(cardBottom(1000, 1000, degrees));

    expect(located).not.toBeNull();
    expect(Math.abs(located!.degrees - degrees)).toBeLessThan(1);
    const codeLineY = located!.guide.y + located!.guide.height * 0.957;
    expect(Math.abs(codeLineY - 1000)).toBeLessThan(8);
  });

  it('finds nothing in a blank capture', () => {
    const blank: ICardImage = { width: 400, height: 600, pixels: new Uint8ClampedArray(400 * 600).fill(PAPER) };

    expect(locateCard(blank)).toBeNull();
  });
});

describe('cardCandidates', () => {
  it('keeps only the guide when the code line is where the guide expects it', () => {
    const guideCodeLineY = 100 + 1200 * 0.957;
    const card = cardBottom(1150, guideCodeLineY);

    expect(cardCandidates(card)).toEqual([card]);
  });

  it('adds the located card when the code line sits well above the guide line', () => {
    const card = cardBottom(900, 1050);

    const candidates = cardCandidates(card);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toBe(card);
    expect(candidates[1]!.guide!.height).toBeLessThan(card.guide!.height);
  });
});
