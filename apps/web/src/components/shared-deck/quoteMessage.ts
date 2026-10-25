import type { TFunction } from 'i18next';
import type { ISharedQuoteItem } from '../../api/shared-decks';
import { cardName, pitchWord } from '../../lib/card-name';
import { formatBrl } from '../../utils/format-brl';
import type { TQuoteDraft } from './quoteDraft';

/** Reads a price typed in reais ("120,00", "8", "1.200,00") as cents; null for anything that is not a price. */
export function parseReais(text: string): number | null {
  const typed = text.trim();
  if (typed === '' || !/^\d[\d.]*(,\d{1,2})?$/.test(typed)) return null;
  const reais = Number.parseFloat((typed.includes(',') ? typed.replace(/\./g, '').replace(',', '.') : typed.replace(/\./g, '')));
  return Number.isFinite(reais) ? Math.round(reais * 100) : null;
}

export interface IQuoteTotals {
  /** Copies the store marked. */
  readonly have: number;
  /** Copies asked for. */
  readonly needed: number;
  /** Total of the rows that carry a price. */
  readonly cents: number;
}

export function quoteTotals(needed: readonly ISharedQuoteItem[], draft: TQuoteDraft): IQuoteTotals {
  let have = 0;
  let cents = 0;
  for (const item of needed) {
    const row = draft[item.cardIdentifier];
    if (row === undefined || row.have <= 0) continue;
    have += row.have;
    const unit = parseReais(row.price);
    if (unit !== null) cents += row.have * unit;
  }
  return { have, needed: needed.reduce((sum, item) => sum + item.quantity, 0), cents };
}

export interface IQuoteMessageInput {
  readonly sharerName: string;
  readonly deckName: string;
  readonly needed: readonly ISharedQuoteItem[];
  readonly draft: TQuoteDraft;
}

/** The answer to the sharer: one line per card the store has, then the total. Cards marked 0 are left out. */
export function buildQuoteMessage({ sharerName, deckName, needed, draft }: IQuoteMessageInput, t: TFunction): string {
  const lines = needed.flatMap((item) => {
    const row = draft[item.cardIdentifier];
    if (row === undefined || row.have <= 0) return [];
    const unit = parseReais(row.price);
    const parts = [
      t('sharing.quote.messageLine', { count: row.have, card: cardName(item.name, item.pitch, (key) => t(key)) }),
      ...(unit === null ? [] : [t('sharing.quote.messageEach', { price: formatBrl(unit) })]),
      ...(row.note.trim() === '' ? [] : [row.note.trim()]),
    ];
    return [parts.join(' · ')];
  });
  const totals = quoteTotals(needed, draft);
  return [
    t('sharing.quote.messageHead', { name: sharerName, deck: deckName }),
    ...lines,
    t('sharing.quote.messageTotal', { have: totals.have, count: totals.needed, price: formatBrl(totals.cents) }),
  ].join('\n');
}

/** One tab-separated line per card needed: copies, name, pitch as a word. Pastes into a spreadsheet's three columns. */
export function buildSpreadsheetList(needed: readonly ISharedQuoteItem[], t: TFunction): string {
  return needed.map((item) => [item.quantity, item.name, pitchWord(item.pitch, (key) => t(key)) ?? ''].join('\t')).join('\n');
}
