import { ApiClient } from './api-client';
import { ConfigError, type ISmokeConfig } from './config';
import { createTerminalPrompter, parseArgs, readInputs, type IConfigureOptions, type IInputs, type IPrompter } from './configure-inputs';
import { applyEnvironment, environmentSteps, formatStep, realGhRunner, resolveRepo, startAndWatch, workflowStep, type IGhRunner, type IRunOptions } from './gh';
import { signIn } from './sign-in';
import { ensureSmokeDeck } from './setup';
import { describeBody, expect } from './steps';

export interface IConfigureDeps {
  readonly gh: IGhRunner;
  readonly log: (line: string) => void;
  readonly warn: (line: string) => void;
  readonly createApi?: (baseUrl: string) => ApiClient;
  /** Lets tests skip the waits while looking for the new workflow run. */
  readonly runOptions?: IRunOptions;
}

export const NO_COMMIT_WARNING =
  'warning: /api/health reports no commit. Railway sets the commit only for deploys triggered from GitHub, so a push run would wait 10 minutes for a commit that never shows up and then fail. Check that this web service deploys from GitHub.';

/** Step 3: the environment answers status ok; a missing commit is a warning, not a failure. */
export async function checkHealth(api: ApiClient, warn: (line: string) => void): Promise<void> {
  const res = await api.request('GET', '/api/health');
  expect(res.status === 200, `/api/health answered ${res.status}, expected 200`);
  const body = res.json as { status?: string; commit?: string | null } | null;
  expect(body?.status === 'ok', `/api/health is not status ok: ${describeBody(res.text)}`);
  if (!body?.commit) warn(NO_COMMIT_WARNING);
}

/** Steps 4 and 5: sign in by password, give the account its deck, sign out. */
async function prepareAccount(api: ApiClient, config: ISmokeConfig, log: (line: string) => void): Promise<void> {
  await signIn(api, config);
  log('ok    signed in by password');
  try {
    log(`ok    smoke account ${config.email}: ${await ensureSmokeDeck(api)}`);
  } finally {
    await api.request('POST', '/api/auth/sign-out').catch(() => undefined);
  }
}

/** Runs the whole command and returns the process exit code. */
export async function runConfigure(options: IConfigureOptions, inputs: IInputs, deps: IConfigureDeps): Promise<number> {
  const { gh, log, warn } = deps;
  const { config, secrets } = inputs;
  const api = (deps.createApi ?? ((url: string) => new ApiClient(url)))(config.baseUrl);
  // A Ctrl+C ends the smoke session first so none stays alive.
  const onSignal = (signal: NodeJS.Signals): void => {
    warn(`received ${signal}, signing out before exit`);
    void api.request('POST', '/api/auth/sign-out').catch(() => undefined).finally(() => process.exit(130));
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    const repo = await resolveRepo(gh);
    log(`ok    gh is ready, repository ${repo}`);
    await checkHealth(api, warn);
    log(`ok    ${config.baseUrl} answers status ok`);
    await prepareAccount(api, config, log);

    const plan = { repo, environment: options.environment, values: secrets };
    if (options.dryRun) {
      log('dry run: these gh commands would run next (secret values go on stdin and are not shown):');
      for (const step of environmentSteps(plan)) log(`  ${formatStep(step)}`);
      if (!options.noRun) log(`  ${formatStep(workflowStep(repo, options.environment))}`);
      if (!options.noRun) log('  gh run watch <new run id> --exit-status');
      return 0;
    }
    await applyEnvironment(gh, plan, (step) => log(`gh    ${step.description}`));
    log(`ok    GitHub environment ${options.environment} is configured`);
    if (options.noRun) return 0;
    return await startAndWatch(gh, repo, options.environment, { log, ...deps.runOptions });
  } catch (error) {
    // The password is checked for here as a last guard: no message may carry it.
    const message = error instanceof Error ? error.message : String(error);
    warn(`SMOKE CONFIGURE FAILED: ${message.split(secrets.SMOKE_PASSWORD).join('***')}`);
    return 1;
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }
}

async function main(): Promise<void> {
  let options: IConfigureOptions;
  let prompter: IPrompter | null = null;
  let inputs: IInputs;
  try {
    options = parseArgs(process.argv.slice(2));
    prompter = createTerminalPrompter();
    inputs = await readInputs(process.env, prompter);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error(`smoke configure error: ${error.message}`);
    process.exit(2);
  } finally {
    prompter?.close();
  }
  const code = await runConfigure(options, inputs, { gh: realGhRunner, log: (line) => console.log(line), warn: (line) => console.error(line) });
  process.exit(code);
}

if (require.main === module) void main();
