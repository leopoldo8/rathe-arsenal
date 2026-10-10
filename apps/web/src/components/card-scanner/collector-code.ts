import type { ICollectorCodesResponse } from '../../api/collector-codes';

export interface IScannedCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly imageSmall: string | null;
}

export interface IResolvedCode {
  readonly code: string;
  readonly cards: readonly IScannedCard[];
}

export interface ICollectorCodeIndex {
  readonly byCode: ReadonlyMap<string, readonly IScannedCard[]>;
  readonly prefixes: ReadonlySet<string>;
}

const CODE_LENGTH = 6;
const PREFIX_LENGTH = 3;

const DIGIT_LOOKALIKES: Readonly<Record<string, string>> = {
  O: '0', Q: '0', D: '0',
  I: '1', L: '1', T: '1', '|': '1',
  S: '5', Z: '2', B: '8', G: '6',
};

// A T in the digits is read as 1 or as 7; a slice where both codes exist is ambiguous.
const SECOND_DIGIT_READING: Readonly<Record<string, string>> = { T: '7' };

const LETTER_LOOKALIKES: Readonly<Record<string, string>> = {
  '0': 'O', '1': 'I', '5': 'S', '2': 'Z', '8': 'B', '6': 'G',
};

export function buildCollectorCodeIndex(response: ICollectorCodesResponse): ICollectorCodeIndex {
  const byCode = new Map<string, IScannedCard[]>();
  for (const card of response.cards) {
    for (const printing of card.printings) {
      const image = printing.image === undefined ? printing.code : printing.image;
      const scanned: IScannedCard = {
        cardIdentifier: card.cardIdentifier,
        name: card.name,
        pitch: card.pitch,
        imageSmall: image === null ? null : `${response.imageSmallBase}${image}.webp`,
      };
      byCode.set(printing.code, [...(byCode.get(printing.code) ?? []), scanned]);
    }
  }
  const prefixes = new Set([...byCode.keys()].map((code) => code.slice(0, PREFIX_LENGTH)));
  return { byCode, prefixes };
}

export function resolveCollectorCode(text: string, index: ICollectorCodeIndex): IResolvedCode | null {
  for (const code of candidateCodes(text, index)) {
    const cards = index.byCode.get(code);
    if (cards) return { code, cards };
  }
  return null;
}

function candidateCodes(text: string, index: ICollectorCodeIndex): readonly string[] {
  const tokens = text.toUpperCase().replace(/[^A-Z0-9|]/g, ' ').split(/\s+/).filter(Boolean);
  const codes: string[] = [];
  for (const token of tokens) {
    for (let start = 0; start + CODE_LENGTH <= token.length; start += 1) {
      const slice = sliceAt(token, start);
      if (slice !== null) codes.push(...codesForSlice(slice, index));
    }
  }
  return codes;
}

/**
 * A printed code is never followed by another digit. When one follows, the
 * OCR has usually read the first digit twice ("MONO042"), so that copy is dropped.
 */
function sliceAt(token: string, start: number): string | null {
  const end = start + CODE_LENGTH;
  if (!isDigit(token[end])) return token.slice(start, end);
  const firstDigit = start + PREFIX_LENGTH;
  const doubled = mapChars(token[firstDigit]!, DIGIT_LOOKALIKES) === mapChars(token[firstDigit + 1]!, DIGIT_LOOKALIKES);
  if (!doubled || isDigit(token[end + 1])) return null;
  return token.slice(start, firstDigit) + token.slice(firstDigit + 1, end + 1);
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9';
}

function codesForSlice(slice: string, index: ICollectorCodeIndex): readonly string[] {
  const digitReadings = readDigits(slice.slice(PREFIX_LENGTH));
  if (digitReadings.length === 0) return [];
  const prefix = slice.slice(0, PREFIX_LENGTH);
  const prefixVariants = [
    prefix,
    mapChars(prefix, LETTER_LOOKALIKES),
    prefix[0] + mapChars(prefix.slice(1), LETTER_LOOKALIKES),
  ];
  return prefixVariants
    .filter((variant) => index.prefixes.has(variant))
    .flatMap((variant) => {
      const indexed = digitReadings.map((digits) => variant + digits).filter((code) => index.byCode.has(code));
      return indexed.length === 1 ? indexed : [];
    });
}

function readDigits(chars: string): readonly string[] {
  const readings = [...chars].reduce<string[]>((partials, char) => {
    const options = [DIGIT_LOOKALIKES[char] ?? char, ...(SECOND_DIGIT_READING[char] ? [SECOND_DIGIT_READING[char]] : [])];
    return partials.flatMap((partial) => options.map((option) => partial + option));
  }, ['']);
  return readings.filter((digits) => /^\d{3}$/.test(digits));
}

function mapChars(value: string, lookalikes: Readonly<Record<string, string>>): string {
  return [...value].map((char) => lookalikes[char] ?? char).join('');
}
