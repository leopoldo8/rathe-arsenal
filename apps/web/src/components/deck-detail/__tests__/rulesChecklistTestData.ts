import { computeDraftLegality } from '../../../lib/draft-legality';
import type { IHeroListItem } from '../../../api/catalog';
import type { ICompositionDraft, IDraftCard } from '../../../hooks/useCompositionDraft';

export const RHINAR: IHeroListItem = {
  cardIdentifier: 'rhinar',
  name: 'Rhinar',
  hero: 'Rhinar',
  young: true,
  legalFormats: ['Blitz', 'Silver Age'],
  imageUrl: null,
};

export function draftCard(overrides: Partial<IDraftCard> = {}): IDraftCard {
  return {
    cardIdentifier: 'filler',
    name: 'Filler',
    quantity: 1,
    slot: 'mainboard',
    pitch: 1,
    cost: 2,
    type: 'Action',
    imageUrl: null,
    legalFormats: ['Blitz', 'Classic Constructed'],
    legalHeroes: [],
    bannedFormats: [],
    restrictedFormats: [],
    legalOverrides: [],
    specializations: [],
    legendary: false,
    ...overrides,
  };
}

function filler(index: number): IDraftCard {
  return draftCard({ cardIdentifier: `filler-${index}`, name: `Filler ${index}`, pitch: 2 });
}

/** The deck of `r3-editor-phone` and `r3-checklist-phone`: Rhinar Blitz with a weapon and three equipment. */
export function blitzDraft(options: { readonly deckCards: number; readonly packHuntCopies: number; readonly commandCopies?: number }): ICompositionDraft {
  const named = [
    draftCard({ cardIdentifier: 'pack-hunt-red', name: 'Pack Hunt', quantity: options.packHuntCopies }),
    ...(options.commandCopies === undefined
      ? []
      : [draftCard({ cardIdentifier: 'command-and-conquer-red', name: 'Command and Conquer', quantity: options.commandCopies })]),
  ];
  const namedCopies = named.reduce((sum, card) => sum + card.quantity, 0);
  const fillers = Array.from({ length: options.deckCards - namedCopies }, (_, index) => filler(index));
  return {
    heroIdentifier: 'rhinar',
    format: 'Blitz',
    cards: [
      draftCard({ cardIdentifier: 'rhinar', name: 'Rhinar', slot: 'hero', pitch: null, type: 'Hero' }),
      draftCard({ cardIdentifier: 'romping-club', name: 'Romping Club', slot: 'weapon', pitch: null, type: 'Weapon' }),
      draftCard({ cardIdentifier: 'nullrune-hood', name: 'Nullrune Hood', slot: 'equipment', pitch: null, type: 'Equipment' }),
      draftCard({ cardIdentifier: 'scabskin-leathers', name: 'Scabskin Leathers', slot: 'equipment', pitch: null, type: 'Equipment' }),
      draftCard({ cardIdentifier: 'fyendals-spring-tunic', name: "Fyendal's Spring Tunic", slot: 'equipment', pitch: null, type: 'Equipment' }),
      ...named,
      ...fillers,
    ],
  };
}

export function verdictOf(draft: ICompositionDraft) {
  const result = computeDraftLegality(draft, RHINAR);
  if (result === null) throw new Error('the hero fixture must resolve');
  return result;
}
