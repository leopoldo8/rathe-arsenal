import type { IBreakdown, IBreakdownEntry } from '../../api/deck-detail';
import { entryKey } from './deckDetailModel';

export interface IDeckListItem {
  readonly key: string;
  readonly entry: IBreakdownEntry;
  /** Copies the deck asks for (owned plus missing). */
  readonly quantity: number;
  /** Copies still to acquire; 0 when the card is fully covered. */
  readonly missing: number;
}

export type TDeckListView = 'type' | 'cost' | 'list';

export type TTypeGroupId = 'attack' | 'defense' | 'nonAttack' | 'loadout';
export type TCostGroupId = '0' | '1' | '2' | '3' | '4plus' | 'none';
export type TListGroupId = 'all';
export type TDeckListGroupId = TTypeGroupId | TCostGroupId | TListGroupId;

export interface IDeckListGroup {
  readonly id: TDeckListGroupId;
  readonly items: readonly IDeckListItem[];
  readonly total: number;
}

const TYPE_GROUP_ORDER: readonly TTypeGroupId[] = ['attack', 'defense', 'nonAttack', 'loadout'];
const COST_GROUP_ORDER: readonly TCostGroupId[] = ['0', '1', '2', '3', '4plus', 'none'];
const LOADOUT_SLOT_PATTERN = /hero|weapon|equipment/i;
const LOADOUT_TYPE_PATTERN = /hero|weapon|equipment/i;
const DEFENSE_TYPE_PATTERN = /defense|reaction/i;
const MAX_NAMED_COST = 3;

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
    missingByKey.set(entryKey(entry), (missingByKey.get(entryKey(entry)) ?? 0) + entry.quantity);
  }

  const quantityByKey = new Map<string, number>();
  const entryByKey = new Map<string, IBreakdownEntry>();
  for (const entry of [...breakdown.exact, ...notOwned]) {
    const key = entryKey(entry);
    if (!entryByKey.has(key)) entryByKey.set(key, entry);
    quantityByKey.set(key, (quantityByKey.get(key) ?? 0) + entry.quantity);
  }

  return Array.from(entryByKey, ([key, entry]) => ({
    key,
    entry,
    quantity: quantityByKey.get(key) ?? entry.quantity,
    missing: missingByKey.get(key) ?? 0,
  }));
}

/**
 * Catalog `type` is the first entry of the card's type list, which for actions is
 * just "Action": it cannot tell an attack from a non-attack. Plain actions land in
 * the attack group until the breakdown carries the full type list.
 */
export function resolveTypeGroup(entry: IBreakdownEntry): TTypeGroupId {
  if (LOADOUT_SLOT_PATTERN.test(entry.slot) || LOADOUT_TYPE_PATTERN.test(entry.type)) {
    return 'loadout';
  }
  if (DEFENSE_TYPE_PATTERN.test(entry.type)) return 'defense';
  if (/^action$|attack/i.test(entry.type.trim())) return 'attack';
  return 'nonAttack';
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
    return toGroups(TYPE_GROUP_ORDER, items, (item) => resolveTypeGroup(item.entry));
  }
  if (view === 'cost') {
    return toGroups(COST_GROUP_ORDER, items, (item) => resolveCostGroup(item.entry.cost));
  }
  if (items.length === 0) return [];
  const sorted = [...items].sort(byName);
  return [{ id: 'all', items: sorted, total: sumQuantity(sorted) }];
}
