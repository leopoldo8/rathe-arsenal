import type { ICardImage, IGrayImage, IPixelBox } from './ocr-image';

/** A text line found in the image: its centre, its slope and the height of its characters, in image pixels. */
export interface ITextLine {
  readonly centerX: number;
  readonly centerY: number;
  readonly left: number;
  readonly right: number;
  readonly charHeight: number;
  readonly degrees: number;
  readonly charCount: number;
}

interface IComponent {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly height: number;
}

export interface ILocateOptions {
  /** Smallest and largest character height to look for, in image pixels. */
  readonly minCharHeight: number;
  readonly maxCharHeight: number;
}

// Glyphs of the small code-line font touch at camera resolution, so a component is often a whole word.
const MIN_PIECES_PER_LINE = 4;
const MIN_LINE_LENGTH_IN_HEIGHTS = 10;
const LOCAL_CONTRAST = 14;
const MAX_PIECE_ASPECT = 12;
const MIN_FILL = 0.12;
const MAX_PIECE_GAP_IN_HEIGHTS = 1.6;
const MAX_DRIFT_IN_HEIGHTS = 0.45;
const MAX_HEIGHT_RATIO = 1.7;
// A frame full of texture (a busy background, motion blur) stops here instead of stalling the page.
const MAX_COMPONENTS = 6000;

/**
 * Finds horizontal lines of characters inside `region`: pixels that differ
 * from their neighbourhood mean are grouped into components, components of
 * character size are chained left to right into lines. Both dark text on a
 * light border and light text on a dark border are searched.
 */
export function findTextLines(image: IGrayImage, region: IPixelBox, options: ILocateOptions): readonly ITextLine[] {
  const window = Math.max(3, Math.round(options.maxCharHeight * 2)) | 1;
  const means = localMeans(image, region, window);
  return [-1, 1].flatMap((polarity) => {
    const ink = inkMask(image, region, means, polarity);
    const components = labelComponents(ink, region).filter((component) => isCharSized(component, options));
    return chainLines(components);
  });
}

function localMeans(image: IGrayImage, region: IPixelBox, window: number): Float32Array {
  const { x: left, y: top, width, height } = region;
  // Sums stay below 2^32 for any capture under 16 million pixels.
  const integral = new Uint32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += image.pixels[(top + y) * image.width + left + x]!;
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1]! + rowSum;
    }
  }
  const half = window >> 1;
  const means = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height, y + half + 1);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width, x + half + 1);
      const sum =
        integral[y1 * (width + 1) + x1]! -
        integral[y0 * (width + 1) + x1]! -
        integral[y1 * (width + 1) + x0]! +
        integral[y0 * (width + 1) + x0]!;
      means[y * width + x] = sum / ((x1 - x0) * (y1 - y0));
    }
  }
  return means;
}

function inkMask(image: IGrayImage, region: IPixelBox, means: Float32Array, polarity: number): Uint8Array {
  const mask = new Uint8Array(region.width * region.height);
  for (let y = 0; y < region.height; y += 1) {
    for (let x = 0; x < region.width; x += 1) {
      const value = image.pixels[(region.y + y) * image.width + region.x + x]!;
      const offset = (value - means[y * region.width + x]!) * polarity;
      if (offset > LOCAL_CONTRAST) mask[y * region.width + x] = 1;
    }
  }
  return mask;
}

