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
  /** The `ra_session` cookie value of the fixture user's session (door 17). */
  readonly sessionToken: string;
  readonly swapDeckId: number;
  readonly readyDeckId: number;
}

interface IDeckSummary {
  readonly id: number;
  readonly name: string;
  readonly fabraryUlid: string | null;
  readonly tags: readonly string[];
}

interface IDeckDetail {
  readonly latestSnapshot: {
    readonly breakdown: {
      readonly substituted: readonly { readonly original: { readonly cardIdentifier: string; readonly slot: string } }[];
    };
  } | null;
}

export const SWAP_DECK_NAME = 'Rhinar Swap Test';
export const FIXTURE_TAG = 'liga local';

const SWAP_DECK_HERO = 'rhinar-reckless-rampage';
const FABRARY_DECK_URLS = [
  'https://fabrary.net/decks/01J027FSFWMBYYDR457YVXM5QT',
  'https://fabrary.net/decks/01HYW5BJE6PD6K25Z3SK758DE8',
];
const MIN_SUGGESTIONS = 3;
const SIGN_IN_RETRY_MS = 15_000;
const SIGN_IN_MAX_WAIT_MS = 150_000;

// Cards the user must own for the swap deck below to produce its
// suggestions. The deck's pitch curve has to stay within the engine's tolerance,
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
// Battery, Argh Smash -> Bloodrush Bellow. Order matters to the engine, and so
// does how much is missing: the first swap is tried while every other missing
// copy still counts against the pitch-curve tolerance (red 2, yellow 1, blue
// 1), so the deck leaves exactly red 3, yellow 1 and blue 1 missing. Any more
// and the first swap is rejected and the deck yields fewer than three.
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
  ['bear-hug-blue', 1],
  ['argh-smash-yellow', 1],
];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const SESSION_COOKIE = 'ra_session';

/** The session token a response set in its `ra_session` cookie, or null when it set none. */
function sessionTokenOf(res: Response): string | null {
  for (const header of res.headers.getSetCookie()) {
    const [pair] = header.split(';');
    if (pair?.startsWith(`${SESSION_COOKIE}=`)) return pair.slice(SESSION_COOKIE.length + 1);
  }
  return null;
}

