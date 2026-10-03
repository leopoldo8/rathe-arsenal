/**
 * Idempotent seed for the browser-test fixture user, driven over HTTP so it
 * exercises the same API the app uses. Safe to run any number of times; the
 * only sign-in it performs is the one in `seedFixture`.
 */

export interface IFixtureCredentials {
  readonly baseUrl: string;
  readonly email: string;
  readonly password: string;
}

export interface IFixtureHandles {
  readonly jwt: string;
  readonly swapDeckId: number;
  readonly readyDeckId: number;
}

interface IDeckSummary {
  readonly id: number;
  readonly name: string;
  readonly fabraryUlid: string | null;
  readonly tags: readonly string[];
}

interface ISwapRow {
  readonly id: string;
}

export const SWAP_DECK_NAME = 'Rhinar Swap Test';
export const FIXTURE_TAG = 'liga local';

const SWAP_DECK_HERO = 'rhinar-reckless-rampage';
const FABRARY_DECK_URLS = [
  'https://fabrary.net/decks/01J027FSFWMBYYDR457YVXM5QT',
  'https://fabrary.net/decks/01HYW5BJE6PD6K25Z3SK758DE8',
];
const MIN_PENDING_SWAPS = 3;
const SIGN_IN_RETRY_MS = 15_000;
const SIGN_IN_MAX_WAIT_MS = 150_000;

// Cards the user must own for the swap deck below to produce its pending
// swaps. The deck's pitch curve has to stay within the engine's tolerance,
// which is why the exact-match padding is part of the contract.
const REQUIRED_OWNED: Readonly<Record<string, number>> = {
  'erase-face-red': 3,
  'assault-and-battery-blue': 3,
  'bloodrush-bellow-yellow': 3,
  'cast-bones-red': 3,
  'wild-ride-red': 3,
  'savage-feast-red': 3,
  'pulping-red': 3,
  'send-packing-yellow': 3,
  'wild-ride-yellow': 3,
  'riled-up-blue': 3,
  'smash-instinct-blue': 3,
  'run-roughshod-blue': 3,
};

// Exact-match padding first, then the three cards whose same-profile peers
// the user owns: Brothers in Arms -> Erase Face, Bear Hug -> Assault and
// Battery, Argh Smash -> Bloodrush Bellow. Order matters to the engine.
const SWAP_DECK_COMPOSITION: ReadonlyArray<readonly [string, number]> = [
  ['cast-bones-red', 3],
  ['wild-ride-red', 3],
  ['savage-feast-red', 3],
  ['pulping-red', 3],
  ['send-packing-yellow', 3],
  ['wild-ride-yellow', 3],
  ['riled-up-blue', 3],
  ['smash-instinct-blue', 3],
  ['run-roughshod-blue', 3],
  ['brothers-in-arms-red', 3],
  ['show-of-strength-red', 3],
  ['massacre-red', 3],
  ['bear-hug-blue', 2],
  ['bam-bam-yellow', 2],
  ['argh-smash-yellow', 2],
];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(
  baseUrl: string,
  method: string,
  path: string,
  jwt: string | null,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = (text ? JSON.parse(text) : null) as T;
  return { status: res.status, data };
}

