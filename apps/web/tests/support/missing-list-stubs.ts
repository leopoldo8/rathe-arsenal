import type { Page } from '@playwright/test';

/**
 * A missing list shaped like `r3-list-phone` and `r3-list-desktop`: 43 copies to buy for R$ 452,28
 * over 19 cards, 14 copies the store lacks and 2 off the site. The list is served from this stub so the
 * screens never depend on the fixture user's collection or on what the store holds today.
 */
const PRICED: ReadonlyArray<readonly [string, string, number, number, number, number, boolean, boolean]> = [
  ['alpha-rampage-red', 'Alpha Rampage', 1, 1, 15000, 15000, true, true],
  ['bloodrush-bellow-yellow', 'Bloodrush Bellow', 2, 3, 6999, 13998, false, false],
  ['savage-swing-red', 'Savage Swing', 1, 1, 20, 20, false, false],
  ['pack-hunt-red', 'Pack Hunt', 1, 3, 20, 60, false, false],
  ['barkbone-strapping', 'Barkbone Strapping', 0, 1, 4490, 4490, true, false],
  ['scabskin-leathers', 'Scabskin Leathers', 0, 1, 5990, 5990, false, false],
  ['romping-club', 'Romping Club', 0, 1, 2490, 2490, false, false],
  ['smash-instinct-red', 'Smash Instinct', 1, 3, 20, 60, false, false],
  ['wrecker-romp-blue', 'Wrecker Romp', 3, 3, 20, 60, false, false],
  ['savage-feast-yellow', 'Savage Feast', 2, 3, 20, 60, false, false],
  ['breakneck-battery-red', 'Breakneck Battery', 1, 3, 20, 60, false, false],
  ['barraging-beatdown-blue', 'Barraging Beatdown', 3, 3, 20, 60, false, false],
  ['enlightened-strike-red', 'Enlightened Strike', 1, 3, 150, 450, false, false],
  ['sink-below-red', 'Sink Below', 1, 3, 390, 1170, false, false],
  ['command-and-conquer-red', 'Command and Conquer', 1, 3, 250, 750, false, false],
  ['pummel-red', 'Pummel', 1, 3, 90, 270, false, false],
  ['tenacity-blue', 'Tenacity', 3, 3, 50, 150, false, false],
  ['sigil-of-solace-red', 'Sigil of Solace', 1, 3, 30, 90, false, false],
  ['barraging-brawnhide-red', 'Barraging Brawnhide', 1, 3, 20, 60, false, false],
];

/** A 1 by 1 picture served inline, so the row image loads with no network. */
const STUB_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

/** The one stand-in of the list: a Bloodrush Bellow in red covers one of the three yellow copies. */
const STAND_IN = {
  cardIdentifier: 'bloodrush-bellow-red',
  name: 'Bloodrush Bellow',
  pitch: 1,
  copies: 1,
  savingCents: 6999,
  used: false,
  replacementId: null,
};

function pricedLine([cardIdentifier, name, pitch, needed, unit, total, foilOnly, promoOnly]: (typeof PRICED)[number]) {
  return {
    cardIdentifier,
    slot: 'mainboard',
    name,
    pitch: pitch === 0 ? null : pitch,
    imageUrl: cardIdentifier === 'alpha-rampage-red' ? STUB_IMAGE : null,
    deckNeeded: needed,
    inventoryNeeded: 0,
    deckQuantity: 3,
    ownedTotal: cardIdentifier === 'savage-swing-red' ? 2 : 0,
    ownedElsewhere: 0,
    state: 'priced',
    unitPriceCents: unit,
    lineCents: total,
    availableCopies: needed,
    foilOnly,
    promoOnly,
    productUrl: `https://www.cupuladt.com.br/?view=ecom/item&id=${cardIdentifier}`,
    searchUrl: null,
    standIn: cardIdentifier === 'bloodrush-bellow-yellow' ? STAND_IN : null,
  };
}

function lacksLine(cardIdentifier: string, name: string, pitch: number | null, needed: number) {
  return { ...pricedLine([cardIdentifier, name, pitch ?? 0, needed, 0, 0, false, false]), state: 'store_lacks', unitPriceCents: null, lineCents: null, availableCopies: null, productUrl: null };
}

export function missingListStub() {
  const lines = [
    ...PRICED.map(pricedLine),
    lacksLine('reckless-swing-blue', 'Reckless Swing', 3, 3),
    lacksLine('sand-sketched-plan-blue', 'Sand Sketched Plan', 3, 3),
    lacksLine('bone-head-barrier-yellow', 'Bone Head Barrier', 2, 3),
    lacksLine('primeval-bellow-red', 'Primeval Bellow', 1, 2),
    lacksLine('fyendals-spring-tunic', "Fyendal's Spring Tunic", null, 1),
    lacksLine('nullrune-hood', 'Nullrune Hood', null, 1),
    lacksLine('bloodrush-bellow-yellow-spare', 'Bloodrush Bellow', 2, 1),
    {
      ...lacksLine('snapdragon-scalers', 'Snapdragon Scalers', null, 1),
      state: 'not_on_site',
      searchUrl: 'https://www.cupuladt.com.br/?view=ecom/itens&busca=Snapdragon%20Scalers',
    },
    {
      ...lacksLine('crater-fist', 'Crater Fist', null, 1),
      state: 'not_on_site',
      searchUrl: 'https://www.cupuladt.com.br/?view=ecom/itens&busca=Crater%20Fist',
    },
  ];
  return {
    summary: {
      totalCopies: 66,
      buyCopies: 43,
      buyCents: 45228,
      lacksCopies: 14,
      notOnSiteCopies: 2,
      ownedCopies: 5,
      standInCopies: 2,
      lookingUp: 0,
      noPrice: 0,
      availabilityCheckedAt: '2026-10-19T12:00:00.000Z',
      priceValidDays: 30,
    },
    lines,
  };
}

/** Serves the stub list and a set-owned answer, so the owned stepper has something to answer. */
export async function stubMissingList(page: Page): Promise<void> {
  await page.route('**/api/decks/*/missing', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(missingListStub()) }),
  );
  await page.route('**/api/collection/owned', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ownedTotal: 3, previousManualQuantity: 0 }),
    }),
  );
}
