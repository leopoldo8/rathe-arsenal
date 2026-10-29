import type { TFunction } from 'i18next';
import { MULTIPLIER_MAX, type IListLine, type IListSummary, type TListKind } from '../../api/lists';
import { cardName } from '../../lib/card-name';

export type TTranslate = (key: string, options?: Record<string, unknown>) => string;

/** Adapts i18next's `t` to the plain two-argument shape the pure helpers take. */
export function makeTranslate(t: TFunction): TTranslate {
  return (key, options) => (options === undefined ? t(key) : t(key, options)) as string;
}

const MAX_PRICE_CENTS = 100_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;

export interface IListGroups {
  readonly want: readonly IListSummary[];
  readonly sell: readonly IListSummary[];
}

export function groupListsByKind(lists: readonly IListSummary[]): IListGroups {
  return {
    want: lists.filter((list) => list.kind === 'want'),
    sell: lists.filter((list) => list.kind === 'sell'),
  };
}

const BRL_NUMBER = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "R$ 6,00": built by hand so the space is a plain one, safe to paste into a chat. */
export function formatBrl(cents: number): string {
  return `R$ ${BRL_NUMBER.format(cents / 100)}`;
}

/** "R$ 14": suggestions are whole reais. */
export function formatBrlWhole(cents: number): string {
  return `R$ ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(cents / 100))}`;
}

/** "18/10": the day of the price snapshot. */
export function formatSnapshotDate(fetchedAt: string): string {
  const date = new Date(fetchedAt);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/** Accepts "7", "7,5", "7.5"; empty clears the multiplier. */
export function parseMultiplier(raw: string): { readonly valid: true; readonly value: number | null } | { readonly valid: false } {
  const text = raw.replace(/x/gi, '').replace(/\s/g, '').replace(',', '.');
  if (text === '') return { valid: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { valid: false };
  const value = Number(text);
  return value > 0 && value <= MULTIPLIER_MAX ? { valid: true, value } : { valid: false };
}

/** "5,5" in pt-BR, "5.5" in en-US: the multiplier as the field shows it, with no grouping and at most two decimals. */
export function formatMultiplier(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 2, useGrouping: false }).format(value);
}

/** Value for a money input: "6,50", no symbol. */
export function formatMoneyInput(cents: number | null): string {
  return cents === null ? '' : BRL_NUMBER.format(cents / 100).replace(/\./g, '');
}

export type TMoneyParse =
  | { readonly valid: true; readonly cents: number | null }
  | { readonly valid: false };

/** Accepts "6", "6,5", "6,50", "6.50", "R$ 1.420,50"; empty means no price. */
export function parseMoney(raw: string): TMoneyParse {
  const text = raw.replace(/R\$/gi, '').replace(/\s/g, '');
  if (text === '') return { valid: true, cents: null };
  const normalized = normalizeDecimal(text);
  if (normalized === null) return { valid: false };
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents) || cents < 0 || cents > MAX_PRICE_CENTS) return { valid: false };
  return { valid: true, cents };
}

function normalizeDecimal(text: string): string | null {
  if (text.includes(',')) {
    const [whole = '', fraction = '', ...rest] = text.replace(/\.(?=\d{3}(\D|$))/g, '').split(',');
    if (rest.length > 0 || !/^\d+$/.test(whole) || !/^\d{1,2}$/.test(fraction)) return null;
    return `${whole}.${fraction}`;
  }
  if (/^\d+(\.\d{1,2})?$/.test(text)) return text;
  if (/^\d{1,3}(\.\d{3})+$/.test(text)) return text.replace(/\./g, '');
  return null;
}

export interface IListTotals {
  readonly cards: number;
  readonly sold: number;
  readonly available: number;
}

/** Available cards with a suggestion and no price yet: what "Preencher" writes, matching the API's apply-suggestions with no line ids. */
export function linesToFill(lines: readonly IListLine[]): readonly IListLine[] {
  return lines.filter((line) => !line.sold && line.priceCents === null && line.suggestion !== null);
}

