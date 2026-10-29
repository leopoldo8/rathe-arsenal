import { ApiClient } from './api-client';
import { ConfigError, parseConfig, type ISmokeConfig } from './config';
import { signIn } from './sign-in';
import { describeBody, expect } from './steps';

/**
 * A small deck of real cards from the catalog of @flesh-and-blood/cards (the same identifiers the browser
 * fixture uses in scripts/fixture/fixture-seed.ts): Kayo, a weapon and two actions.
 */
const SMOKE_DECK = {
  name: 'Smoke deck',
  hero: 'kayo-armed-and-dangerous',
  format: 'Classic Constructed',
  cards: [
    { slot: 'hero', cardIdentifier: 'kayo-armed-and-dangerous', quantity: 1 },
    { slot: 'weapon', cardIdentifier: 'mandible-claw', quantity: 1 },
    { slot: 'mainboard', cardIdentifier: 'pulping-red', quantity: 3 },
    { slot: 'mainboard', cardIdentifier: 'wild-ride-red', quantity: 3 },
  ],
} as const;

interface IDeckList {
  readonly trackedDecks: readonly { readonly id: number; readonly name: string }[];
}

async function must(api: ApiClient, method: string, path: string, body?: unknown, ok = 200): Promise<unknown> {
  const res = await api.request(method, path, body === undefined ? {} : { body });
  expect(res.status === ok || (ok === 200 && res.status === 201), `${method} ${path} answered ${res.status} (${describeBody(res.text)})`);
  return res.json;
}

/** Creates the smoke deck only when the account has none; never deletes or edits an existing deck. */
export async function ensureSmokeDeck(api: ApiClient): Promise<string> {
  const list = (await must(api, 'GET', '/api/decks')) as IDeckList;
  if (list.trackedDecks.length > 0) {
    const extra = list.trackedDecks.length > 1 ? ` (it has ${list.trackedDecks.length}; the smoke opens the first and nothing deletes the rest)` : '';
    return `already has a deck ("${list.trackedDecks[0]?.name}")${extra}; nothing created`;
  }
  const created = (await must(api, 'POST', '/api/decks', { heroIdentifier: SMOKE_DECK.hero, format: SMOKE_DECK.format }, 201)) as { id: number };
  await must(api, 'PUT', `/api/decks/${created.id}`, { heroIdentifier: SMOKE_DECK.hero, format: SMOKE_DECK.format, cards: SMOKE_DECK.cards });
  await must(api, 'PATCH', `/api/decks/${created.id}`, { name: SMOKE_DECK.name, status: 'building' });
  return `created deck ${created.id} ("${SMOKE_DECK.name}")`;
}

async function main(): Promise<void> {
  let config: ISmokeConfig;
  try {
    config = parseConfig(process.env);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error(`smoke setup config error: ${error.message}`);
    process.exit(2);
  }
  if (config.signIn === 'none') {
    console.error('smoke setup needs SMOKE_SIGN_IN=code or password: it signs in as the smoke account');
    process.exit(2);
  }
  const api = new ApiClient(config.baseUrl);
  try {
    await signIn(api, config);
    console.log(`smoke account ${config.email}: ${await ensureSmokeDeck(api)}`);
  } catch (error) {
    console.error(`SMOKE SETUP FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    if (api.hasSession) await api.request('POST', '/api/auth/sign-out').catch(() => undefined);
  }
  process.exit(process.exitCode ?? 0);
}

if (require.main === module) void main();