/** Sends the session as a `Cookie` header, as a browser would; no bearer header exists any more (door 17). */
async function request<T>(
  baseUrl: string,
  method: string,
  path: string,
  sessionToken: string | null,
  body?: unknown,
): Promise<{ status: number; data: T; sessionToken: string | null }> {
  const res = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Cookie: `${SESSION_COOKIE}=${sessionToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = (text ? JSON.parse(text) : null) as T;
  return { status: res.status, data, sessionToken: sessionTokenOf(res) };
}

async function authed<T>(
  creds: IFixtureCredentials,
  sessionToken: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const { status, data } = await request<T>(creds.baseUrl, method, path, sessionToken, body);
  if (status >= 400) {
    throw new Error(`${method} ${path} failed with ${status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function trySignIn(creds: IFixtureCredentials): Promise<string | null> {
  const deadline = Date.now() + SIGN_IN_MAX_WAIT_MS;
  for (;;) {
    const { status, sessionToken } = await request<unknown>(
      creds.baseUrl,
      'POST',
      '/auth/sign-in',
      null,
      { email: creds.email, password: creds.password },
    );
    if (status === 200 && sessionToken) return sessionToken;
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

async function listDecks(creds: IFixtureCredentials, sessionToken: string): Promise<readonly IDeckSummary[]> {
  const { trackedDecks } = await authed<{ trackedDecks: IDeckSummary[] }>(creds, sessionToken, 'GET', '/decks');
  return trackedDecks;
}

async function ensureOwnedCards(creds: IFixtureCredentials, sessionToken: string): Promise<void> {
  const { cards } = await authed<{ cards: Array<{ cardIdentifier: string; ownedQuantity: number }> }>(
    creds,
    sessionToken,
    'GET',
    '/collection/library',
  );
  const owned = new Map(cards.map((card) => [card.cardIdentifier, card.ownedQuantity]));
  for (const [cardIdentifier, wanted] of Object.entries(REQUIRED_OWNED)) {
    const missing = wanted - (owned.get(cardIdentifier) ?? 0);
    if (missing <= 0) continue;
    await authed(creds, sessionToken, 'POST', '/collection/cards', { cardIdentifier, quantity: missing });
  }
}

/**
 * A Fabrary deck whose saved lines are gone (the API suites that share this database rebuild its
 * tables) still lists and opens, but its rules verdict and card list no longer match the baselines.
 * The decks are removed together so the re-import keeps the original order and the first one stays
 * the ready deck.
 */
async function dropHollowFabraryDecks(creds: IFixtureCredentials, sessionToken: string): Promise<void> {
  const fabraryDecks = (await listDecks(creds, sessionToken)).filter((deck) => deck.fabraryUlid !== null);
  const details = await Promise.all(
    fabraryDecks.map((deck) => authed<{ cards: readonly unknown[] }>(creds, sessionToken, 'GET', `/decks/${deck.id}`)),
  );
  if (details.every((detail) => detail.cards.length > 0)) return;
  for (const deck of fabraryDecks) {
    await authed(creds, sessionToken, 'DELETE', `/decks/${deck.id}/permanent`);
  }
}

async function ensureFabraryDeck(creds: IFixtureCredentials, sessionToken: string): Promise<number> {
  await dropHollowFabraryDecks(creds, sessionToken);
  let decks = await listDecks(creds, sessionToken);
  if (!decks.some((deck) => deck.fabraryUlid !== null)) {
    await authed(creds, sessionToken, 'POST', '/decks/import', { urls: FABRARY_DECK_URLS });
    decks = await listDecks(creds, sessionToken);
  }
  const ready = [...decks].filter((deck) => deck.fabraryUlid !== null).sort((a, b) => a.id - b.id)[0];
  if (!ready) throw new Error('no Fabrary-imported deck available for the fixture user');
  return ready.id;
}

async function ensureTag(creds: IFixtureCredentials, sessionToken: string): Promise<number> {
  const { tags } = await authed<{ tags: Array<{ id: number; name: string }> }>(creds, sessionToken, 'GET', '/tags');
  const found = tags.find((tag) => tag.name.toLowerCase() === FIXTURE_TAG);
  if (found) return found.id;
  const created = await authed<{ id: number }>(creds, sessionToken, 'POST', '/tags', { name: FIXTURE_TAG });
  return created.id;
}

async function putSwapDeckComposition(creds: IFixtureCredentials, sessionToken: string, deckId: number): Promise<void> {
  await authed(creds, sessionToken, 'PUT', `/decks/${deckId}`, {
    heroIdentifier: SWAP_DECK_HERO,
    format: 'Classic Constructed',
    cards: SWAP_DECK_COMPOSITION.map(([cardIdentifier, quantity]) => ({
      cardIdentifier,
      quantity,
      slot: 'mainboard',
    })),
  });
}

async function ensureSwapDeck(creds: IFixtureCredentials, sessionToken: string): Promise<number> {
  const decks = await listDecks(creds, sessionToken);
  let deckId = decks.find((deck) => deck.name === SWAP_DECK_NAME)?.id;
  if (deckId === undefined) {
    const created = await authed<{ id: number }>(creds, sessionToken, 'POST', '/decks', {
      heroIdentifier: SWAP_DECK_HERO,
      format: 'Classic Constructed',
    });
    deckId = created.id;
  }
  await putSwapDeckComposition(creds, sessionToken, deckId);
  const tagId = await ensureTag(creds, sessionToken);
  await authed(creds, sessionToken, 'PATCH', `/decks/${deckId}`, {
    name: SWAP_DECK_NAME,
    status: 'building',
    addTagIds: [tagId],
  });
  return deckId;
}

async function pruneExtraDecks(creds: IFixtureCredentials, sessionToken: string): Promise<void> {
  const decks = await listDecks(creds, sessionToken);
  for (const deck of decks) {
    if (deck.fabraryUlid !== null || deck.name === SWAP_DECK_NAME) continue;
    await authed(creds, sessionToken, 'DELETE', `/decks/${deck.id}`);
  }
}

/**
 * Puts the fixture user back to the state the specs assume: the swap deck with
 * its composition (which closes any replacement a spec left behind) and its
 * suggestions, and no decks beyond the imported ones and the swap deck.
 */
export async function resetFixtureState(creds: IFixtureCredentials, sessionToken: string): Promise<void> {
  await pruneExtraDecks(creds, sessionToken);
  const deckId = (await listDecks(creds, sessionToken)).find((deck) => deck.name === SWAP_DECK_NAME)?.id;
  if (deckId === undefined) throw new Error(`the fixture has no deck named ${SWAP_DECK_NAME}`);
  await putSwapDeckComposition(creds, sessionToken, deckId);
  const detail = await authed<IDeckDetail>(creds, sessionToken, 'GET', `/decks/${deckId}`);
  const suggested = new Set(
    (detail.latestSnapshot?.breakdown.substituted ?? []).map(
      (entry) => `${entry.original.cardIdentifier}::${entry.original.slot}`,
    ),
  );
  if (suggested.size < MIN_SUGGESTIONS) {
    throw new Error(`expected at least ${MIN_SUGGESTIONS} suggestions on the swap deck, found ${suggested.size}`);
  }
}

export async function seedFixture(creds: IFixtureCredentials): Promise<IFixtureHandles> {
  const sessionToken = await signInFixtureUser(creds);
  await ensureOwnedCards(creds, sessionToken);
  const readyDeckId = await ensureFabraryDeck(creds, sessionToken);
  const swapDeckId = await ensureSwapDeck(creds, sessionToken);
  await resetFixtureState(creds, sessionToken);
  return { sessionToken, swapDeckId, readyDeckId };
}
