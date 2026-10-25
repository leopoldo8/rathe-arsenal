import { NO_VERSION } from '../versions/copy-version';
import {
  ICardLookup,
  ILinesSummary,
  ILineSuggestion,
  IRawLine,
  IReadLine,
  MAX_LINE_QUANTITY,
  TColorOption,
} from './line-reader.types';
import { IPitchRead, PITCH_WORDS, readPitchToken, TPitch } from './pitch-token';
import { quantityFromWord } from './quantity-words';
import {
  IVersionWords,
  NO_VERSION_WORDS,
  readVersionWords,
  resolveVersion,
  VERSION_WORD_PATTERN,
} from './version-words';

const PITCH_PAREN = new RegExp(`\\s*\\(\\s*(${[...PITCH_WORDS, '1', '2', '3'].join('|')})\\s*\\)\\s*$`, 'i');
const PITCH_BARE = /\s+(red|yellow|blue|vermelho|amarelo|azul)\s*$/i;
const VERSION_BARE = new RegExp(`\\s+(${VERSION_WORD_PATTERN})\\s*$`, 'i');
const VERSION_ANYWHERE = new RegExp(`(?<![\\p{L}\\d])(${VERSION_WORD_PATTERN})(?![\\p{L}\\d])`, 'giu');
const LEADING_QUANTITY = /^(\d{1,4})\s*[x×]\s*(\S.*)$|^(\d{1,4})\s+(\S.*)$/i;
const TRAILING_QUANTITY = /^(.+?)\s*[x×]\s*(\d{1,4})$/i;
const MIN_TYPO_LENGTH = 4;

