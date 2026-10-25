import type { IListCard } from '../deckListCards';

/** The deck `r3-export-group-desktop` and `r2-list-view-desktop` draw: "Rhinar CC", Classic Constructed. */
export const FIXTURE_DECK_NAME = 'Rhinar CC';
export const FIXTURE_FORMAT = 'Classic Constructed';

function line(
  name: string,
  pitch: 1 | 2 | 3 | null,
  overrides: Partial<IListCard> & Pick<IListCard, 'slot' | 'quantity'>,
): IListCard {
  return {
    cardIdentifier: name.toLowerCase().replace(/[^a-z]+/g, '-'),
    name,
    pitch,
    cost: null,
    type: 'Action',
    inventoryQuantity: 0,
    missing: 0,
    missingInventory: 0,
    ...overrides,
  };
}

const LOADOUT: readonly IListCard[] = [
  line('Rhinar, Reckless Rampage', null, { slot: 'hero', quantity: 1, type: 'Hero' }),
  line('Romping Club', null, { slot: 'weapon', quantity: 1, type: 'Weapon' }),
  line('Scabskin Leathers', null, { slot: 'equipment', quantity: 1, type: 'Equipment' }),
  line("Fyendal's Spring Tunic", null, { slot: 'equipment', quantity: 1, type: 'Equipment' }),
  line('Nullrune Hood', null, { slot: 'equipment', quantity: 1, type: 'Equipment' }),
  line('Arcanite Skullcap', null, { slot: 'equipment', quantity: 1, type: 'Equipment' }),
];

function deckLine(name: string, pitch: 1 | 2 | 3, cost: number, extra: Partial<IListCard> = {}): IListCard {
  return line(name, pitch, { slot: 'mainboard', quantity: 3, cost, ...extra });
}

/** Stored order, as the screens print it: Pack Hunt first, then the rest in alphabetical order. */
const DECK: readonly IListCard[] = [
  deckLine('Pack Hunt', 1, 2, { inventoryQuantity: 1 }),
  deckLine('Awakening Bellow', 3, 1, { missing: 3 }),
  deckLine('Barraging Beatdown', 1, 0),
  deckLine('Barraging Brawnhide', 2, 3),
  deckLine('Breakneck Battery', 3, 2),
  deckLine('Demolition Crew', 1, 2, { missing: 1 }),
  deckLine('Energy Potion', 3, 0),
  deckLine('Flock of the Feather Walkers', 3, 1),
  deckLine('Nimble Strike', 1, 1),
  deckLine('Nimblism', 2, 0),
  deckLine('Potion of Strength', 3, 0),
  deckLine('Primeval Bellow', 1, 0),
  deckLine('Raging Onslaught', 2, 3),
  deckLine('Razor Reflex', 3, 1, { type: 'Attack Reaction' }),
  deckLine('Regurgitating Slog', 1, 2),
  deckLine('Savage Feast', 2, 1),
  deckLine('Savage Swing', 3, 1),
  deckLine('Scar for a Scar', 1, 0),
  deckLine('Scour the Battlescape', 1, 0),
  deckLine('Springboard Somersault', 2, 0, { type: 'Defense Reaction' }),
];

function inventoryLine(
  name: string,
  pitch: 1 | 2 | 3,
  quantity: number,
  cost: number,
  type: string,
  extra: Partial<IListCard> = {},
): IListCard {
  return line(name, pitch, { slot: 'mainboard', quantity: 0, inventoryQuantity: quantity, cost, type, ...extra });
}

const INVENTORY_ONLY: readonly IListCard[] = [
  inventoryLine('Bone Head Barrier', 2, 2, 1, 'Instant'),
  inventoryLine('Muscle Mutt', 2, 2, 3, 'Action', { missingInventory: 2 }),
  inventoryLine('Pummel', 3, 3, 2, 'Attack Reaction'),
  inventoryLine('Reckless Swing', 3, 2, 0, 'Defense Reaction', { missingInventory: 1 }),
  inventoryLine('Sink Below', 1, 3, 0, 'Defense Reaction'),
  inventoryLine('Snatch', 1, 2, 0, 'Action'),
];

/** 60 cards in the deck, 15 in the inventory (Pack Hunt (Vermelho) at 3 + 1, over the limit of 3). */
export const FIXTURE_CARDS: readonly IListCard[] = [...LOADOUT, ...DECK, ...INVENTORY_ONLY];

export const FIXTURE_ILLEGAL_LEGALITY = {
  category: 'illegal' as const,
  reasons: ['x'],
  details: [
    {
      code: 'too_many_copies',
      params: {
        card: 'Pack Hunt',
        cardIdentifier: 'pack-hunt',
        pitch: 1,
        count: 4,
        limit: 3,
        format: 'Classic Constructed',
        legendary: false,
        restricted: false,
      },
    },
  ],
};

export const FIXTURE_LEGAL_LEGALITY = { category: 'legal' as const, reasons: [], details: [] };