/** What the available cards add up to at their own prices; the suggestion for "Tudo por". */
export function pricedSumCents(lines: readonly IListLine[]): number {
  return lines.reduce((sum, line) => (line.sold || line.priceCents === null ? sum : sum + line.priceCents * line.quantity), 0);
}

export function listTotals(lines: readonly IListLine[]): IListTotals {
  const cards = lines.reduce((sum, line) => sum + line.quantity, 0);
  const sold = lines.filter((line) => line.sold).reduce((sum, line) => sum + line.quantity, 0);
  return { cards, sold, available: cards - sold };
}

export function listMeta(list: IListSummary, t: TTranslate, now: number = Date.now()): string {
  const parts = [t('lists.cardCount', { count: list.copyCount })];
  if (list.kind === 'sell' && list.soldCount > 0) {
    parts.push(t('lists.soldCount', { count: list.soldCount }));
  }
  parts.push(updatedLabel(list.updatedAt, t, now));
  return parts.join(' · ');
}

export function updatedLabel(updatedAt: string, t: TTranslate, now: number = Date.now()): string {
  const days = Math.max(0, Math.floor((now - new Date(updatedAt).getTime()) / DAY_MS));
  if (days === 0) return t('lists.updatedToday');
  if (days === 1) return t('lists.updatedYesterday');
  if (days < DAYS_IN_WEEK) return t('lists.updatedDaysAgo', { count: days });
  if (days < DAYS_IN_MONTH) return t('lists.updatedWeeksAgo', { count: Math.floor(days / DAYS_IN_WEEK) });
  return t('lists.updatedMonthsAgo', { count: Math.floor(days / DAYS_IN_MONTH) });
}

/** What the text builders need of a list: the owner's list and the public shared list both fit. */
export interface ITextList {
  readonly kind: TListKind;
  readonly totalPriceCents: number | null;
  readonly lines: readonly Pick<IListLine, 'quantity' | 'name' | 'pitch' | 'condition' | 'priceCents' | 'sold'>[];
}

type TTextLine = ITextList['lines'][number];

function lineText(line: TTextLine, kind: TListKind, t: TTranslate): string {
  const head = t('lists.text.line', {
    count: line.quantity,
    name: cardName(line.name, line.pitch, (key) => t(key)),
  });
  if (kind === 'want') return head;
  const extras = [
    line.condition,
    line.priceCents === null ? null : t('lists.text.each', { price: formatBrl(line.priceCents) }),
  ].filter((part): part is string => part !== null);
  return [head, ...extras].join(' · ');
}

/** One text line per card still available: sold cards and blank fields are left out. */
export function availableLineTexts(list: ITextList, t: TTranslate): readonly string[] {
  return list.lines.filter((line) => !line.sold).map((line) => lineText(line, list.kind, t));
}

/** The set price of a sell list, or null when it has none. */
export function totalText(list: ITextList, t: TTranslate): string | null {
  if (list.kind !== 'sell' || list.totalPriceCents === null) return null;
  return t('lists.text.total', { price: formatBrl(list.totalPriceCents) });
}

/**
 * The list as plain text for a chat: sold cards left out, blank fields left
 * out, the total last. With an address, the pasted text leads back to the page.
 */
export function buildListText(list: ITextList, t: TTranslate, url: string | null = null): string {
  const total = totalText(list, t);
  const body = total === null ? availableLineTexts(list, t) : [...availableLineTexts(list, t), '', total];
  return (url === null ? body : [...body, '', url]).join('\n');
}

export function defaultListName(
  kind: TListKind,
  deckName: string | null,
  t: TTranslate,
): string {
  if (deckName === null) return '';
  return kind === 'want' ? t('lists.create.defaultWantName', { deck: deckName }) : deckName;
}
