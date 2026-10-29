import type { Page } from '@playwright/test';

/**
 * Served answers for the share screens of journey 4 (`r3-share-phone`, `r3-message-phone`, `r3-group-phone`,
 * `r3-group-friend-phone`, `r3-offer-phone`, `r3-quote-phone`), so the layout never depends on the fixture user's
 * deck, collection or on what the store holds today.
 */
export const GROUP_TOKEN = 'mQ8rZ3nUp2bX5yKdFgHjLs';
export const QUOTE_TOKEN = 'qT3rZ9nUp2bX5yKdFgHjLs';

interface IStubCard {
  readonly id: string;
  readonly name: string;
  readonly pitch: 1 | 2 | 3 | null;
  readonly quantity: number;
  readonly state: 'priced' | 'store_lacks' | 'not_on_site' | 'looking_up' | 'no_price';
  readonly price?: number;
  readonly available?: number;
  readonly foilPromo?: boolean;
}

const CARDS: readonly IStubCard[] = [
  { id: 'reckless-swing-blue', name: 'Reckless Swing', pitch: 3, quantity: 3, state: 'store_lacks' },
  { id: 'nullrune-hood', name: 'Nullrune Hood', pitch: null, quantity: 1, state: 'store_lacks' },
  { id: 'sand-sketched-plan-blue', name: 'Sand Sketched Plan', pitch: 3, quantity: 3, state: 'store_lacks' },
  { id: 'bone-head-barrier-yellow', name: 'Bone Head Barrier', pitch: 2, quantity: 3, state: 'store_lacks' },
  { id: 'primeval-bellow-red', name: 'Primeval Bellow', pitch: 1, quantity: 2, state: 'store_lacks' },
  { id: 'bloodrush-bellow-yellow', name: 'Bloodrush Bellow', pitch: 2, quantity: 3, state: 'priced', price: 6999, available: 2 },
  { id: 'fyendals-spring-tunic', name: "Fyendal's Spring Tunic", pitch: null, quantity: 1, state: 'store_lacks' },
  { id: 'snapdragon-scalers', name: 'Snapdragon Scalers', pitch: null, quantity: 1, state: 'not_on_site' },
  { id: 'crater-fist', name: 'Crater Fist', pitch: null, quantity: 1, state: 'not_on_site' },
  { id: 'alpha-rampage-red', name: 'Alpha Rampage', pitch: 1, quantity: 1, state: 'priced', price: 15000, available: 1, foilPromo: true },
  { id: 'savage-swing-red', name: 'Savage Swing', pitch: 1, quantity: 1, state: 'priced', price: 20, available: 1 },
  { id: 'pack-hunt-red', name: 'Pack Hunt', pitch: 1, quantity: 3, state: 'priced', price: 20, available: 3 },
];

function missingCard(card: IStubCard, owned: number | null) {
  const priced = card.state === 'priced';
  return {
    cardIdentifier: card.id,
    name: card.name,
    pitch: card.pitch,
    type: 'Action',
    slot: 'mainboard',
    quantity: card.quantity,
    inventoryQuantity: 0,
    imageUrl: null,
    state: card.state,
    unitPriceCents: priced ? card.price : null,
    lineCents: priced ? (card.price ?? 0) * (card.available ?? 0) : null,
    availableCopies: priced ? card.available : null,
    foilOnly: card.foilPromo === true,
    promoOnly: card.foilPromo === true,
    productUrl: priced ? `https://www.cupuladt.com.br/?view=ecom/item&id=${card.id}` : null,
    owned,
  };
}

/** The group page of "Caio" for the deck "[CC] Brute do Caio"; `owned` gives a signed-in visitor's counts. */
export function groupPageStub(owned: Readonly<Record<string, number>> | null) {
  const copies = CARDS.reduce((sum, card) => sum + card.quantity, 0);
  return {
    intent: 'missing',
    token: GROUP_TOKEN,
    url: `https://rathe-arsenal.app/d/${GROUP_TOKEN}`,
    name: '[CC] Brute do Caio',
    hero: 'Rhinar, Reckless Rampage',
    heroIdentifier: null,
    heroCard: null,
    format: 'Classic Constructed',
    sharerName: 'Caio',
    contactWhatsapp: '5551999990000',
    isOwner: false,
    deckId: null,
    updatedAt: '2026-10-18T12:00:00Z',
    totalCards: 0,
    cards: [],
    missing: CARDS.map((card) => missingCard(card, owned === null ? null : (owned[card.id] ?? 0))),
    missingCount: copies,
    storeSummary: { copies: 6, cents: 13998 + 15000 + 20 + 60 },
    legality: null,
  };
}

const QUOTE_NEEDED: ReadonlyArray<readonly [string, string, 1 | 2 | 3 | null, number]> = [
  ['alpha-rampage-red', 'Alpha Rampage', 1, 1],
  ['bloodrush-bellow-yellow', 'Bloodrush Bellow', 2, 3],
  ['reckless-swing-blue', 'Reckless Swing', 3, 3],
  ['pack-hunt-red', 'Pack Hunt', 1, 3],
];

/** The quote page: the needed cards and nothing about stores. */
export function quotePageStub() {
  return {
    intent: 'quote',
    name: '[CC] Brute do Caio',
    hero: 'Rhinar, Reckless Rampage',
    sharerName: 'Caio',
    contactWhatsapp: '5551999990000',
    needed: QUOTE_NEEDED.map(([cardIdentifier, name, pitch, quantity]) => ({ cardIdentifier, name, pitch, imageUrl: null, quantity })),
  };
}

export async function stubSignedIn(page: Page, extra: Record<string, unknown> = {}): Promise<void> {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'owner-1',
        email: 'caio@test.local',
        role: 'user',
        chatAccess: false,
        emailConfirmed: true,
        hasPassword: true,
        displayName: 'Caio',
        whatsappNumber: '5551999990000',
        shareClosingLine: 'Pago no PIX ou troco. Estou em Pelotas.',
        settings: { theme: 'dark' },
        ...extra,
      }),
    }),
  );
}

/** What the owner's share sheet talks to: the link states, the link creation and the owner's own view of the group page. */
export async function stubOwnerSharing(page: Page): Promise<void> {
  await page.route('**/api/decks/*/share', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const { intent } = request.postDataJSON() as { intent: string };
      const token = intent === 'quote' ? QUOTE_TOKEN : GROUP_TOKEN;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ intent, url: `https://rathe-arsenal.app/d/${token}`, token, showContact: true }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deck: null, missing: null }) });
  });
  await page.route(`**/api/shared/decks/${GROUP_TOKEN}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...groupPageStub(null), isOwner: true, deckId: 7 }) }),
  );
  await page.route('**/api/users/me/share-closing-line', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Pago no PIX ou troco. Estou em Pelotas.' }) }),
  );
}
