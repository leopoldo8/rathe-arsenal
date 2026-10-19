import { join } from 'path';

export const IMAGE_WIDTH = 1200;
export const IMAGE_HEIGHT = 630;
export const JPEG_QUALITY = 85;
export const MAX_JPEG_BYTES = 600 * 1024;

export const CARD_WIDTH = 270;
export const CARD_HEIGHT = 378;
export const CARD_RADIUS = 11;
export const MAX_FAN_CARDS = 5;

export const COLORS = {
  canvas: '#0b0c0f',
  accent: '#d0a84c',
  accentHigh: '#f0c060',
  accentInk: '#1a1408',
  text: '#ece8dc',
  title: '#f4efe2',
  muted: '#a39d8e',
  legal: '#b3ad9d',
} as const;

// At runtime this resolves to apps/api/assets/fonts from both src/ (jest) and dist/ (nest build),
// because the app runs from the repository checkout.
export const FONT_DIR = join(__dirname, '..', '..', '..', 'assets', 'fonts');

export const FONTS = {
  display: { file: join(FONT_DIR, 'Newsreader-DisplayMedium.ttf'), family: 'Newsreader Display' },
  body: { file: join(FONT_DIR, 'HankenGrotesk-Medium.ttf'), family: 'Hanken Grotesk Medium' },
  bodyBold: { file: join(FONT_DIR, 'HankenGrotesk-Bold.ttf'), family: 'Hanken Grotesk Bold' },
} as const;

const FAN_ANGLES_BY_COUNT: Readonly<Record<number, readonly number[]>> = {
  1: [0],
  2: [-8, 8],
  3: [-12, 0, 12],
  4: [-18, -6, 6, 18],
  5: [-24, -12, 0, 12, 24],
};

// The fan pivots on a point below the card, so the rotated cards spread like held playing cards.
const FAN_PIVOT_X = 600;
const FAN_PIVOT_Y = 674;
const FAN_RADIUS = 451;

export interface IFanSlot {
  readonly angleDegrees: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly isHeroSlot: boolean;
  readonly zIndex: number;
}

export function fanSlots(cardCount: number): readonly IFanSlot[] {
  const count = Math.min(Math.max(cardCount, 0), MAX_FAN_CARDS);
  const angles = FAN_ANGLES_BY_COUNT[count] ?? [];
  const heroIndex = angles.reduce(
    (best, angle, index) =>
      Math.abs(angle) < Math.abs(angles[best] ?? Infinity) ? index : best,
    0,
  );
  return angles.map((angleDegrees, index) => {
    const radians = (angleDegrees * Math.PI) / 180;
    return {
      angleDegrees,
      centerX: FAN_PIVOT_X + FAN_RADIUS * Math.sin(radians),
      centerY: FAN_PIVOT_Y - FAN_RADIUS * Math.cos(radians),
      isHeroSlot: index === heroIndex,
      zIndex: MAX_FAN_CARDS - Math.abs(index - heroIndex),
    };
  });
}
