import type { ISharedCard } from '../../api/shared-decks';
import { withPitch } from '../deck-detail/recommendations/card-naming';

export type TSharedGroupId = 'hero' | 'weapon' | 'equipment' | 'actions' | 'reactions' | 'other';

export interface ISharedCardGroup {
  readonly id: TSharedGroupId;
  readonly cards: readonly ISharedCard[];
  readonly total: number;
}

const GROUP_ORDER: readonly TSharedGroupId[] = ['hero', 'weapon', 'equipment', 'actions', 'reactions', 'other'];

function groupOf(card: ISharedCard): TSharedGroupId {
  if (card.slot === 'hero' || card.slot === 'weapon' || card.slot === 'equipment') return card.slot;
  if (card.slot !== 'mainboard') return 'other';
  return card.type.toLowerCase().includes('reaction') ? 'reactions' : 'actions';
}

function compareCards(a: ISharedCard, b: ISharedCard): number {
  return a.name.localeCompare(b.name) || (a.pitch ?? 0) - (b.pitch ?? 0);
}

/** Splits the deck into the groups the shared page lists, in reading order, skipping empty ones. */
export function groupSharedCards(cards: readonly ISharedCard[]): readonly ISharedCardGroup[] {
  const byGroup = new Map<TSharedGroupId, ISharedCard[]>();
  for (const card of cards) {
    const id = groupOf(card);
    byGroup.set(id, [...(byGroup.get(id) ?? []), card]);
  }
  return GROUP_ORDER.flatMap((id) => {
    const members = byGroup.get(id);
    if (members === undefined) return [];
    const sorted = [...members].sort(compareCards);
    return [{ id, cards: sorted, total: sorted.reduce((sum, card) => sum + card.quantity, 0) }];
  });
}

type TTranslate = (key: string, options?: Record<string, unknown>) => string;

/**
 * One line per missing card ("2x Name (Vermelho)", pitch named as the rest of
 * the app names it), then the share address so the pasted message leads back.
 */
export function buildMissingText(
  missing: readonly ISharedCard[],
  url: string,
  t: TTranslate,
): string {
  const lines = missing.map((card) =>
    t('sharing.wanted.textLine', {
      count: card.quantity,
      name: withPitch(card.name, card.pitch, (key) => t(key)),
    }),
  );
  return [...lines, '', url].join('\n');
}
