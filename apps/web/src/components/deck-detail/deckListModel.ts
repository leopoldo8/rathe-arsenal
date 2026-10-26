import type { TFunction } from 'i18next';
import type { IBreakdown, IBreakdownEntry } from '../../api/deck-detail';
import type { ILegalityReasonDetail } from '../../api/decks';
import { cardName } from '../../lib/card-name';
import { cardGroupOf, CARD_GROUP_ORDER, type TCardGroupId } from '../../lib/card-groups';
import { cardTypeLabel } from './cardTypeLabel';
import { entryKey } from './deckDetailModel';
import { buildSections, type IListCard, type TListSectionId } from './deckListCards';

export interface IDeckListItem {
  readonly key: string;
  readonly entry: IBreakdownEntry;
  /** Copies the deck asks for (owned plus missing). */
  readonly quantity: number;
  /** Copies still to acquire; 0 when the card is fully covered. */
  readonly missing: number;
}

export type TDeckListView = 'type' | 'cost' | 'list';

export type TTypeGroupId = TCardGroupId;
export type TCostGroupId = '0' | '1' | '2' | '3' | '4plus' | 'none';
export type TListGroupId = 'all';
export type TDeckListGroupId = TTypeGroupId | TCostGroupId | TListGroupId;

export interface IDeckListGroup {
  readonly id: TDeckListGroupId;
  readonly items: readonly IDeckListItem[];
  readonly total: number;
}

const COST_GROUP_ORDER: readonly TCostGroupId[] = ['0', '1', '2', '3', '4plus', 'none'];
const MAX_NAMED_COST = 3;

/** Copies of an entry that belong to the starting deck; the inventory's share is not part of the deck list. */
function deckCopies(entry: IBreakdownEntry): number {
  return entry.quantity - (entry.inventoryQuantity ?? 0);
}

function sumQuantity(items: readonly { readonly quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * The deck's cards: every owned entry plus every entry still missing, merged per
 * card and slot so a partly owned card shows once with its missing share.
 */
export function buildDeckList(
  breakdown: IBreakdown,
  openMissing: readonly IBreakdownEntry[],
): readonly IDeckListItem[] {
  const notOwned = breakdown.notOwned ?? breakdown.missing;
  const missingByKey = new Map<string, number>();
  for (const entry of openMissing) {
    missingByKey.set(entryKey(entry), (missingByKey.get(entryKey(entry)) ?? 0) + deckCopies(entry));
  }

  const quantityByKey = new Map<string, number>();
  const entryByKey = new Map<string, IBreakdownEntry>();
  for (const entry of [...breakdown.exact, ...notOwned]) {
    const key = entryKey(entry);
    if (!entryByKey.has(key)) entryByKey.set(key, entry);
    quantityByKey.set(key, (quantityByKey.get(key) ?? 0) + deckCopies(entry));
  }

  return Array.from(entryByKey, ([key, entry]) => ({
    key,
    entry,
    quantity: quantityByKey.get(key) ?? deckCopies(entry),
    missing: missingByKey.get(key) ?? 0,
  })).filter((item) => item.quantity > 0);
}

/**
 * The deck page's type groups are the shared card-list groups. The breakdown carries only the card's
 * first type, so a plain action stays under "Ações" until it carries subtypes too.
 */
export function resolveTypeGroup(entry: IBreakdownEntry): TTypeGroupId {
  return cardGroupOf({ slot: entry.slot, type: entry.type });
}

export function resolveCostGroup(cost: number | null): TCostGroupId {
  if (cost === null) return 'none';
  if (cost > MAX_NAMED_COST) return '4plus';
  return String(Math.max(0, cost)) as TCostGroupId;
}

function byName(a: IDeckListItem, b: IDeckListItem): number {
  return a.entry.name.localeCompare(b.entry.name);
}

function toGroups<TId extends TDeckListGroupId>(
  order: readonly TId[],
  items: readonly IDeckListItem[],
  resolve: (item: IDeckListItem) => TId,
): readonly IDeckListGroup[] {
  return order
    .map((id) => {
      const groupItems = items.filter((item) => resolve(item) === id).sort(byName);
      return { id, items: groupItems, total: sumQuantity(groupItems) };
    })
    .filter((group) => group.items.length > 0);
}

export function groupDeckList(
  items: readonly IDeckListItem[],
  view: TDeckListView,
): readonly IDeckListGroup[] {
  if (view === 'type') {
    return toGroups(CARD_GROUP_ORDER, items, (item) => resolveTypeGroup(item.entry));
  }
  if (view === 'cost') {
    return toGroups(COST_GROUP_ORDER, items, (item) => resolveCostGroup(item.entry.cost));
  }
  if (items.length === 0) return [];
  const sorted = [...items].sort(byName);
  return [{ id: 'all', items: sorted, total: sumQuantity(sorted) }];
}

export interface ITextListLine {
  readonly key: string;
  /** "3x Pack Hunt (Vermelho) · custo 2 · Ação". */
  readonly text: string;
  /** "4 no total, o limite é 3, tire 1" when the card is over its copy limit. */
  readonly problem: string | null;
  /** "faltam 3" when the collection does not cover the line. */
  readonly missing: string | null;
}

export interface ITextListGroup {
  readonly id: TListSectionId;
  readonly total: number;
  readonly lines: readonly ITextListLine[];
}

function copyProblemOf(card: IListCard, details: readonly ILegalityReasonDetail[], t: TFunction): string | null {
  const found = details.find(
    (detail) => detail.code === 'too_many_copies' && detail.params['cardIdentifier'] === card.cardIdentifier,
  );
  if (found === undefined) return null;
  const total = Number(found.params['count']);
  const limit = Number(found.params['limit']);
  return t('deckDetail.listProblemCopies', { total, limit, extra: total - limit });
}

/**
 * The "Lista" view: text grouped Herói, Arma, Equipamentos, Deck, Inventário, one line per card with
 * its cost and type, then the rule problem and the copies still missing when there are any.
 */
export function buildTextList(
  cards: readonly IListCard[],
  details: readonly ILegalityReasonDetail[],
  t: TFunction,
): readonly ITextListGroup[] {
  return buildSections(cards).map((section) => ({
    id: section.id,
    total: section.total,
    lines: section.lines.map((line) => {
      const parts = [
        `${line.quantity}x ${cardName(line.card.name, line.card.pitch, t)}`,
        ...(line.card.cost === null ? [] : [t('deckDetail.listCost', { cost: line.card.cost })]),
        cardTypeLabel(line.card.type, t),
      ];
      return {
        key: `${line.card.cardIdentifier}::${line.card.slot}::${section.id}`,
        text: parts.join(' · '),
        problem: copyProblemOf(line.card, details, t),
        missing: line.missing > 0 ? t('deckDetail.missingCopies', { count: line.missing }) : null,
      };
    }),
  }));
}