function labelComponents(mask: Uint8Array, region: IPixelBox): IComponent[] {
  const { width } = region;
  const labelled = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  const components: IComponent[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || labelled[start] === 1) continue;
    if (components.length >= MAX_COMPONENTS) break;
    let left = width;
    let right = -1;
    let top = Number.MAX_SAFE_INTEGER;
    let bottom = -1;
    let area = 0;
    let depth = 0;
    labelled[start] = 1;
    stack[depth++] = start;
    while (depth > 0) {
      const at = stack[--depth]!;
      const x = at % width;
      const y = (at - x) / width;
      area += 1;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x > 0 && mask[at - 1] === 1 && labelled[at - 1] === 0) {
        labelled[at - 1] = 1;
        stack[depth++] = at - 1;
      }
      if (x < width - 1 && mask[at + 1] === 1 && labelled[at + 1] === 0) {
        labelled[at + 1] = 1;
        stack[depth++] = at + 1;
      }
      if (at >= width && mask[at - width] === 1 && labelled[at - width] === 0) {
        labelled[at - width] = 1;
        stack[depth++] = at - width;
      }
      if (at + width < mask.length && mask[at + width] === 1 && labelled[at + width] === 0) {
        labelled[at + width] = 1;
        stack[depth++] = at + width;
      }
    }
    const boxHeight = bottom - top + 1;
    const boxWidth = right - left + 1;
    if (area < MIN_FILL * boxWidth * boxHeight) continue;
    components.push({
      left: region.x + left,
      right: region.x + right,
      top: region.y + top,
      bottom: region.y + bottom,
      centerX: region.x + (left + right) / 2,
      centerY: region.y + (top + bottom) / 2,
      height: boxHeight,
    });
  }
  return components;
}

function isCharSized(component: IComponent, options: ILocateOptions): boolean {
  const width = component.right - component.left + 1;
  return (
    component.height >= options.minCharHeight &&
    component.height <= options.maxCharHeight &&
    width <= component.height * MAX_PIECE_ASPECT
  );
}

function chainLines(components: readonly IComponent[]): ITextLine[] {
  const sorted = [...components].sort((a, b) => a.left - b.left);
  const chains: IComponent[][] = [];
  for (const component of sorted) {
    const chain = chains.find((candidate) => continues(candidate[candidate.length - 1]!, component));
    if (chain) chain.push(component);
    else chains.push([component]);
  }
  return chains
    .map(toLine)
    .filter((line) => line.charCount >= MIN_PIECES_PER_LINE && line.right - line.left >= line.charHeight * MIN_LINE_LENGTH_IN_HEIGHTS);
}

function continues(last: IComponent, next: IComponent): boolean {
  const height = Math.max(last.height, next.height);
  const ratio = Math.max(last.height, next.height) / Math.min(last.height, next.height);
  return (
    next.left - last.right <= height * MAX_PIECE_GAP_IN_HEIGHTS &&
    next.left >= last.left &&
    Math.abs(next.centerY - last.centerY) <= height * MAX_DRIFT_IN_HEIGHTS &&
    ratio <= MAX_HEIGHT_RATIO
  );
}

function toLine(chain: readonly IComponent[]): ITextLine {
  const count = chain.length;
  const meanX = chain.reduce((sum, c) => sum + c.centerX, 0) / count;
  const meanY = chain.reduce((sum, c) => sum + c.centerY, 0) / count;
  const covariance = chain.reduce((sum, c) => sum + (c.centerX - meanX) * (c.centerY - meanY), 0);
  const variance = chain.reduce((sum, c) => sum + (c.centerX - meanX) ** 2, 0) || 1;
  const heights = chain.map((c) => c.height).sort((a, b) => a - b);
  return {
    centerX: meanX,
    centerY: meanY,
    left: chain[0]!.left,
    right: chain[count - 1]!.right,
    charHeight: heights[Math.floor(count / 2)]!,
    degrees: (Math.atan2(covariance, variance) * 180) / Math.PI,
    charCount: count,
  };
}


