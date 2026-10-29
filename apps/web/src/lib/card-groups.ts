/**
 * The one rule that sorts a card into a section of a card list, shared by the deck page, the Library
 * and the shared deck page so the same cards read under the same headings everywhere. It reads only
 * the slot and the card's first type, the facts all three pages hold, so an attack action and a
 * non-attack action share the "Ações" heading.
 */
export type TCardGroupId =
  | 'action'
  | 'attackReaction'
  | 'defenseReaction'
  | 'instant'
  | 'hero'
  | 'weapon'
  | 'equipment'
  | 'other';

/** Reading order: the cards played from the hand first, then the hero and what it wears. */
export const CARD_GROUP_ORDER: readonly TCardGroupId[] = [
  'action',
  'attackReaction',
  'defenseReaction',
  'instant',
  'hero',
  'weapon',
  'equipment',
  'other',
];

export const CARD_GROUP_LABEL_KEY: Readonly<Record<TCardGroupId, string>> = {
  action: 'cardGroups.action',
  attackReaction: 'cardGroups.attackReaction',
  defenseReaction: 'cardGroups.defenseReaction',
  instant: 'cardGroups.instant',
  hero: 'cardGroups.hero',
  weapon: 'cardGroups.weapon',
  equipment: 'cardGroups.equipment',
  other: 'cardGroups.other',
};

export interface ICardGroupFacts {
  /** The deck slot when the list knows it ('hero', 'weapon', 'equipment', 'mainboard', ...). */
  readonly slot?: string | undefined;
  /** The card's first catalog type: "Action", "Defense Reaction", "Weapon". */
  readonly type: string;
}

const LOADOUT_GROUPS: Readonly<Record<string, TCardGroupId>> = {
  hero: 'hero',
  weapon: 'weapon',
  equipment: 'equipment',
};

export function cardGroupOf({ slot, type }: ICardGroupFacts): TCardGroupId {
  const bySlot = slot === undefined ? undefined : LOADOUT_GROUPS[slot.toLowerCase()];
  if (bySlot !== undefined) return bySlot;
  const kind = type.trim().toLowerCase();
  if (kind.includes('reaction')) return kind.includes('attack') ? 'attackReaction' : 'defenseReaction';
  if (kind.includes('action')) return 'action';
  return LOADOUT_GROUPS[kind] ?? (kind === 'instant' ? 'instant' : 'other');
}

export interface ICardGroup<TCard> {
  readonly id: TCardGroupId;
  readonly cards: readonly TCard[];
}

/** Splits cards into the groups of `CARD_GROUP_ORDER`, skipping empty ones and keeping each group's input order. */
export function groupCardsByKind<TCard>(
  cards: readonly TCard[],
  factsOf: (card: TCard) => ICardGroupFacts,
): readonly ICardGroup<TCard>[] {
  return CARD_GROUP_ORDER.flatMap((id) => {
    const members = cards.filter((card) => cardGroupOf(factsOf(card)) === id);
    return members.length === 0 ? [] : [{ id, cards: members }];
  });
}
