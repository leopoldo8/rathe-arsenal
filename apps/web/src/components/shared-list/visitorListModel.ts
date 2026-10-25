import type { TFunction } from 'i18next';
import type { ISharedListLine, ISharedListMatches, ISharedListResponse } from '../../api/shared-lists';
import type { TEdition, TFinish } from '../../api/collection-versions';
import { cardName } from '../../lib/card-name';
import { editionLabel, finishLabel } from '../collection-versions/copy-version-labels';
import { formatReais } from '../spare/sellMessage';

const CENTS_PER_REAL = 100;

/** "45" or "12,50": reais as a message reads them, with no "R$" in front. */
export function reaisOf(cents: number): string {
  return formatReais(cents / CENTS_PER_REAL);
}

export interface IVersionInput {
  readonly printingCode?: string | undefined;
  readonly edition?: string | undefined;
  readonly finish?: string | undefined;
  readonly setName?: string | null | undefined;
  readonly condition?: string | null | undefined;
}

/** The parts of a version a card row names, in the order a seller writes them: set, edition, finish, condition. */
export function versionParts(version: IVersionInput, t: TFunction): string[] {
  const finish = version.finish ?? '';
  return [
    version.setName ?? version.printingCode ?? '',
    version.edition ? editionLabel(version.edition as TEdition, t) : '',
    finish === 'none' ? t('spare.messageNoFoil') : finish ? finishLabel(finish as TFinish, t) : '',
    version.condition ?? '',
  ].filter((part) => part !== '');
}

export type TSelection = Readonly<Record<number, number>>;

export function setCount(selection: TSelection, lineId: number, count: number): TSelection {
  const { [lineId]: _dropped, ...rest } = selection;
  return count > 0 ? { ...rest, [lineId]: count } : rest;
}

export interface IBuyerRow {
  readonly line: ISharedListLine;
  /** The visitor's deck that misses the card most, with that deck's own count; null when none misses it. */
  readonly hint: { readonly deck: string; readonly missing: number } | null;
}

/** The lines still for sale, each with the deck that misses its card most. */
export function buyerRows(list: ISharedListResponse, matches: ISharedListMatches | undefined): IBuyerRow[] {
  const decksOf = new Map((matches?.lines ?? []).map((match) => [match.lineId, match.decks ?? []]));
  return list.lines
    .filter((line) => !line.sold)
    .map((line) => {
      const [top] = [...(decksOf.get(line.id) ?? [])].sort((a, b) => b.missing - a.missing);
      return { line, hint: top === undefined ? null : { deck: top.deckName, missing: top.missing } };
    });
}

export function chosenTotal(rows: readonly IBuyerRow[], selection: TSelection): { readonly copies: number; readonly cents: number; readonly priced: boolean } {
  let copies = 0;
  let cents = 0;
  let priced = false;
  for (const { line } of rows) {
    const count = selection[line.id] ?? 0;
    copies += count;
    if (count > 0 && line.priceCents !== null) {
      cents += count * line.priceCents;
      priced = true;
    }
  }
  return { copies, cents, priced };
}

function buyLine(line: ISharedListLine, count: number, t: TFunction): string {
  const price =
    line.priceCents === null ? '' : t(count > 1 ? 'sharing.buyer.priceEach' : 'sharing.buyer.priceOne', { price: reaisOf(line.priceCents) });
  const head = t('spare.messageLine', { count, name: cardName(line.name, line.pitch, (key) => t(key)) });
  return [head, ...hasVersion(line) ? versionParts(line, t) : labelOnly(line), price].filter((part) => part !== '').join(' · ');
}

function hasVersion(line: ISharedListLine): boolean {
  return (line.printingCode ?? '') !== '' || (line.edition ?? '') !== '' || (line.finish ?? '') !== '';
}

/** A line with no version fields (an answer that predates them) still shows the label it came with, and its condition. */
function labelOnly(line: ISharedListLine): string[] {
  return [line.printingLabel ?? '', line.condition ?? ''].filter((part) => part !== '');
}

