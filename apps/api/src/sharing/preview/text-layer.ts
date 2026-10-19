import sharp from 'sharp';
import { escapeHtml } from './share-meta-tags';
import { FONTS } from './image-layout';

export interface ITextSpec {
  readonly text: string;
  readonly font: keyof typeof FONTS;
  readonly sizePx: number;
  readonly color: string;
  readonly letterSpacingPx?: number;
}

export interface ITextLayer {
  readonly input: Buffer;
  readonly width: number;
  readonly height: number;
}

const PANGO_UNITS_PER_POINT = 1024;
const ELLIPSIS = '…';

function toMarkup(spec: ITextSpec): string {
  const spacing =
    spec.letterSpacingPx === undefined
      ? ''
      : ` letter_spacing="${Math.round(spec.letterSpacingPx * PANGO_UNITS_PER_POINT)}"`;
  return `<span foreground="${spec.color}"${spacing}>${escapeHtml(spec.text)}</span>`;
}

// sharp refuses to render empty text, and a name can be blank after trimming.
async function blankLayer(): Promise<ITextLayer> {
  const input = await sharp({
    create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();
  return { input, width: 1, height: 1 };
}

/**
 * Text is drawn from the bundled font file only: `fontfile` is passed on every call,
 * so the result never depends on fonts installed in the container.
 */
export async function renderText(spec: ITextSpec): Promise<ITextLayer> {
  if (spec.text.trim() === '') return blankLayer();
  const font = FONTS[spec.font];
  const { data, info } = await sharp({
    text: {
      text: toMarkup(spec),
      font: `${font.family} ${spec.sizePx}`,
      fontfile: font.file,
      rgba: true,
      dpi: 72,
    },
  })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const input = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png({ compressionLevel: 1 })
    .toBuffer();
  return { input, width: info.width, height: info.height };
}

/** Shortens the text with an ellipsis until it fits, because names are user input of any length. */
export async function renderTextFitting(spec: ITextSpec, maxWidthPx: number): Promise<ITextLayer> {
  const full = await renderText(spec);
  if (full.width <= maxWidthPx) return full;

  const characters = Array.from(spec.text);
  let low = 1;
  let high = characters.length - 1;
  let best = await renderText({ ...spec, text: ELLIPSIS });
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = await renderText({
      ...spec,
      text: `${characters.slice(0, middle).join('').trimEnd()}${ELLIPSIS}`,
    });
    if (candidate.width <= maxWidthPx) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}
