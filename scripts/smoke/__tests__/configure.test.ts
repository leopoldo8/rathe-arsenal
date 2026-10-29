import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiClient, type IApiResponse } from '../api-client';
import { checkHealth, NO_COMMIT_WARNING, runConfigure } from '../configure';
import { parseConfig } from '../config';
import type { IConfigureOptions, IInputs } from '../configure-inputs';
import type { IGhResult, IGhRunner, IGhRunOptions } from '../gh';

const PASSWORD = 'correct-horse-battery';
const inputs: IInputs = {
  config: parseConfig({ SMOKE_BASE_URL: 'https://smoke.example', SMOKE_SIGN_IN: 'password', SMOKE_EMAIL: 'smoke+x@example.com', SMOKE_PASSWORD: PASSWORD }),
  secrets: { SMOKE_BASE_URL: 'https://smoke.example', SMOKE_EMAIL: 'smoke+x@example.com', SMOKE_PASSWORD: PASSWORD },
};
const options = (over: Partial<IConfigureOptions> = {}): IConfigureOptions => ({ environment: 'staging', noRun: false, dryRun: false, ...over });

interface IRecorded {
  readonly args: readonly string[];
  readonly options: IGhRunOptions;
}

function fakeGh(handler: (args: readonly string[], n: number) => Partial<IGhResult> = () => ({})): IGhRunner & { readonly calls: IRecorded[] } {
  const calls: IRecorded[] = [];
  return {
    calls,
    async run(args, runOptions = {}) {
      calls.push({ args, options: runOptions });
      const partial = handler(args, calls.length);
      return { code: 0, stdout: '', stderr: '', ...partial };
    },
  };
}

/** A gh that answers the way the real one does for a healthy setup; runs[] is what `gh run list` returns each time it is asked. */
function healthyGh(runLists: number[][] = [[1], [1, 2]], overrides: (args: readonly string[]) => Partial<IGhResult> | undefined = () => undefined): ReturnType<typeof fakeGh> {
  let listed = 0;
  return fakeGh((args) => {
    const custom = overrides(args);
    if (custom) return custom;
    if (args[0] === 'repo') return { stdout: '{"nameWithOwner":"owner/repo"}' };
    if (args[0] === 'run' && args[1] === 'list') {
      const ids = runLists[Math.min(listed, runLists.length - 1)] ?? [];
      listed += 1;
      return { stdout: JSON.stringify(ids.map((databaseId) => ({ databaseId }))) };
    }
    return {};
  });
}

interface IFakeApiOptions {
  readonly health?: { status: number; body: unknown };
  readonly signInStatus?: number;
  readonly decks?: { id: number; name: string }[];
}

function fakeApi(opts: IFakeApiOptions = {}): { api: ApiClient; calls: string[] } {
  const calls: string[] = [];
  const decks = opts.decks ?? [];
  class Fake extends ApiClient {
    private signedIn = false;
    override get hasSession(): boolean {
      return this.signedIn;
    }
    override async request(method: string, path: string): Promise<IApiResponse> {
      calls.push(`${method} ${path}`);
      const reply = (status: number, body: unknown): IApiResponse => ({ status, headers: new Headers(), text: JSON.stringify(body), json: body });
      if (path === '/api/health') return reply(opts.health?.status ?? 200, opts.health?.body ?? { status: 'ok', commit: 'abc1234' });
      if (path === '/api/auth/sign-in') {
        const status = opts.signInStatus ?? 200;
        this.signedIn = status === 200;
        return reply(status, status === 200 ? { ok: true } : { error: 'invalid' });
      }
      if (path === '/api/auth/sign-out') return reply(204, null);
      if (method === 'GET' && path === '/api/decks') return reply(200, { trackedDecks: decks });
      if (method === 'POST' && path === '/api/decks') return reply(201, { id: 7 });
      return reply(200, {});
    }
  }
  return { api: new Fake('https://smoke.example'), calls };
}

function run(opts: IConfigureOptions, gh: IGhRunner, api: ApiClient): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  return runConfigure(opts, inputs, { gh, log: (l) => out.push(l), warn: (l) => err.push(l), createApi: () => api }).then((code) => ({ code, out, err }));
}