export function normalizeName(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

interface IDecomposition {
  readonly base: string;
  readonly pitch: IPitchRead | null;
  readonly words: readonly string[];
}

/** The text with trailing pitch and version words peeled off one by one, most peeled first. */
function decompose(text: string): IDecomposition[] {
  const levels: IDecomposition[] = [{ base: text.trim(), pitch: null, words: [] }];
  for (;;) {
    const current = levels[levels.length - 1]!;
    const next = peel(current);
    if (next === null || next.base.length === 0) break;
    levels.push(next);
  }
  return levels.reverse();
}

function peel(current: IDecomposition): IDecomposition | null {
  if (current.pitch === null) {
    const paren = PITCH_PAREN.exec(current.base);
    const bare = paren === null ? PITCH_BARE.exec(current.base) : null;
    const match = paren ?? bare;
    const pitch = match === null ? null : readPitchToken(match[0]);
    if (match !== null && pitch !== null) {
      return { base: current.base.slice(0, match.index).trim(), pitch, words: current.words };
    }
  }
  const version = VERSION_BARE.exec(current.base);
  if (version !== null) {
    return {
      base: current.base.slice(0, version.index).trim(),
      pitch: current.pitch,
      words: [version[1]!, ...current.words],
    };
  }
  return null;
}

interface IQuantityRead {
  readonly quantity: number | null;
  readonly raw: string | null;
  readonly suggested: number | null;
  readonly note: string | null;
}

function capQuantity(value: number): IQuantityRead {
  if (value > MAX_LINE_QUANTITY) {
    return { quantity: MAX_LINE_QUANTITY, raw: null, suggested: null, note: `quantidade acima de ${MAX_LINE_QUANTITY}: lemos ${MAX_LINE_QUANTITY}` };
  }
  return { quantity: value, raw: null, suggested: null, note: null };
}

function readQuantityCell(cell: string): IQuantityRead {
  const written = cell.trim();
  if (/^\d+$/.test(written)) {
    const value = Number(written);
    if (value >= 1) return capQuantity(value);
  }
  return { quantity: null, raw: written, suggested: quantityFromWord(written), note: null };
}

interface IQuantityVariant {
  readonly quantity: number | null;
  readonly rest: string;
}

/** Ways to split a pasted line into a quantity and a card text, tried against the catalog in order. */
function quantityVariants(text: string): IQuantityVariant[] {
  const variants: IQuantityVariant[] = [];
  const leading = LEADING_QUANTITY.exec(text);
  if (leading !== null) variants.push({ quantity: Number(leading[1] ?? leading[3]), rest: (leading[2] ?? leading[4])! });
  const trailing = TRAILING_QUANTITY.exec(text);
  if (trailing !== null) variants.push({ quantity: Number(trailing[2]), rest: trailing[1]! });
  variants.push({ quantity: null, rest: text });
  return variants;
}

function isOneEdit(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  if (a.length === b.length) return a.slice(start + 1) === b.slice(start + 1);
  return a.length > b.length ? a.slice(start + 1) === b.slice(start) : b.slice(start + 1) === a.slice(start);
}

type TResolution =
  | { readonly kind: 'one'; readonly cardIdentifier: string }
  | { readonly kind: 'colors'; readonly cardIdentifiers: readonly string[] }
  | { readonly kind: 'none' };

/** Reads pasted lines and table rows against the catalog: every line ends as one of five outcomes. */
export class LineReader {
  private cachedNames: readonly string[] | null = null;

  constructor(private readonly lookup: ICardLookup) {}

  read(raw: IRawLine): IReadLine {
    const notes = [...(raw.notes ?? [])];
    const located = this.locate(raw);
    const { decomposition, quantity } = located;
    if (quantity.note !== null) notes.push(quantity.note);
    const pitchRead = decomposition.pitch ?? this.readColorCell(raw.colorCell);
    if (pitchRead?.note !== undefined) notes.push(pitchRead.note);
    const base = {
      lineNumber: raw.lineNumber,
      originalText: raw.originalText,
      quantity: quantity.quantity,
      quantityRaw: quantity.raw,
      suggestedQuantity: quantity.suggested,
      notes,
    };
    return this.finish(raw, base, located.resolution, located.exact, decomposition, pitchRead);
  }

  private variantsOf(raw: IRawLine): readonly IQuantityVariant[] {
    return raw.isTable === true ? [{ quantity: null, rest: raw.text }] : quantityVariants(raw.text.trim());
  }

  private quantityOf(raw: IRawLine, variant: IQuantityVariant): IQuantityRead {
    if (raw.isTable === true) {
      return raw.quantityCell === undefined ? capQuantity(1) : readQuantityCell(raw.quantityCell);
    }
    if (variant.quantity === null) return capQuantity(1);
    return variant.quantity < 1
      ? { quantity: null, raw: String(variant.quantity), suggested: null, note: null }
      : capQuantity(variant.quantity);
  }

  private locate(raw: IRawLine): {
    resolution: TResolution;
    exact: boolean;
    decomposition: IDecomposition;
    quantity: IQuantityRead;
  } {
    const colorPitch = this.readColorCell(raw.colorCell);
    const variants = this.variantsOf(raw);
    for (const variant of variants) {
      for (const level of decompose(variant.rest)) {
        const resolution = this.resolve(level, colorPitch, raw.setCell);
        if (resolution.kind !== 'none') {
          return { resolution, exact: true, decomposition: level, quantity: this.quantityOf(raw, variant) };
        }
      }
    }
    const variant = variants[0]!;
    return {
      resolution: { kind: 'none' },
      exact: false,
      decomposition: decompose(variant.rest)[0]!,
      quantity: this.quantityOf(raw, variant),
    };
  }

  /** True when the text, with its trailing pitch and version words peeled, is exactly a card name. */
  knowsName(text: string): boolean {
    return decompose(text).some((level) => this.lookup.idsByName(normalizeName(level.base)).length > 0);
  }

  private readColorCell(cell: string | undefined): IPitchRead | null {
    if (cell === undefined || cell.trim() === '') return null;
    return readPitchToken(cell);
  }

  private resolve(level: IDecomposition, colorPitch: IPitchRead | null, setCell: string | undefined): TResolution {
    const ids = this.lookup.idsByName(normalizeName(level.base));
    if (ids.length === 0) return { kind: 'none' };
    const pitch = (level.pitch ?? colorPitch)?.pitch ?? null;
    return this.pick(ids, pitch, setCell);
  }

  private pick(ids: readonly string[], pitch: TPitch | null, setCell: string | undefined): TResolution {
    const narrowedByPitch = pitch === null ? ids : ids.filter((id) => this.lookup.card(id).pitch === pitch);
    if (narrowedByPitch.length === 0) return { kind: 'none' };
    if (narrowedByPitch.length === 1) return { kind: 'one', cardIdentifier: narrowedByPitch[0]! };
    if (setCell !== undefined && setCell.trim() !== '') {
      const bySet = narrowedByPitch.filter((id) => this.lookup.matchesSet(id, setCell));
      if (bySet.length === 1) return { kind: 'one', cardIdentifier: bySet[0]! };
    }
    const pitches = new Set(narrowedByPitch.map((id) => this.lookup.card(id).pitch).filter((value) => value !== null));
    return pitches.size >= 2 ? { kind: 'colors', cardIdentifiers: narrowedByPitch } : { kind: 'none' };
  }

  private finish(
    raw: IRawLine,
    base: Pick<IReadLine, 'lineNumber' | 'originalText' | 'quantity' | 'quantityRaw' | 'suggestedQuantity' | 'notes'>,
    resolution: TResolution,
    exact: boolean,
    decomposition: IDecomposition,
    pitchRead: IPitchRead | null,
  ): IReadLine {
    const empty = {
      cardIdentifier: null,
      name: null,
      pitch: null,
      imageUrl: null,
      options: null,
      suggestion: null,
      version: NO_VERSION,
      versionNote: null,
    };
    if (resolution.kind === 'colors') {
      return { ...base, ...empty, outcome: 'asks_color', name: this.lookup.card(resolution.cardIdentifiers[0]!).name, options: this.colorOptions(resolution.cardIdentifiers) };
    }
    if (resolution.kind === 'one' && exact) {
      const { quantity, quantityRaw } = base;
      const facts = this.lookup.card(resolution.cardIdentifier);
      const words = this.versionWordsOf(raw, decomposition);
      const resolved = resolveVersion(this.lookup.printings(resolution.cardIdentifier), words);
      return {
        ...base,
        ...empty,
        outcome: quantity === null && quantityRaw !== null ? 'bad_quantity' : 'ready',
        cardIdentifier: resolution.cardIdentifier,
        name: facts.name,
        pitch: facts.pitch,
        imageUrl: facts.imageUrl,
        version: resolved.version,
        versionNote: resolved.note,
      };
    }
    const suggestion = this.suggest(decomposition, pitchRead, raw.setCell);
    if (suggestion !== null) return { ...base, ...empty, outcome: 'suggestion', suggestion };
    return { ...base, ...empty, outcome: 'not_found' };
  }

  private colorOptions(cardIdentifiers: readonly string[]): TColorOption[] {
    const options: TColorOption[] = [];
    for (const pitch of [1, 2, 3] as const) {
      const id = cardIdentifiers.find((candidate) => this.lookup.card(candidate).pitch === pitch);
      if (id !== undefined) options.push({ kind: 'pitch', pitch, cardIdentifier: id });
    }
    return [...options, { kind: 'unknown' }];
  }

  private versionWordsOf(raw: IRawLine, decomposition: IDecomposition): IVersionWords {
    const cells = [raw.versionCell, raw.conditionCell].filter((cell): cell is string => cell !== undefined);
    const fromCells = cells.flatMap((cell) => [...cell.matchAll(VERSION_ANYWHERE)].map((match) => match[1]!));
    const words = [...decomposition.words, ...fromCells];
    return words.length === 0 ? NO_VERSION_WORDS : readVersionWords(words);
  }

  private suggest(decomposition: IDecomposition, pitchRead: IPitchRead | null, setCell: string | undefined): ILineSuggestion | null {
    const text = normalizeName(decomposition.base);
    if (text.length < MIN_TYPO_LENGTH) return null;
    const near = this.names().filter((name) => isOneEdit(text, name));
    if (near.length !== 1) return null;
    const resolution = this.pick(this.lookup.idsByName(near[0]!), pitchRead?.pitch ?? null, setCell);
    if (resolution.kind !== 'one') return null;
    const facts = this.lookup.card(resolution.cardIdentifier);
    return { cardIdentifier: resolution.cardIdentifier, name: facts.name, pitch: facts.pitch, imageUrl: facts.imageUrl };
  }

  private names(): readonly string[] {
    this.cachedNames ??= this.lookup.distinctNames();
    return this.cachedNames;
  }
}

/**
 * The three counts the screens show. A suggestion the player accepted counts as ready;
 * every other line is asked about (a color, a near name or a quantity) or kept.
 */
export function summarizeLines(lines: readonly IReadLine[], acceptedLineNumbers: readonly number[] = []): ILinesSummary {
  let ready = 0;
  let asked = 0;
  let kept = 0;
  for (const line of lines) {
    const accepted = line.outcome === 'suggestion' && line.quantity !== null && acceptedLineNumbers.includes(line.lineNumber);
    if (line.outcome === 'ready' || accepted) ready += 1;
    else if (line.outcome === 'not_found') kept += 1;
    else asked += 1;
  }
  return { read: lines.length, ready, asked, kept };
}
