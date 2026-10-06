import { catalog } from '@rathe-arsenal/engine';
import { decideAdoption, IAdoptionInput } from '../adoption-rules';

const card = (id: string) => catalog.getCard(id);
const KATSU = card('katsu-the-wanderer');
const DECK = [
  { cardIdentifier: 'katsu-the-wanderer', slot: 'hero', quantity: 1 },
  { cardIdentifier: 'flex-red', slot: 'mainboard', quantity: 2 },
  { cardIdentifier: 'emissary-of-tides-red', slot: 'mainboard', quantity: 1 },
  { cardIdentifier: 'emissary-of-tides-red', slot: 'mainboard', quantity: 1 },
  { cardIdentifier: 'talishar-the-lost-prince', slot: 'weapon', quantity: 1 },
];

function input(overrides: Partial<IAdoptionInput> = {}): IAdoptionInput {
  return {
    recommended: card('adrenaline-rush-red'),
    cut: card('flex-red'),
    cutSlot: 'mainboard',
    heroCard: KATSU,
    format: 'Classic Constructed',
    deckCards: DECK,
    ...overrides,
  };
}

describe('decideAdoption', () => {
  it('moves every cut copy, capped by the copy limit across the deck', () => {
    expect(decideAdoption(input())).toEqual({ kind: 'move', quantity: 2 });
    expect(decideAdoption(input({ cut: card('emissary-of-tides-red') }))).toEqual({ kind: 'move', quantity: 2 });
    expect(decideAdoption(input({ recommended: card('amethyst-amulet-blue') }))).toEqual({ kind: 'move', quantity: 1 });
    expect(
      decideAdoption(input({ deckCards: [...DECK, { cardIdentifier: 'adrenaline-rush-red', slot: 'equipment', quantity: 2 }] })),
    ).toEqual({ kind: 'move', quantity: 1 });
    const blitzHeld = (quantity: number) => [...DECK, { cardIdentifier: 'adrenaline-rush-red', slot: 'mainboard', quantity }];
    expect(decideAdoption(input({ format: 'Blitz', deckCards: blitzHeld(1) }))).toEqual({ kind: 'move', quantity: 1 });
    expect(decideAdoption(input({ format: 'Blitz', deckCards: blitzHeld(2) }))).toEqual({ kind: 'refuse', code: 'REPLACEMENT_ILLEGAL' });
  });

  it('refuses each illegal adoption and an empty cut', () => {
    const cases: ReadonlyArray<[string, Partial<IAdoptionInput>, string]> = [
      ['limit reached', { deckCards: [...DECK, { cardIdentifier: 'adrenaline-rush-red', slot: 'mainboard', quantity: 3 }] }, 'REPLACEMENT_ILLEGAL'],
      ['not legal for the hero', { recommended: card('a-bit-off-the-side-red') }, 'REPLACEMENT_ILLEGAL'],
      ['no hero', { heroCard: null }, 'REPLACEMENT_ILLEGAL'],
      ['weapon slot', { cut: card('talishar-the-lost-prince'), cutSlot: 'weapon' }, 'REPLACEMENT_ILLEGAL'],
      ['hero slot', { cut: KATSU, cutSlot: 'hero' }, 'REPLACEMENT_ILLEGAL'],
      ['equipment into mainboard', { recommended: card('arcane-lantern') }, 'REPLACEMENT_ILLEGAL'],
      ['cut is the recommended card', { cut: card('adrenaline-rush-red') }, 'REPLACEMENT_ILLEGAL'],
      ['cut not in the slot', { cut: card('coax-a-commotion-red') }, 'NOTHING_TO_REPLACE'],
    ];
    for (const [label, overrides, code] of cases) {
      expect({ label, decision: decideAdoption(input(overrides)) }).toEqual({ label, decision: { kind: 'refuse', code } });
    }
  });
});
