import type { ITrackedDeckListItem, TDeckStatus } from '../../api/decks';

export type THomeGroup = 'active' | 'building' | 'idea' | 'retired';

export const GROUP_OF: Readonly<Record<TDeckStatus, THomeGroup>> = {
  ready: 'active',
  active: 'active',
  building: 'building',
  idea: 'idea',
  retired: 'retired',
};

export const GROUP_ORDER: readonly THomeGroup[] = [
  'active',
  'building',
  'idea',
  'retired',
];

export function filterByGroup(
  decks: readonly ITrackedDeckListItem[],
  group: THomeGroup,
): readonly ITrackedDeckListItem[] {
  return decks.filter((deck) => GROUP_OF[deck.status] === group);
}

export function applyTagFilter(
  decks: readonly ITrackedDeckListItem[],
  activeTags: readonly string[],
): readonly ITrackedDeckListItem[] {
  if (activeTags.length === 0) return decks;
  return decks.filter((deck) => deck.tags.some((tag) => activeTags.includes(tag)));
}

export function applySearchFilter(
  decks: readonly ITrackedDeckListItem[],
  query: string,
): readonly ITrackedDeckListItem[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return decks;
  return decks.filter(
    (deck) =>
      deck.name.toLowerCase().includes(needle) ||
      deck.hero.toLowerCase().includes(needle),
  );
}

export type TDeckMeta =
  | { readonly state: 'draft' }
  | { readonly state: 'complete'; readonly total: number }
  | {
      readonly state: 'incomplete';
      readonly missing: number;
      readonly owned: number;
      readonly total: number;
    };

/**
 * Completion follows the gated effectivePercent (only approved swaps count),
 * the same number the medallion shows, so the two never disagree.
 */
export function resolveDeckMeta(deck: ITrackedDeckListItem): TDeckMeta {
  const counts = deck.cardCounts;
  if (deck.latestSnapshot === null || counts === null || counts.total === 0) {
    return { state: 'draft' };
  }
  if (deck.latestSnapshot.effectivePercent >= 100) {
    return { state: 'complete', total: counts.total };
  }
  return {
    state: 'incomplete',
    missing: counts.missing,
    owned: counts.owned,
    total: counts.total,
  };
}

export function isRetired(deck: ITrackedDeckListItem): boolean {
  return deck.status === 'retired';
}

export function computeAverageReadiness(
  decks: readonly ITrackedDeckListItem[],
): number | null {
  const scored = decks.filter((deck) => !isRetired(deck) && deck.latestSnapshot !== null);
  if (scored.length === 0) return null;
  const sum = scored.reduce(
    (acc, deck) => acc + (deck.latestSnapshot?.effectivePercent ?? 0),
    0,
  );
  return Math.round(sum / scored.length);
}

export function countPlayableDecks(decks: readonly ITrackedDeckListItem[]): number {
  return decks.filter(
    (deck) =>
      !isRetired(deck) && resolveDeckMeta(deck).state === 'complete' && deck.legality.category !== 'illegal',
  ).length;
}
