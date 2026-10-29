import { ApiClient } from './api-client';
import { checkInBrowser } from './browser';
import { ConfigError, parseConfig, type ISmokeConfig } from './config';
import { waitForCommit } from './health';
import { signIn } from './sign-in';
import { describeBody, expect, runStep, StepFailure, type IStepLog } from './steps';

const HEALTH_POLL_INTERVAL_MS = 10_000;
/** A card name that exists in the catalog of @flesh-and-blood/cards (identifiers pulping-red, -yellow, -blue). */
const SEARCH_QUERY = 'pulping';

interface IDeckList {
  readonly trackedDecks: readonly { readonly id: number; readonly name: string }[];
}

const log: IStepLog = { info: (line) => console.log(line) };

async function checkHealth(api: ApiClient): Promise<void> {
  const res = await api.request('GET', '/api/health');
  expect(res.status === 200, `health answered ${res.status}, expected 200`);
  expect((res.json as { status?: string } | null)?.status === 'ok', `health body is not status ok: ${describeBody(res.text)}`);
}

async function checkSpa(api: ApiClient, path: string): Promise<void> {
  const res = await api.request('GET', path, { headers: { Accept: 'text/html' } });
  expect(res.status === 200, `${path} answered ${res.status}, expected 200`);
  expect((res.headers.get('content-type') ?? '').includes('text/html'), `${path} is not HTML (content-type ${res.headers.get('content-type')})`);
  expect(/id=["']root["']/.test(res.text), `${path} has no app root element; the SPA index is not being served`);
}

async function checkGuard(api: ApiClient): Promise<void> {
  const res = await api.request('GET', `/api/catalog/search?q=${SEARCH_QUERY}`, { withSession: false });
  expect(res.status === 401, `signed-out catalog search answered ${res.status}, expected 401`);
}

async function checkSignedIn(api: ApiClient, config: ISmokeConfig): Promise<number> {
  await runStep('signed in: /api/auth/me is the smoke account', log, async () => {
    const res = await api.request('GET', '/api/auth/me');
    expect(res.status === 200, `/api/auth/me answered ${res.status}, expected 200`);
    const email = ((res.json as { user?: { email?: string }; email?: string } | null)?.user?.email ?? (res.json as { email?: string } | null)?.email ?? '').toLowerCase();
    expect(email === config.email, `/api/auth/me is ${email || 'unknown'}, expected the smoke account`);
  });

  await runStep('signed in: catalog search returns cards', log, async () => {
    const res = await api.request('GET', `/api/catalog/search?q=${SEARCH_QUERY}`);
    expect(res.status === 200, `catalog search answered ${res.status}, expected 200`);
    const results = (res.json as { results?: unknown[] } | null)?.results;
    expect(Array.isArray(results) && results.length >= 1, `catalog search for "${SEARCH_QUERY}" returned no cards`);
  });

  return runStep('signed in: deck list, deck page and missing list answer 200', log, async () => {
    const list = await api.request('GET', '/api/decks');
    expect(list.status === 200, `GET /api/decks answered ${list.status}, expected 200`);
    const first = (list.json as IDeckList | null)?.trackedDecks?.[0];
    expect(first, 'the smoke account has no deck; run pnpm smoke:configure once (see scripts/deploy-railway.md)');
    const detail = await api.request('GET', `/api/decks/${first.id}`);
    expect(detail.status === 200, `GET /api/decks/${first.id} answered ${detail.status}, expected 200`);
    const missing = await api.request('GET', `/api/decks/${first.id}/missing?lookups=read`);
    expect(missing.status === 200, `GET /api/decks/${first.id}/missing answered ${missing.status}, expected 200`);
    return first.id;
  });
}

async function signOut(api: ApiClient): Promise<void> {
  const token = api.session;
  if (token === null) return;
  await runStep('sign out revokes the session', log, async () => {
    const res = await api.request('POST', '/api/auth/sign-out');
    expect(res.status === 204, `sign-out answered ${res.status}, expected 204`);
    const after = await api.request('GET', '/api/auth/me', { withSession: false, headers: { Cookie: `ra_session=${token}` } });
    expect(after.status === 401, `the session still works after sign-out (/api/auth/me answered ${after.status})`);
  });
}

async function work(api: ApiClient, config: ISmokeConfig): Promise<void> {
  if (config.expectCommit !== null) {
    const expected = config.expectCommit;
    await runStep(`deploy is commit ${expected.slice(0, 12)}`, log, () =>
      waitForCommit(
        async () => {
          const res = await api.request('GET', '/api/health');
          const body = res.json as { status?: string; commit?: string | null } | null;
          return { status: body?.status ?? `http ${res.status}`, commit: body?.commit ?? null };
        },
        expected,
        { timeoutMs: config.commitWaitMs, intervalMs: HEALTH_POLL_INTERVAL_MS },
      ),
    );
  }
  await runStep('health answers 200 with status ok', log, () => checkHealth(api));
  await runStep('SPA index / is HTML with the app root', log, () => checkSpa(api, '/'));
  await runStep('SPA route /entrar is HTML with the app root', log, () => checkSpa(api, '/entrar'));
  await runStep('signed out: protected API answers 401', log, () => checkGuard(api));

  if (config.signIn === 'none') {
    await runStep('browser loads the app', log, () => checkInBrowser({ baseUrl: config.baseUrl, sessionToken: null, deckId: null }));
    return;
  }
  await runStep(`sign in (${config.signIn})`, log, () => signIn(api, config));
  const deckId = await checkSignedIn(api, config);
  await runStep('browser loads the app and the signed-in deck page', log, () =>
    checkInBrowser({ baseUrl: config.baseUrl, sessionToken: api.session, deckId }),
  );
}

export async function runSmoke(config: ISmokeConfig): Promise<void> {
  const api = new ApiClient(config.baseUrl);
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StepFailure(`the whole run exceeded ${Math.round(config.totalTimeoutMs / 1000)}s`)), config.totalTimeoutMs);
  });
  // A cancelled workflow run sends SIGINT: end the session first so none stays alive.
  const onSignal = (signal: NodeJS.Signals): void => {
    console.error(`received ${signal}, signing out before exit`);
    void signOut(api).finally(() => process.exit(130));
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  let failure: unknown;
  try {
    await Promise.race([work(api, config), deadline]);
  } catch (error) {
    failure = error;
  } finally {
    clearTimeout(timer);
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    try {
      await signOut(api);
    } catch (error) {
      failure ??= error;
    }
  }
  if (failure !== undefined) throw failure;
}

async function main(): Promise<void> {
  let config: ISmokeConfig;
  try {
    config = parseConfig(process.env);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error(`smoke config error: ${error.message}`);
    process.exit(2);
  }
  console.log(`smoke: ${config.baseUrl} (sign-in ${config.signIn})`);
  try {
    await runSmoke(config);
    console.log('SMOKE PASSED');
    process.exit(0);
  } catch (error) {
    console.error(`SMOKE FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

if (require.main === module) void main();
