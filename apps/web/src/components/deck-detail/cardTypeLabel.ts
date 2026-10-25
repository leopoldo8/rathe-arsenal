import type { TFunction } from 'i18next';

const TYPE_KEYS: Readonly<Record<string, string>> = {
  Action: 'deckDetail.cardTypeAction',
  'Attack Reaction': 'deckDetail.cardTypeAttackReaction',
  'Defense Reaction': 'deckDetail.cardTypeDefenseReaction',
  Instant: 'deckDetail.cardTypeInstant',
  Weapon: 'deckDetail.cardTypeWeapon',
  Equipment: 'deckDetail.cardTypeEquipment',
  Hero: 'deckDetail.cardTypeHero',
};

/** The card's type as a word ("Ação"); types the catalog has no translation for keep their English name. */
export function cardTypeLabel(type: string, t: TFunction): string {
  const key = TYPE_KEYS[type];
  return key === undefined ? type : t(key);
}
