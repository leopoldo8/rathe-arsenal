import type { TFunction } from 'i18next';
import type { IDeckUse, ISpareRow, ISpareWhy, TSpareRule } from '../../api/spare';
import { describeVersion, isUnversioned } from '../collection-versions/copy-version-labels';

/** Portuguese reads 0 as singular; every count here says "0 cópias", so only 1 takes the singular form. */
export function plural(t: TFunction, baseKey: string, count: number, options: Readonly<Record<string, unknown>> = {}): string {
  return t(count === 1 ? `${baseKey}_one` : `${baseKey}_other`, { ...options, count });
}

export type TSort = 'price' | 'name';
export type TPriceFilter = 'all' | 5 | 20;

export const PRICE_FILTERS: readonly TPriceFilter[] = ['all', 5, 20];
const CENTS_PER_REAL = 100;

export function rowKey(row: Pick<ISpareRow, 'cardIdentifier' | 'printingCode' | 'edition' | 'finish' | 'condition'>): string {
  return [row.cardIdentifier, row.printingCode, row.edition, row.finish, row.condition].join('|');
}

const RULE_LINE_KEY: Readonly<Record<TSpareRule, string>> = {
  within_format: 'spare.yourRuleWithinFormat',
  any_deck: 'spare.yourRuleAnyDeck',
  per_deck: 'spare.yourRulePerDeck',
};

export function ruleLine(rule: TSpareRule, t: TFunction): string {
  return t(RULE_LINE_KEY[rule]);
}

/** Orders by the suggested price, highest first, or by name; a row with no suggestion goes last by price. */
export function sortRows(rows: readonly ISpareRow[], sort: TSort): readonly ISpareRow[] {
  const byName = (a: ISpareRow, b: ISpareRow): number => a.name.localeCompare(b.name) || (a.pitch ?? 0) - (b.pitch ?? 0);
  return [...rows].sort((a, b) => (sort === 'name' ? byName(a, b) : (b.suggestedCents ?? -1) - (a.suggestedCents ?? -1) || byName(a, b)));
}

/** "acima de R$ 5" keeps a row suggested above R$ 5; one with no suggestion is never above anything. */
export function filterRows(rows: readonly ISpareRow[], filter: TPriceFilter): readonly ISpareRow[] {
  if (filter === 'all') return rows;
  return rows.filter((row) => (row.suggestedCents ?? 0) > filter * CENTS_PER_REAL);
}

export function suggestedReais(row: Pick<ISpareRow, 'suggestedCents'>): number | null {
  return row.suggestedCents === null ? null : Math.round(row.suggestedCents / CENTS_PER_REAL);
}

/** What a row says about its version; an unmarked copy names itself only beside a marked one of the same card. */
export function versionText(row: ISpareRow, siblings: readonly ISpareRow[], t: TFunction): string | null {
  if (!isUnversioned(row)) return describeVersion(row, t, () => row.setName);
  const markedSibling = siblings.some((other) => other.cardIdentifier === row.cardIdentifier && !isUnversioned(other));
  return markedSibling ? t('spare.versionUnknown') : null;
}

export interface IChosenTotals {
  readonly copies: number;
  readonly cents: number;
}

export function chosenTotals(rows: readonly ISpareRow[], chosen: Readonly<Record<string, number>>): IChosenTotals {
  return rows.reduce<IChosenTotals>(
    (sum, row) => {
      const quantity = chosen[rowKey(row)] ?? 0;
      return { copies: sum.copies + quantity, cents: sum.cents + quantity * (suggestedReais(row) ?? 0) * CENTS_PER_REAL };
    },
    { copies: 0, cents: 0 },
  );
}

export interface IWhyLine {
  readonly key: string;
  readonly title: string;
  readonly sub: string | null;
  readonly count: number;
}

function deckUseText(holder: IDeckUse, t: TFunction): string {
  return holder.inventory > 0
    ? t('spare.whyUsesWithInventory', { deck: holder.deckName, deck_copies: holder.deck, inventory: holder.inventory })
    : t('spare.whyUses', { deck: holder.deckName, count: holder.use });
}

function usesList(holders: readonly IDeckUse[], t: TFunction): string {
  return holders.map((holder) => deckUseText(holder, t)).join(', ');
}

function singleHolderLine(holder: IDeckUse, title: string, t: TFunction): IWhyLine {
  return { key: `deck-${holder.deckId}`, title, sub: holder.inventory > 0 ? deckUseText(holder, t) : null, count: holder.use };
}

function formatLines(holders: readonly IDeckUse[], t: TFunction): readonly IWhyLine[] {
  const byFormat = new Map<string, IDeckUse[]>();
  for (const holder of holders) byFormat.set(holder.format, [...(byFormat.get(holder.format) ?? []), holder]);
  return [...byFormat.entries()]
    .map(([format, group]) => ({ format, group, held: Math.max(...group.map((holder) => holder.use)) }))
    .sort((a, b) => b.held - a.held || a.format.localeCompare(b.format))
    .map(({ format, group, held }) => {
      const only = group[0];
      if (group.length === 1 && only !== undefined) {
        return singleHolderLine(only, t('spare.whyDeckInFormat', { deck: only.deckName, format }), t);
      }
      return { key: `format-${format}`, title: t('spare.whyFormatMany', { format }), sub: t('spare.whyBiggest', { uses: usesList(group, t) }), count: held };
    });
}

/** The rows of "Por que sobra?" between "Você tem" and "Sobra": the decks that set the number, by the player's rule. */
export function whyLines(why: ISpareWhy, rule: TSpareRule, t: TFunction): readonly IWhyLine[] {
  const holders = why.holders;
  const top = holders[0];
  if (top === undefined) return [];
  if (rule === 'per_deck') return holders.map((holder) => singleHolderLine(holder, t('spare.whyDeckIn', { deck: holder.deckName }), t));
  if (rule === 'any_deck') {
    return [
      {
        key: `deck-${top.deckId}`,
        title: t('spare.whyDeckIn', { deck: top.deckName }),
        sub: holders.length > 1 ? t('spare.whyBiggest', { uses: usesList(holders, t) }) : top.inventory > 0 ? deckUseText(top, t) : null,
        count: top.use,
      },
    ];
  }
  return formatLines(holders, t);
}