/** The row's second line: its version, its condition and its price, "History Pack 1 · NM · R$ 45". */
export function buyerDetail(line: ISharedListLine, t: TFunction): string {
  const price =
    line.priceCents === null ? '' : t(line.quantity > 1 ? 'sharing.buyer.priceEach' : 'sharing.buyer.priceOne', { price: reaisOf(line.priceCents) });
  const parts = hasVersion(line) ? [...versionParts({ ...line, condition: null }, t), line.condition ?? ''] : labelOnly(line);
  return [...parts, price].filter((part) => part !== '').join(' · ');
}

export function buildBuyMessage(
  sharerName: string,
  rows: readonly IBuyerRow[],
  selection: TSelection,
  t: TFunction,
): string {
  const chosen = rows.filter(({ line }) => (selection[line.id] ?? 0) > 0);
  const lines = chosen.map(({ line }) => buyLine(line, selection[line.id] ?? 0, t)).join(', ');
  const { cents, priced } = chosenTotal(rows, selection);
  return priced
    ? t('sharing.buyer.messageWithTotal', { name: sharerName, lines, total: reaisOf(cents) })
    : t('sharing.buyer.messageNoTotal', { name: sharerName, lines });
}

export interface ITradeRow {
  readonly line: ISharedListLine;
  /** Copies the visitor can offer for this line: the spare ones, no more than the sharer looks for. */
  readonly offerable: number;
}

export interface ITradeRows {
  /** Lines with something spare: they get a stepper. */
  readonly spare: readonly ITradeRow[];
  /** Lines the visitor owns, with nothing spare. */
  readonly none: readonly ISharedListLine[];
  /** Lines the visitor has no copy of. */
  readonly lacking: readonly ISharedListLine[];
}

export function tradeRows(list: ISharedListResponse): ITradeRows {
  const spare: ITradeRow[] = [];
  const none: ISharedListLine[] = [];
  const lacking: ISharedListLine[] = [];
  for (const line of list.lines) {
    const copies = line.spare ?? 0;
    if (copies > 0) spare.push({ line, offerable: Math.min(copies, line.quantity) });
    else if ((line.owned ?? 0) > 0) none.push(line);
    else lacking.push(line);
  }
  return { spare, none, lacking };
}

export function offerCopies(rows: readonly ITradeRow[]): { readonly copies: number; readonly cards: number } {
  return { copies: rows.reduce((sum, row) => sum + row.offerable, 0), cards: rows.length };
}

export function offerCents(rows: readonly ITradeRow[], selection: TSelection): number {
  return rows.reduce((sum, { line }) => sum + (selection[line.id] ?? 0) * (line.suggestedCents ?? 0), 0);
}

export function wantCents(list: ISharedListResponse): number {
  return (list.visitorList?.lines ?? []).reduce((sum, line) => sum + line.quantity * (line.suggestedCents ?? 0), 0);
}

export function wantCopies(list: ISharedListResponse): number {
  return (list.visitorList?.lines ?? []).reduce((sum, line) => sum + line.quantity, 0);
}

function offerLine(row: ITradeRow, count: number, t: TFunction): string {
  const head = t('spare.messageLine', { count, name: cardName(row.line.name, row.line.pitch, (key) => t(key)) });
  const version = row.line.spareVersion === null || row.line.spareVersion === undefined ? [] : versionParts(row.line.spareVersion, t);
  return [head, ...version].join(' · ');
}

export function buildOfferMessage(
  list: ISharedListResponse,
  rows: readonly ITradeRow[],
  selection: TSelection,
  includeMine: boolean,
  t: TFunction,
): string {
  const offered = rows
    .filter(({ line }) => (selection[line.id] ?? 0) > 0)
    .map((row) => offerLine(row, selection[row.line.id] ?? 0, t))
    .join(', ');
  const own = list.visitorList;
  if (!includeMine || own === null || own === undefined) {
    return t('sharing.trade.offerOnly', { name: list.sharerName, offered });
  }
  const wanted = own.lines
    .map((line) => t('spare.messageLine', { count: line.quantity, name: cardName(line.name, line.pitch, (key) => t(key)) }))
    .join(', ');
  return t('sharing.trade.offerWithMine', { name: list.sharerName, offered, wanted, link: own.url });
}