// Card proportions every set shares, measured on official images: the code
// line's centre sits at 0.957 of the card height, the type line's centre
// 0.044 card heights above it, and the code characters are 0.0125 tall.
const CODE_LINE_CENTER = 0.957;
const TYPE_TO_CODE = 0.044;
const CODE_CHAR_HEIGHT = 0.0125;
const CARD_ASPECT = 63 / 88;
// Gap from type line to code line, in code character heights.
const MIN_TYPE_GAP_IN_HEIGHTS = 2.8;
const MAX_TYPE_GAP_IN_HEIGHTS = 4.8;
const MAX_ANGLE_DIFFERENCE = 2;
const MAX_CODE_TO_TYPE_HEIGHT = 1.1;
// Lines of one code line split by a wide gap still lie on the same baseline.
const MAX_BASELINE_OFFSET_IN_HEIGHTS = 0.5;
// Where a card may be: from 55% to 115% of the guide's height.
const MIN_CARD_SCALE = 0.55;
const MAX_CARD_SCALE = 1.15;
const SEARCH_FROM = 0.3;

export interface ILocatedCard {
  readonly guide: IPixelBox;
  readonly degrees: number;
  /** How far the two size estimates (line gap, character height) disagree, as |ln(ratio)|. */
  readonly disagreement: number;
  readonly codeCharHeight: number;
}

const SAME_SIZE_RATIO = 1.2;
const CLEAR_BELOW_IN_HEIGHTS = 3.5;

// The gap and the character height must give about the same card size.
const MAX_SIZE_DISAGREEMENT = 0.18;

/**
 * Finds the card's code line by the type line printed right above it, and
 * returns where the whole card is: the box it would fill when level and its
 * tilt. Null when no such pair of lines is in view.
 */
export function locateCard(card: ICardImage): ILocatedCard | null {
  const guide = card.guide ?? { x: 0, y: 0, width: card.width, height: card.height };
  const top = Math.max(0, Math.round(guide.y + guide.height * SEARCH_FROM));
  const region = { x: 0, y: top, width: card.width, height: card.height - top };
  const lines = findTextLines(card, region, {
    minCharHeight: Math.max(3, Math.floor(guide.height * MIN_CARD_SCALE * CODE_CHAR_HEIGHT * 0.6)),
    maxCharHeight: Math.ceil(guide.height * MAX_CARD_SCALE * CODE_CHAR_HEIGHT * 2.2),
  });
  const candidates = lines.flatMap((typeLine) =>
    codeLinesBelow(typeLine, lines)
      .filter((code) => isLastLine(code, lines))
      .map((code) => toCard(typeLine, code)),
  );
  const plausible = candidates.filter((located) => {
    const scale = located.guide.height / guide.height;
    return scale >= MIN_CARD_SCALE && scale <= MAX_CARD_SCALE && located.disagreement <= MAX_SIZE_DISAGREEMENT;
  });
  if (plausible.length === 0) return null;
  // Rules text pairs up too, but its characters are larger than the code line's.
  const smallest = Math.min(...plausible.map((located) => located.codeCharHeight));
  const codeSized = plausible.filter((located) => located.codeCharHeight <= smallest * SAME_SIZE_RATIO);
  // A card underneath shows its code line only below the top card's, never above it.
  return codeSized.reduce((best, next) => (codeLineY(next) < codeLineY(best) ? next : best));
}

/**
 * The code line is the card's last line: only its border lies below. A card
 * underneath shows its own lines further down, past that border.
 */
function isLastLine(code: ITextLine, lines: readonly ITextLine[]): boolean {
  return !lines.some((line) => {
    if (line.right < code.left || line.left > code.right) return false;
    const below = offsetBelow(code, line.centerX, line.centerY);
    return below > code.charHeight * 0.5 && below < code.charHeight * CLEAR_BELOW_IN_HEIGHTS;
  });
}

function codeLineY(located: ILocatedCard): number {
  return located.guide.y + located.guide.height * CODE_LINE_CENTER;
}

/** Distance of a point below a line, measured across the line's slope. */
function offsetBelow(line: ITextLine, x: number, y: number): number {
  const radians = (line.degrees * Math.PI) / 180;
  return -(x - line.centerX) * Math.sin(radians) + (y - line.centerY) * Math.cos(radians);
}

