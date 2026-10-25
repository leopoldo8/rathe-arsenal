import { editionOf, finishOf, IRawPrinting } from '../../catalog/card-version-options';
import { CONDITIONS, ICopyVersion, NO_VERSION, TEdition, TFinish } from '../versions/copy-version';

/** What pasted words say about a copy's version, before they meet the card's printings. */
export interface IVersionWords {
  readonly anyFoil: boolean;
  readonly finish: TFinish | null;
  readonly edition: TEdition | null;
  readonly condition: ICopyVersion['condition'];
  readonly written: readonly string[];
}

export const NO_VERSION_WORDS: IVersionWords = {
  anyFoil: false,
  finish: null,
  edition: null,
  condition: '',
  written: [],
};

interface IWordMeaning {
  readonly anyFoil?: boolean;
  readonly finish?: TFinish;
  readonly edition?: TEdition;
  readonly condition?: ICopyVersion['condition'];
}

const MEANING_BY_WORD: Readonly<Record<string, IWordMeaning>> = {
  foil: { anyFoil: true },
  'rainbow foil': { finish: 'rainbow' },
  'cold foil': { finish: 'cold' },
  'gold foil': { finish: 'gold' },
  'sem foil': { finish: 'none' },
  '1ª': { edition: 'first' },
  '1a': { edition: 'first' },
  '1st': { edition: 'first' },
  first: { edition: 'first' },
  alpha: { edition: 'alpha' },
  unlimited: { edition: 'unlimited' },
  ...Object.fromEntries(CONDITIONS.map((condition) => [condition.toLowerCase(), { condition }])),
};

/** The longest words first, so "cold foil" is read before "foil". */
export const VERSION_WORD_PATTERN = Object.keys(MEANING_BY_WORD)
  .sort((a, b) => b.length - a.length)
  .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

/** Reads version words ("foil", "NM", "1ª"); a word that means nothing here is not in the result. */
export function readVersionWords(words: readonly string[]): IVersionWords {
  let result = NO_VERSION_WORDS;
  for (const word of words) {
    const meaning = MEANING_BY_WORD[word.trim().toLowerCase()];
    if (meaning === undefined) continue;
    result = {
      anyFoil: result.anyFoil || meaning.anyFoil === true,
      finish: meaning.finish ?? result.finish,
      edition: meaning.edition ?? result.edition,
      condition: meaning.condition ?? result.condition,
      written: [...result.written, word.trim()],
    };
  }
  return result;
}

export interface IResolvedVersion {
  readonly version: ICopyVersion;
  /** Set when the words left more than one printing: the player chooses. */
  readonly note: string | null;
}

interface IPrintingCandidate {
  readonly printingCode: string;
  readonly edition: '' | TEdition;
  readonly finish: '' | TFinish;
}

function candidatesOf(printings: readonly IRawPrinting[], words: IVersionWords): IPrintingCandidate[] {
  const found = new Map<string, IPrintingCandidate>();
  for (const row of printings) {
    if (!row.identifier) continue;
    const edition = editionOf(row) ?? '';
    const finish = finishOf(row) ?? '';
    if (words.edition !== null && edition !== words.edition) continue;
    if (words.finish !== null && finish !== words.finish) continue;
    if (words.anyFoil && (finish === '' || finish === 'none')) continue;
    found.set(`${row.identifier}|${edition}|${finish}`, { printingCode: row.identifier, edition, finish });
  }
  return [...found.values()];
}

function commonPart<T extends string>(values: readonly T[]): T | '' {
  const first = values[0];
  return first !== undefined && values.every((value) => value === first) ? first : '';
}

/**
 * Meets the pasted words with the card's printings. One printing left: its version is recorded.
 * Several left: only what every one of them agrees on is recorded, and a foil question stays a note.
 */
export function resolveVersion(printings: readonly IRawPrinting[], words: IVersionWords): IResolvedVersion {
  const named = words.anyFoil || words.finish !== null || words.edition !== null;
  const base: ICopyVersion = { ...NO_VERSION, condition: words.condition };
  if (!named) return { version: base, note: null };

  const candidates = candidatesOf(printings, words);
  if (candidates.length === 0) {
    return { version: base, note: `${words.written.join(' ')} · essa carta não tem essa versão` };
  }
  const only = candidates.length === 1 ? candidates[0] : undefined;
  if (only !== undefined) {
    return { version: { ...base, printingCode: only.printingCode, edition: only.edition, finish: only.finish }, note: null };
  }
  const edition = commonPart(candidates.map((candidate) => candidate.edition));
  const finish = commonPart(candidates.map((candidate) => candidate.finish));
  const version: ICopyVersion = { ...base, edition, finish };
  const stillAsks = words.anyFoil && finish === '';
  return {
    version,
    note: stillAsks
      ? `${words.written.join(' ')} · existe em ${candidates.length} versões foil: escolha`
      : null,
  };
}