describe('runConfigure', () => {
  it('runs the exact gh commands and sends every secret value on stdin', async () => {
    const gh = healthyGh();
    const { api } = fakeApi();
    const result = await run(options(), gh, api);
    assert.equal(result.code, 0);

    const writes = gh.calls.map((c) => c.args.join(' '));
    assert.deepEqual(writes.slice(0, 2), ['auth status', 'repo view --json nameWithOwner']);
    assert.deepEqual(writes.slice(2, 8), [
      'api --method PUT repos/owner/repo/environments/staging',
      'secret set SMOKE_BASE_URL --env staging --repo owner/repo',
      'secret set SMOKE_EMAIL --env staging --repo owner/repo',
      'secret set SMOKE_PASSWORD --env staging --repo owner/repo',
      'variable set SMOKE_SIGN_IN --env staging --repo owner/repo --body password',
      'run list --repo owner/repo --workflow smoke.yml --event workflow_dispatch --limit 20 --json databaseId',
    ]);
    const stdinOf = (name: string): string | undefined => gh.calls.find((c) => c.args[2] === name)?.options.stdin;
    assert.equal(stdinOf('SMOKE_BASE_URL'), 'https://smoke.example');
    assert.equal(stdinOf('SMOKE_EMAIL'), 'smoke+x@example.com');
    assert.equal(stdinOf('SMOKE_PASSWORD'), PASSWORD);
    assert.ok(writes.includes('workflow run smoke.yml --repo owner/repo -f environment=staging'));
    assert.equal(writes.at(-1), 'run watch 2 --repo owner/repo --exit-status');
    assert.equal(gh.calls.at(-1)?.options.inherit, true);
  });

  it('never puts a value in a command argument or in any output', async () => {
    const gh = healthyGh();
    const { api } = fakeApi();
    const result = await run(options(), gh, api);
    for (const call of gh.calls) for (const arg of call.args) assert.ok(!arg.includes(PASSWORD) && !arg.includes('smoke+x@example.com') && !arg.includes('smoke.example'), `value in args: ${arg}`);
    assert.ok(![...result.out, ...result.err].join('\n').includes(PASSWORD));
  });

  it('exits with the result of the watched run', async () => {
    const gh = healthyGh([[1], [1, 2]], (args) => (args[1] === 'watch' ? { code: 1 } : undefined));
    assert.equal((await run(options(), gh, fakeApi().api)).code, 1);
  });

  it('creates the smoke deck when the account has none, and signs out', async () => {
    const { api, calls } = fakeApi();
    await run(options({ noRun: true }), healthyGh(), api);
    assert.ok(calls.includes('POST /api/decks'));
    assert.equal(calls.at(-1), 'POST /api/auth/sign-out');
  });

  it('leaves an existing deck alone, and the second run changes nothing', async () => {
    const { api, calls } = fakeApi({ decks: [{ id: 3, name: 'My deck' }] });
    const result = await run(options({ noRun: true }), healthyGh(), api);
    assert.ok(!calls.includes('POST /api/decks'));
    assert.ok(result.out.some((l) => l.includes('nothing created')));
  });

  it('with --no-run configures GitHub and starts nothing', async () => {
    const gh = healthyGh();
    const result = await run(options({ noRun: true }), gh, fakeApi().api);
    assert.equal(result.code, 0);
    assert.ok(!gh.calls.some((c) => c.args[0] === 'workflow' || c.args[0] === 'run'));
  });

  it('with --dry-run signs in for real but runs no writing gh command and shows no value', async () => {
    const gh = healthyGh();
    const { api, calls } = fakeApi();
    const result = await run(options({ dryRun: true }), gh, api);
    assert.equal(result.code, 0);
    assert.deepEqual(gh.calls.map((c) => c.args[0]), ['auth', 'repo']);
    assert.ok(calls.includes('POST /api/auth/sign-in'));
    const text = result.out.filter((l) => l.startsWith('  gh ')).join('\n');
    assert.ok(text.includes('gh secret set SMOKE_PASSWORD --env staging --repo owner/repo < <SMOKE_PASSWORD value>'));
    assert.ok(text.includes('gh workflow run smoke.yml --repo owner/repo -f environment=staging'));
    assert.ok(!text.includes(PASSWORD) && !text.includes('smoke+x@example.com') && !text.includes('smoke.example'));
    assert.ok(!result.out.join('\n').includes(PASSWORD));
  });

  it('warns about a null commit and keeps going', async () => {
    const { api } = fakeApi({ health: { status: 200, body: { status: 'ok', commit: null } } });
    const result = await run(options({ noRun: true }), healthyGh(), api);
    assert.equal(result.code, 0);
    assert.ok(result.err.includes(NO_COMMIT_WARNING));
    assert.match(NO_COMMIT_WARNING, /only for deploys triggered from GitHub.*10 minutes/);
  });

  it('does not warn when health reports a commit', async () => {
    const result = await run(options({ noRun: true }), healthyGh(), fakeApi().api);
    assert.equal(result.err.length, 0);
  });
});

