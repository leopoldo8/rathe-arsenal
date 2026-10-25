import { IRawPrinting } from '../../catalog/card-version-options';
import { ICopyVersion } from '../versions/copy-version';
import { TPitch } from './pitch-token';

export const MAX_LINE_QUANTITY = 20;

export type TLineOutcome = 'ready' | 'asks_color' | 'suggestion' | 'not_found' | 'bad_quantity';

export interface ICardImage {
  readonly small: string;
  readonly large: string;
}

export interface ICardFacts {
  readonly name: string;
  readonly pitch: number | null;
  readonly imageUrl: ICardImage | null;
}

/** What the reader needs from the catalog; the real one is built from `CatalogService`. */
export interface ICardLookup {
  /** Card identifiers sharing a name, by the normalized (lowercase, single-spaced) name. */
  idsByName(normalizedName: string): readonly string[];
  distinctNames(): readonly string[];
  card(cardIdentifier: string): ICardFacts;
  printings(cardIdentifier: string): readonly IRawPrinting[];
  matchesSet(cardIdentifier: string, set: string): boolean;
}

/** One line of a paste, or one row of a table, before it meets the catalog. */
export interface IRawLine {
  readonly lineNumber: number;
  readonly originalText: string;
  /** The whole pasted line, or the name cell of a table row. */
  readonly text: string;
  /** True for a table row: the quantity then comes from `quantityCell`, never from the text. */
  readonly isTable?: boolean;
  /** Cells of the columns the file has; undefined when the file has no such column. */
  readonly quantityCell?: string | undefined;
  readonly colorCell?: string | undefined;
  readonly versionCell?: string | undefined;
  readonly conditionCell?: string | undefined;
  readonly setCell?: string | undefined;
  readonly notes?: readonly string[];
}

export type TColorOption =
  | { readonly kind: 'pitch'; readonly pitch: TPitch; readonly cardIdentifier: string }
  | { readonly kind: 'unknown' };

export interface ILineSuggestion {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly imageUrl: ICardImage | null;
}

export interface IReadLine {
  readonly lineNumber: number;
  readonly originalText: string;
  readonly outcome: TLineOutcome;
  readonly cardIdentifier: string | null;
  readonly name: string | null;
  readonly pitch: number | null;
  readonly imageUrl: ICardImage | null;
  /** Null when the quantity cell is not a number: the line then is `bad_quantity` or waits behind its card. */
  readonly quantity: number | null;
  readonly quantityRaw: string | null;
  readonly suggestedQuantity: number | null;
  readonly options: readonly TColorOption[] | null;
  readonly suggestion: ILineSuggestion | null;
  readonly version: ICopyVersion;
  /** Set when pasted version words left several printings: the player picks. */
  readonly versionNote: string | null;
  readonly notes: readonly string[];
}

export interface ILinesSummary {
  readonly read: number;
  readonly ready: number;
  readonly asked: number;
  readonly kept: number;
}
