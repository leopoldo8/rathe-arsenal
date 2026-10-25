import type {
  ICreateImportBody,
  ILineSuggestion,
  IPendingLineBody,
  IReadLine,
  IReadyLineBody,
  TColorOption,
} from '../../api/collection-imports';
import type { ICopyVersion } from '../../api/collection-versions';

/** One line of a paste or file together with what the player answered about it so far. */
export interface IReaderItem {
  readonly line: IReadLine;
  /** The card the player settled on: an accepted near name or a chosen color. */
  readonly settled: ILineSuggestion | null;
  /** The player tapped "Não sei" for the color: the line stays for later. */
  readonly declined: boolean;
  readonly quantity: number | null;
}

export type TItemGroup = 'color' | 'similar' | 'quantity' | 'notFound';

export interface IItemCounts {
  readonly read: number;
  readonly ready: number;
  readonly needsColor: number;
  readonly similar: number;
  readonly quantity: number;
  readonly notFound: number;
}

export function toItem(line: IReadLine): IReaderItem {
  return { line, settled: null, declined: false, quantity: line.quantity };
}

export function toItems(lines: readonly IReadLine[]): IReaderItem[] {
  return lines.map(toItem);
}

/** The card a line stands for, once it is known: read as is, or settled by the player. */
export function cardOf(item: IReaderItem): ILineSuggestion | null {
  if (item.settled !== null) return item.settled;
  const { line } = item;
  if (line.cardIdentifier === null || line.name === null) return null;
  return { cardIdentifier: line.cardIdentifier, name: line.name, pitch: line.pitch, imageUrl: line.imageUrl };
}

export function isReady(item: IReaderItem): boolean {
  return cardOf(item) !== null && item.quantity !== null && !item.declined;
}

/** Which kind of answer the line still waits for, or null when it is ready. */
export function groupOf(item: IReaderItem): TItemGroup | null {
  if (isReady(item)) return null;
  if (cardOf(item) !== null && !item.declined) return 'quantity';
  switch (item.line.outcome) {
    case 'asks_color':
      return 'color';
    case 'suggestion':
      return 'similar';
    case 'bad_quantity':
      return 'quantity';
    default:
      return 'notFound';
  }
}

export function countItems(items: readonly IReaderItem[]): IItemCounts {
  const groups = items.map(groupOf);
  const count = (group: TItemGroup | null): number => groups.filter((candidate) => candidate === group).length;
  return {
    read: items.length,
    ready: count(null),
    needsColor: count('color'),
    similar: count('similar'),
    quantity: count('quantity'),
    notFound: count('notFound'),
  };
}

export function readyItems(items: readonly IReaderItem[]): IReaderItem[] {
  return items.filter(isReady);
}

export function readyCopies(items: readonly IReaderItem[]): number {
  return readyItems(items).reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}

export function readyCards(items: readonly IReaderItem[]): number {
  return new Set(readyItems(items).map((item) => cardOf(item)?.cardIdentifier)).size;
}

function updateItem(
  items: readonly IReaderItem[],
  lineNumber: number,
  change: (item: IReaderItem) => IReaderItem,
): IReaderItem[] {
  return items.map((item) => (item.line.lineNumber === lineNumber ? change(item) : item));
}

export function acceptSuggestion(items: readonly IReaderItem[], lineNumber: number): IReaderItem[] {
  return updateItem(items, lineNumber, (item) => ({ ...item, settled: item.line.suggestion }));
}

export function undoSettled(items: readonly IReaderItem[], lineNumber: number): IReaderItem[] {
  return updateItem(items, lineNumber, (item) => ({ ...item, settled: null, declined: false }));
}

export function pickColor(items: readonly IReaderItem[], lineNumber: number, option: TColorOption): IReaderItem[] {
  return updateItem(items, lineNumber, (item) => {
    if (option.kind === 'unknown') return { ...item, settled: null, declined: true };
    return {
      ...item,
      declined: false,
      settled: {
        cardIdentifier: option.cardIdentifier,
        name: item.line.name ?? '',
        pitch: option.pitch,
        imageUrl: null,
      },
    };
  });
}

export function setQuantity(items: readonly IReaderItem[], lineNumber: number, quantity: number | null): IReaderItem[] {
  return updateItem(items, lineNumber, (item) => ({ ...item, quantity }));
}

/** A line read again from the text the player corrected keeps its place and the text it was pasted with. */
export function replaceLine(items: readonly IReaderItem[], lineNumber: number, line: IReadLine): IReaderItem[] {
  return updateItem(items, lineNumber, (item) =>
    toItem({ ...line, lineNumber, originalText: item.line.originalText }),
  );
}

function ownVersion(item: IReaderItem): Partial<ICopyVersion> {
  if (item.settled !== null) return {};
  const { printingCode, edition, finish, condition } = item.line.version;
  return {
    ...(printingCode ? { printingCode } : {}),
    ...(edition ? { edition } : {}),
    ...(finish ? { finish } : {}),
    ...(condition ? { condition } : {}),
  };
}

function toReadyBody(item: IReaderItem): IReadyLineBody {
  return { cardIdentifier: cardOf(item)!.cardIdentifier, quantity: item.quantity!, ...ownVersion(item) };
}

function toPendingBody(item: IReaderItem): IPendingLineBody {
  const { line } = item;
  const base = { lineNumber: line.lineNumber, originalText: line.originalText };
  const settled = cardOf(item);
  if (settled !== null) return { ...base, reason: 'bad_quantity', suggestedCardIdentifier: settled.cardIdentifier };
  switch (line.outcome) {
    case 'asks_color': {
      const first = line.options?.find((option) => option.kind === 'pitch');
      return first?.kind === 'pitch'
        ? { ...base, reason: 'asks_color', suggestedCardIdentifier: first.cardIdentifier }
        : { ...base, reason: 'asks_color' };
    }
    case 'suggestion':
      return line.suggestion === null
        ? { ...base, reason: 'suggestion' }
        : { ...base, reason: 'suggestion', suggestedCardIdentifier: line.suggestion.cardIdentifier };
    default:
      return { ...base, reason: 'not_found' };
  }
}

export interface IImportBodyOptions {
  readonly kind: 'csv' | 'paste';
  readonly name: string;
  readonly defaultVersion?: Partial<ICopyVersion>;
  readonly fileName?: string;
  readonly duplicateStrategy?: 'separate';
}

/** Every line goes out once: ready ones as copies, the others kept "Para resolver" with their text. */
export function buildImportBody(items: readonly IReaderItem[], options: IImportBodyOptions): ICreateImportBody {
  return {
    ...options,
    ready: items.filter(isReady).map(toReadyBody),
    pending: items.filter((item) => !isReady(item)).map(toPendingBody),
  };
}