async function authed<T>(
  creds: IFixtureCredentials,
  jwt: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const { status, data } = await request<T>(creds.baseUrl, method, path, jwt, body);
  if (status >= 400) {
    throw new Error(`${method} ${path} failed with ${status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function trySignIn(creds: IFixtureCredentials): Promise<string | null> {
  const deadline = Date.now() + SIGN_IN_MAX_WAIT_MS;
  for (;;) {
    const { status, data } = await request<{ jwt?: string }>(
      creds.baseUrl,
      'POST',
      '/auth/sign-in',
      null,
      { email: creds.email, password: creds.password },
    );
    if (status === 200 && data.jwt) return data.jwt;
    if (status !== 429) return null;
    if (Date.now() > deadline) throw new Error('sign-in stayed rate limited for too long');
    await sleep(SIGN_IN_RETRY_MS);
  }
}

async function createVerifiedUser(creds: IFixtureCredentials): Promise<void> {
  const { status, data } = await request<{ _devVerificationLink?: string }>(
    creds.baseUrl,
    'POST',
    '/auth/sign-up',
    null,
    { email: creds.email, password: creds.password },
  );
  if (status >= 400 && status !== 409) {
    throw new Error(`sign-up failed with ${status}: ${JSON.stringify(data)}`);
  }
  const token = data?._devVerificationLink
    ? new URL(data._devVerificationLink).searchParams.get('token')
    : null;
  if (!token) {
    throw new Error(
      `fixture user ${creds.email} cannot sign in and no dev verification link was returned; ` +
        'verify the account by hand or check the password',
    );
  }
  await request(creds.baseUrl, 'POST', '/auth/verify-email', null, { token });
}

async function signInFixtureUser(creds: IFixtureCredentials): Promise<string> {
  const existing = await trySignIn(creds);
  if (existing) return existing;
  await createVerifiedUser(creds);
  const created = await trySignIn(creds);
  if (!created) throw new Error('fixture user could not sign in after sign-up and verification');
  return created;
}

async function listDecks(creds: IFixtureCredentials, jwt: string): Promise<readonly IDeckSummary[]> {
  const { trackedDecks } = await authed<{ trackedDecks: IDeckSummary[] }>(creds, jwt, 'GET', '/decks');
  return trackedDecks;
}

async function ensureOwnedCards(creds: IFixtureCredentials, jwt: string): Promise<void> {
  const { cards } = await authed<{ cards: Array<{ cardIdentifier: string; ownedQuantity: number }> }>(
    creds,
    jwt,
    'GET',
    '/collection/library',
  );
  const owned = new Map(cards.map((card) => [card.cardIdentifier, card.ownedQuantity]));
  for (const [cardIdentifier, wanted] of Object.entries(REQUIRED_OWNED)) {
    const missing = wanted - (owned.get(cardIdentifier) ?? 0);
    if (missing <= 0) continue;
    await authed(creds, jwt, 'POST', '/collection/cards', { cardIdentifier, quantity: missing });
  }
}

async function ensureFabraryDeck(creds: IFixtureCredentials, jwt: string): Promise<number> {
  let decks = await listDecks(creds, jwt);
  if (!decks.some((deck) => deck.fabraryUlid !== null)) {
    await authed(creds, jwt, 'POST', '/decks/import', { urls: FABRARY_DECK_URLS });
    decks = await listDecks(creds, jwt);
  }
  const ready = [...decks].filter((deck) => deck.fabraryUlid !== null).sort((a, b) => a.id - b.id)[0];
  if (!ready) throw new Error('no Fabrary-imported deck available for the fixture user');
  return ready.id;
}

async function ensureTag(creds: IFixtureCredentials, jwt: string): Promise<number> {
  const { tags } = await authed<{ tags: Array<{ id: number; name: string }> }>(creds, jwt, 'GET', '/tags');
  const found = tags.find((tag) => tag.name.toLowerCase() === FIXTURE_TAG);
  if (found) return found.id;
  const created = await authed<{ id: number }>(creds, jwt, 'POST', '/tags', { name: FIXTURE_TAG });
  return created.id;
}

async function ensureSwapDeck(creds: IFixtureCredentials, jwt: string): Promise<number> {
  const decks = await listDecks(creds, jwt);
  let deckId = decks.find((deck) => deck.name === SWAP_DECK_NAME)?.id;
  if (deckId === undefined) {
    const created = await authed<{ id: number }>(creds, jwt, 'POST', '/decks', {
      heroIdentifier: SWAP_DECK_HERO,
      format: 'Classic Constructed',
    });
    deckId = created.id;
  }
  await authed(creds, jwt, 'PUT', `/decks/${deckId}`, {
    heroIdentifier: SWAP_DECK_HERO,
    format: 'Classic Constructed',
    cards: SWAP_DECK_COMPOSITION.map(([cardIdentifier, quantity]) => ({
      cardIdentifier,
      quantity,
      slot: 'mainboard',
    })),
  });
  const tagId = await ensureTag(creds, jwt);
  await authed(creds, jwt, 'PATCH', `/decks/${deckId}`, {
    name: SWAP_DECK_NAME,
    status: 'building',
    addTagIds: [tagId],
  });
  return deckId;
}

async function listSwaps(creds: IFixtureCredentials, jwt: string, state: string): Promise<readonly ISwapRow[]> {
  const { rows } = await authed<{ rows: ISwapRow[] }>(creds, jwt, 'GET', `/swaps?state=${state}`);
  return rows;
}

async function pruneExtraDecks(creds: IFixtureCredentials, jwt: string): Promise<void> {
  const decks = await listDecks(creds, jwt);
  for (const deck of decks) {
    if (deck.fabraryUlid !== null || deck.name === SWAP_DECK_NAME) continue;
    await authed(creds, jwt, 'DELETE', `/decks/${deck.id}`);
  }
}

/**
 * Puts the fixture user back to the state the specs assume: every swap pending,
 * and no decks beyond the imported ones and the swap deck.
 */
export async function resetFixtureState(creds: IFixtureCredentials, jwt: string): Promise<void> {
  await pruneExtraDecks(creds, jwt);
  for (const row of await listSwaps(creds, jwt, 'approved')) {
    await authed(creds, jwt, 'POST', `/swaps/${row.id}/revert`);
  }
  for (const row of await listSwaps(creds, jwt, 'rejected')) {
    await authed(creds, jwt, 'POST', `/swaps/${row.id}/restore`);
  }
  const pending = await listSwaps(creds, jwt, 'pending');
  if (pending.length < MIN_PENDING_SWAPS) {
    throw new Error(`expected at least ${MIN_PENDING_SWAPS} pending swaps, found ${pending.length}`);
  }
}

export async function seedFixture(creds: IFixtureCredentials): Promise<IFixtureHandles> {
  const jwt = await signInFixtureUser(creds);
  await ensureOwnedCards(creds, jwt);
  const readyDeckId = await ensureFabraryDeck(creds, jwt);
  const swapDeckId = await ensureSwapDeck(creds, jwt);
  await resetFixtureState(creds, jwt);
  return { jwt, swapDeckId, readyDeckId };
}

export async function approveSwaps(creds: IFixtureCredentials, jwt: string, count: number): Promise<void> {
  const pending = await listSwaps(creds, jwt, 'pending');
  if (pending.length < count) throw new Error(`cannot approve ${count} swaps, only ${pending.length} pending`);
  for (const row of pending.slice(0, count)) {
    await authed(creds, jwt, 'POST', `/swaps/${row.id}/approve`);
  }
}
