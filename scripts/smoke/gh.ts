import { spawn } from 'node:child_process';

export interface IGhResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface IGhRunOptions {
  /** Written to the process's stdin: the way a secret value reaches `gh` without showing in the process list. */
  readonly stdin?: string;
  /** Pass the terminal through (for `gh run watch`) instead of capturing the output. */
  readonly inherit?: boolean;
}

/** Runs `gh`. Faked in tests, so no test touches GitHub. */
export interface IGhRunner {
  run(args: readonly string[], options?: IGhRunOptions): Promise<IGhResult>;
}

export class GhNotInstalledError extends Error {}

export const realGhRunner: IGhRunner = {
  run: (args, options = {}) =>
    new Promise((resolve, reject) => {
      const child = spawn('gh', [...args], { stdio: [options.stdin === undefined ? 'ignore' : 'pipe', options.inherit ? 'inherit' : 'pipe', options.inherit ? 'inherit' : 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
      child.on('error', (error: NodeJS.ErrnoException) => {
        reject(error.code === 'ENOENT' ? new GhNotInstalledError('the GitHub CLI (gh) is not installed; see https://cli.github.com') : error);
      });
      child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
      if (options.stdin !== undefined) {
        child.stdin?.on('error', () => undefined);
        child.stdin?.end(options.stdin);
      }
    }),
};

function fail(what: string, result: IGhResult): Error {
  const detail = (result.stderr || result.stdout).replace(/\s+/g, ' ').trim();
  return new Error(`${what} failed (gh exit ${result.code})${detail ? `: ${detail}` : ''}`);
}

/** Checks gh is installed and signed in, then names the repository the current directory belongs to. */
export async function resolveRepo(gh: IGhRunner): Promise<string> {
  const auth = await gh.run(['auth', 'status']);
  if (auth.code !== 0) throw new Error('gh is not signed in; run `gh auth login` and try again');
  const view = await gh.run(['repo', 'view', '--json', 'nameWithOwner']);
  if (view.code !== 0) throw fail('`gh repo view` (run this from a clone of the GitHub repository)', view);
  let name: unknown;
  try {
    name = (JSON.parse(view.stdout) as { nameWithOwner?: unknown }).nameWithOwner;
  } catch {
    name = undefined;
  }
  if (typeof name !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(name)) throw new Error('`gh repo view` did not return a repository name');
  return name;
}

export interface IGhStep {
  readonly description: string;
  readonly args: readonly string[];
  /** Name of the value sent on stdin; the value itself is held by the caller and never printed. */
  readonly stdinName?: string;
}

export interface IEnvironmentPlan {
  readonly repo: string;
  readonly environment: string;
  readonly values: Readonly<Record<'SMOKE_BASE_URL' | 'SMOKE_EMAIL' | 'SMOKE_PASSWORD', string>>;
}

const SECRET_NAMES = ['SMOKE_BASE_URL', 'SMOKE_EMAIL', 'SMOKE_PASSWORD'] as const;

/** The writing commands of step 6, in order. Secret values are not in the arguments. */
export function environmentSteps(plan: IEnvironmentPlan): readonly IGhStep[] {
  const { repo, environment } = plan;
  return [
    { description: `create the ${environment} environment`, args: ['api', '--method', 'PUT', `repos/${repo}/environments/${environment}`] },
    ...SECRET_NAMES.map((name) => ({
      description: `set secret ${name}`,
      args: ['secret', 'set', name, '--env', environment, '--repo', repo],
      stdinName: name,
    })),
    { description: 'set variable SMOKE_SIGN_IN=password', args: ['variable', 'set', 'SMOKE_SIGN_IN', '--env', environment, '--repo', repo, '--body', 'password'] },
  ];
}

export function workflowStep(repo: string, environment: string): IGhStep {
  return { description: 'start the Smoke workflow', args: ['workflow', 'run', 'smoke.yml', '--repo', repo, '-f', `environment=${environment}`] };
}

/** How a command shows in the output: a value sent on stdin appears as a placeholder, never as itself. */
export function formatStep(step: IGhStep): string {
  const piped = step.stdinName === undefined ? '' : ` < <${step.stdinName} value>`;
  return `gh ${step.args.join(' ')}${piped}`;
}

export async function applyEnvironment(gh: IGhRunner, plan: IEnvironmentPlan, onStep: (step: IGhStep) => void): Promise<void> {
  for (const step of environmentSteps(plan)) {
    onStep(step);
    const stdin = step.stdinName === undefined ? undefined : plan.values[step.stdinName as keyof IEnvironmentPlan['values']];
    const result = await gh.run(step.args, stdin === undefined ? {} : { stdin });
    if (result.code !== 0) throw fail(step.description, result);
  }
}

async function listRunIds(gh: IGhRunner, repo: string): Promise<ReadonlySet<number>> {
  const res = await gh.run(['run', 'list', '--repo', repo, '--workflow', 'smoke.yml', '--event', 'workflow_dispatch', '--limit', '20', '--json', 'databaseId']);
  if (res.code !== 0) throw fail('listing workflow runs', res);
  return new Set((JSON.parse(res.stdout) as { databaseId: number }[]).map((run) => run.databaseId));
}

export interface IRunOptions {
  readonly findAttempts?: number;
  readonly findIntervalMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly log?: (line: string) => void;
}

/** Starts the workflow, finds the run it created (the one id not seen before), follows it and returns its exit code. */
export async function startAndWatch(gh: IGhRunner, repo: string, environment: string, options: IRunOptions = {}): Promise<number> {
  const { log = console.log, findAttempts = 15, findIntervalMs = 2_000, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } = options;
  const before = await listRunIds(gh, repo);
  const started = await gh.run(workflowStep(repo, environment).args);
  if (started.code !== 0) throw fail('starting the Smoke workflow', started);
  for (let attempt = 0; attempt < findAttempts; attempt += 1) {
    const created = [...(await listRunIds(gh, repo))].filter((id) => !before.has(id));
    const id = created.sort((a, b) => b - a)[0];
    if (id !== undefined) {
      log(`following workflow run ${id}`);
      const watched = await gh.run(['run', 'watch', String(id), '--repo', repo, '--exit-status'], { inherit: true });
      return watched.code === 0 ? 0 : 1;
    }
    await sleep(findIntervalMs);
  }
  throw new Error('the workflow was started but its run did not show up in `gh run list`; check the Actions tab');
}
