import type { ISharedListLine, ISharedListResponse } from '../../../api/shared-lists';

/** The two lists of the sell-and-trade screens: Duda's sell list, and Marcos's want list "Procuro - Kayo". */

export const TOKEN = 'aB3dE5gH7jK9mN';

export function sharedLine(overrides: Partial<ISharedListLine>): ISharedListLine {
  return {
    id: 1,
    cardIdentifier: 'pummel-red',
    name: 'Pummel',
    pitch: 1,
    type: 'Attack Reaction',
    imageUrl: null,
    quantity: 2,
    printingLabel: null,
    printingCode: '',
    edition: '',
    finish: '',
    setName: null,
    condition: null,
    priceCents: null,
    sold: false,
    ...overrides,
  };
}

export const DUDA: ISharedListResponse = {
  kind: 'sell',
  token: TOKEN,
  url: `https://rathearsenal.app/l/${TOKEN}`,
  name: 'Vendo - 21/10',
  notes: null,
  sharerName: 'Duda',
  contactWhatsapp: '5553999990000',
  isOwner: false,
  listId: null,
  totalPriceCents: null,
  updatedAt: '2026-10-21T12:00:00.000Z',
  spareNeedsRule: false,
  visitorList: null,
  lines: [
    sharedLine({ id: 1, cardIdentifier: 'command-and-conquer-red', name: 'Command and Conquer', quantity: 1, printingCode: 'HP1001', setName: 'History Pack 1', condition: 'NM', priceCents: 4500 }),
    sharedLine({ id: 2, cardIdentifier: 'snatch-red', name: 'Snatch', quantity: 3, finish: 'none', priceCents: 600 }),
    sharedLine({ id: 3, cardIdentifier: 'pummel-red', name: 'Pummel', quantity: 3, finish: 'none', priceCents: 400 }),
  ],
};

export const DUDA_MATCHES = {
  lines: [
    { lineId: 1, owned: 0, missingInDecks: 1, decks: [{ deckId: 1, deckName: 'Rhinar CC', missing: 1 }] },
    { lineId: 2, owned: 0, missingInDecks: 2, decks: [{ deckId: 2, deckName: 'Kayo CC', missing: 2 }] },
    { lineId: 3, owned: 0, missingInDecks: 1, decks: [{ deckId: 1, deckName: 'Rhinar CC', missing: 1 }] },
  ],
};

export const MARCOS: ISharedListResponse = {
  kind: 'want',
  token: TOKEN,
  url: `https://rathearsenal.app/l/${TOKEN}`,
  name: 'Procuro - Kayo',
  notes: null,
  sharerName: 'Marcos',
  contactWhatsapp: '5551999990000',
  isOwner: false,
  listId: null,
  totalPriceCents: null,
  updatedAt: '2026-10-21T12:00:00.000Z',
  spareNeedsRule: false,
  visitorList: {
    name: 'Procuro - Rhinar',
    url: 'https://rathearsenal.app/l/p3Rv8n',
    lines: [
      { cardIdentifier: 'wrecker-romp-blue', name: 'Wrecker Romp', pitch: 3, quantity: 2, suggestedCents: 800 },
      { cardIdentifier: 'savage-feast-red', name: 'Savage Feast', pitch: 1, quantity: 1, suggestedCents: 500 },
    ],
  },
  lines: [
    sharedLine({
      id: 1, cardIdentifier: 'pummel-red', name: 'Pummel', quantity: 3, owned: 4, spare: 3, suggestedCents: 400,
      spareVersion: { printingCode: '', edition: '', finish: 'none', condition: '', setName: null },
    }),
    sharedLine({
      id: 2, cardIdentifier: 'command-and-conquer-red', name: 'Command and Conquer', quantity: 1, owned: 2, spare: 1, suggestedCents: 4500,
    }),
    sharedLine({
      id: 3, cardIdentifier: 'sink-below-yellow', name: 'Sink Below', pitch: 2, quantity: 2, owned: 2, spare: 0, suggestedCents: 300,
      spareReason: { deckName: 'Rhinar SA', copies: 2 },
    }),
    sharedLine({ id: 4, cardIdentifier: 'pack-hunt-blue', name: 'Pack Hunt', pitch: 3, quantity: 1, owned: 0, spare: 0 }),
    sharedLine({ id: 5, cardIdentifier: 'bloodrush-bellow-yellow', name: 'Bloodrush Bellow', pitch: 2, quantity: 1, owned: 0, spare: 0 }),
  ],
};
