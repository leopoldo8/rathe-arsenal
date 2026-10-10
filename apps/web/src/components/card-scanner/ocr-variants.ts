import {
  invert,
  stretchContrast,
  threshold,
  resizeToHeight,
  type IFractionRect,
  type ICardImage,
  type IGrayImage,
} from './ocr-image';
import { cropLevelled } from './ocr-skew';

export type TVariantId = 'full' | 'left-binary' | 'full-binary-sparse';

export interface IOcrVariant {
  readonly id: TVariantId;
  readonly prepare: (card: ICardImage) => IGrayImage;
  readonly parameters: Readonly<Record<string, string>>;
}

/** Bottom text line of a card, as fractions of the card's own bounds. */
const CODE_LINE: IFractionRect = { left: 0, top: 0.925, width: 1, height: 0.066 };
const CODE_LINE_LEFT: IFractionRect = { ...CODE_LINE, width: 0.55 };

// Code-line heights the recognizer was tuned on: 3x and 4x of the line in a
// 763 px tall reference card. Camera crops are resized to the same height.
const LINE_HEIGHT = 150;
const LEFT_LINE_HEIGHT = 200;
const BINARY_CUTOFF = 140;
const SPARSE_TEXT_MODE = '11';
const AUTO_MODE = '3';
const CODE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789|-';

const BASE_PARAMETERS = {
  user_defined_dpi: '72',
  tessedit_pageseg_mode: AUTO_MODE,
  tessedit_char_whitelist: '',
} as const;

export const OCR_VARIANTS: readonly IOcrVariant[] = [
  {
    id: 'full',
    prepare: (card) => resizeToHeight(stretchContrast(cropLevelled(card, CODE_LINE)), LINE_HEIGHT),
    parameters: BASE_PARAMETERS,
  },
  {
    id: 'left-binary',
    prepare: (card) =>
      threshold(invert(resizeToHeight(stretchContrast(cropLevelled(card, CODE_LINE_LEFT)), LEFT_LINE_HEIGHT)), BINARY_CUTOFF),
    parameters: BASE_PARAMETERS,
  },
  {
    id: 'full-binary-sparse',
    prepare: (card) =>
      threshold(invert(resizeToHeight(stretchContrast(cropLevelled(card, CODE_LINE)), LINE_HEIGHT)), BINARY_CUTOFF),
    parameters: {
      ...BASE_PARAMETERS,
      tessedit_pageseg_mode: SPARSE_TEXT_MODE,
      tessedit_char_whitelist: CODE_CHARACTERS,
    },
  },
];
