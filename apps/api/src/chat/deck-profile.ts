import { ICatalogCard } from '@rathe-arsenal/engine';
import { countByDefense, ICountedCard, roundTenth } from '../common/deck-counts';
import { IDeckRow, slottedCards } from './deck-rows';

const EQUIPMENT_SLOTS = ['Head', 'Chest', 'Arms', 'Legs'] as const;
const ABILITY_COST = /\*\*[^*]+\*\* - ([^:\n]*):/g;
const OPTIONAL_PAYMENT = /pay ((?:\{r\})+)/g;
const ABILITY_SLOTS: ReadonlySet<string> = new Set(['hero', 'weapon', 'equipment']);

export interface IAbilityCost {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly kind: 'activation' | 'payment';
  readonly resources: number;
}

export interface IDeckProfile {
  readonly mainboardByDefense: Record<string, number>;
  readonly defenseReactions: number;
  readonly attacks: { readonly cards: number; readonly withGoAgain: number; readonly averagePower: number | null };
  readonly equipment: { readonly slots: readonly string[]; readonly missingSlots: readonly string[]; readonly defense: number };
  readonly resources: { readonly averagePitch: number | null; readonly averageCost: number | null; readonly abilityCosts: readonly IAbilityCost[] };
}

const copies = (cards: readonly ICountedCard[]): number => cards.reduce((sum, { quantity }) => sum + quantity, 0);
const has = (values: readonly unknown[], wanted: string): boolean => values.some((value) => String(value) === wanted);

function averageOf(cards: readonly ICountedCard[], valueOf: (card: ICatalogCard) => number | null): number | null {
  const total = copies(cards);
  return total === 0 ? null : roundTenth(cards.reduce((sum, { card, quantity }) => sum + (valueOf(card) ?? 0) * quantity, 0) / total);
}

function resourcesIn(text: string): number {
  return (text.match(/\{r\}/g) ?? []).length;
}

function abilityCosts(card: ICatalogCard): IAbilityCost[] {
  const text = card.functionalText ?? '';
  const entry = (kind: IAbilityCost['kind'], resources: number): IAbilityCost => ({ cardIdentifier: card.cardIdentifier, name: card.name, kind, resources });
  const activations = [...text.matchAll(ABILITY_COST)].map((match) => resourcesIn(match[1]!)).filter((resources) => resources > 0);
  const payments = [...text.matchAll(OPTIONAL_PAYMENT)].map((match) => resourcesIn(match[1]!));
  return [...activations.map((resources) => entry('activation', resources)), ...payments.map((resources) => entry('payment', resources))];
}

export function deckProfile(rows: readonly IDeckRow[]): IDeckProfile {
  const cards = slottedCards(rows);
  const mainboard = cards.filter((entry) => entry.slot === 'mainboard');
  const attacks = mainboard.filter(({ card }) => has(card.subtypes, 'Attack'));
  const equipment = cards.filter((entry) => entry.slot === 'equipment');
  const filled = EQUIPMENT_SLOTS.filter((slot) => equipment.some(({ card }) => has(card.subtypes, slot)));
  return {
    mainboardByDefense: countByDefense(mainboard),
    defenseReactions: copies(mainboard.filter(({ card }) => has(card.types, 'Defense Reaction'))),
    attacks: {
      cards: copies(attacks),
      withGoAgain: copies(attacks.filter(({ card }) => has(card.keywords, 'Go again'))),
      averagePower: averageOf(attacks, (card) => card.power),
    },
    equipment: {
      slots: filled,
      missingSlots: EQUIPMENT_SLOTS.filter((slot) => !filled.includes(slot)),
      defense: equipment.reduce((sum, { card, quantity }) => sum + (card.defense ?? 0) * quantity, 0),
    },
    resources: {
      averagePitch: averageOf(mainboard, (card) => card.pitch),
      averageCost: averageOf(mainboard, (card) => card.cost),
      abilityCosts: cards.filter((entry) => ABILITY_SLOTS.has(entry.slot)).flatMap(({ card }) => abilityCosts(card)),
    },
  };
}