describe('runConfigure failures', () => {
  it('fails when gh is not signed in, before touching the environment', async () => {
    const { api, calls } = fakeApi();
    const result = await run(options(), fakeGh((args) => (args[0] === 'auth' ? { code: 1, stderr: 'not logged in' } : {})), api);
    assert.equal(result.code, 1);
    assert.match(result.err.join('\n'), /gh is not signed in/);
    assert.equal(calls.length, 0);
  });

  it('fails when the repository cannot be resolved', async () => {
    const result = await run(options(), fakeGh((args) => (args[0] === 'repo' ? { code: 1, stderr: 'no git remotes' } : {})), fakeApi().api);
    assert.equal(result.code, 1);
    assert.match(result.err.join('\n'), /gh repo view/);
  });

  it('fails when health is not status ok', async () => {
    const gh = healthyGh();
    const result = await run(options(), gh, fakeApi({ health: { status: 200, body: { status: 'degraded' } } }).api);
    assert.equal(result.code, 1);
    assert.match(result.err.join('\n'), /not status ok/);
    assert.ok(!gh.calls.some((c) => c.args[0] === 'secret'));
  });

  it('fails clearly on a wrong password and sets nothing on GitHub', async () => {
    const gh = healthyGh();
    const result = await run(options(), gh, fakeApi({ signInStatus: 401 }).api);
    assert.equal(result.code, 1);
    assert.match(result.err.join('\n'), /Wrong password/);
    assert.ok(!gh.calls.some((c) => c.args[0] === 'secret' || c.args[0] === 'api'));
  });

  it('fails when a gh write fails and stops there', async () => {
    const gh = healthyGh([[1]], (args) => (args[2] === 'SMOKE_EMAIL' ? { code: 1, stderr: 'HTTP 403' } : undefined));
    const result = await run(options(), gh, fakeApi().api);
    assert.equal(result.code, 1);
    assert.match(result.err.join('\n'), /set secret SMOKE_EMAIL failed.*403/);
    assert.ok(!gh.calls.some((c) => c.args[2] === 'SMOKE_PASSWORD'));
  });

  it('scrubs the password from a failure message', async () => {
    const gh = healthyGh([[1]], (args) => (args[2] === 'SMOKE_EMAIL' ? { code: 1, stderr: `echoed ${PASSWORD}` } : undefined));
    const result = await run(options(), gh, fakeApi().api);
    assert.ok(!result.err.join('\n').includes(PASSWORD));
  });

  it('fails when the started run never shows up', async () => {
    const err: string[] = [];
    const code = await runConfigure(options(), inputs, {
      gh: healthyGh([[1]]),
      log: () => undefined,
      warn: (l) => err.push(l),
      createApi: () => fakeApi().api,
      runOptions: { findAttempts: 3, sleep: async () => undefined },
    });
    assert.equal(code, 1);
    assert.match(err.join('\n'), /did not show up/);
  });
});

describe('checkHealth', () => {
  it('fails on a non-200 answer', async () => {
    await assert.rejects(checkHealth(fakeApi({ health: { status: 503, body: { status: 'ok' } } }).api, () => undefined), /answered 503/);
  });
});