/** The pieces of a code line below `typeLine`, merged, or none. */
function codeLinesBelow(typeLine: ITextLine, lines: readonly ITextLine[]): ITextLine[] {
  const pieces = lines.filter((line) => {
    if (line === typeLine || Math.abs(line.degrees - typeLine.degrees) > MAX_ANGLE_DIFFERENCE) return false;
    if (line.charHeight > typeLine.charHeight * MAX_CODE_TO_TYPE_HEIGHT) return false;
    const gap = offsetBelow(typeLine, line.centerX, line.centerY) / line.charHeight;
    return gap >= MIN_TYPE_GAP_IN_HEIGHTS && gap <= MAX_TYPE_GAP_IN_HEIGHTS;
  });
  if (pieces.length === 0) return [];
  const nearest = pieces.reduce((best, next) =>
    offsetBelow(typeLine, next.centerX, next.centerY) < offsetBelow(typeLine, best.centerX, best.centerY) ? next : best,
  );
  const baseline = offsetBelow(typeLine, nearest.centerX, nearest.centerY);
  const sameLine = pieces.filter(
    (line) => Math.abs(offsetBelow(typeLine, line.centerX, line.centerY) - baseline) <= nearest.charHeight * MAX_BASELINE_OFFSET_IN_HEIGHTS,
  );
  return [mergePieces(sameLine)];
}

function mergePieces(pieces: readonly ITextLine[]): ITextLine {
  const count = pieces.reduce((sum, line) => sum + line.charCount, 0);
  const weighted = (pick: (line: ITextLine) => number): number =>
    pieces.reduce((sum, line) => sum + pick(line) * line.charCount, 0) / count;
  return {
    centerX: weighted((line) => line.centerX),
    centerY: weighted((line) => line.centerY),
    left: Math.min(...pieces.map((line) => line.left)),
    right: Math.max(...pieces.map((line) => line.right)),
    charHeight: weighted((line) => line.charHeight),
    degrees: weighted((line) => line.degrees),
    charCount: count,
  };
}

function toCard(typeLine: ITextLine, code: ITextLine): ILocatedCard {
  const gap = offsetBelow(typeLine, code.centerX, code.centerY);
  const fromGap = gap / TYPE_TO_CODE;
  const fromChars = code.charHeight / CODE_CHAR_HEIGHT;
  const height = (fromGap + fromChars) / 2;
  const width = height * CARD_ASPECT;
  const degrees = (typeLine.degrees * typeLine.charCount + code.degrees * code.charCount) / (typeLine.charCount + code.charCount);
  const radians = (degrees * Math.PI) / 180;
  // Anchor on the code line itself, horizontally on the type line, which every set centres on the card.
  const lineX = typeLine.centerX + gap * -Math.sin(radians);
  const lineY = code.centerY + (lineX - code.centerX) * Math.tan(radians);
  const up = (CODE_LINE_CENTER - 0.5) * height;
  const centerX = lineX + up * Math.sin(radians);
  const centerY = lineY - up * Math.cos(radians);
  return {
    guide: { x: centerX - width / 2, y: centerY - height / 2, width, height },
    degrees,
    disagreement: Math.abs(Math.log(fromGap / fromChars)),
    codeCharHeight: code.charHeight,
  };
}

// A code line this close to where the guide expects it is read through the
// guide alone: that crop tolerates about 1.5% of offset.
const SAME_PLACE = 0.012;

/**
 * The crops worth reading for one capture: the guide's, and the card's own
 * when its code line is found away from where the guide expects it. The
 * locator can pick the wrong pair of lines, so the guide's crop is never
 * dropped; the scanner alternates between the two.
 */
export function cardCandidates(card: ICardImage): readonly ICardImage[] {
  const located = locateCard(card);
  if (!located) return [card];
  const guide = card.guide ?? { x: 0, y: 0, width: card.width, height: card.height };
  const offset = Math.abs(codeLineY(located) - (guide.y + guide.height * CODE_LINE_CENTER)) / guide.height;
  return offset <= SAME_PLACE ? [card] : [card, { ...card, guide: located.guide }];
}
