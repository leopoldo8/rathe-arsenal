import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { ConfigError, parseConfig, type ISmokeConfig, type TEnv } from './config';

export type TTargetEnvironment = 'staging' | 'production';

export interface IConfigureOptions {
  readonly environment: TTargetEnvironment;
  /** Skip the final workflow run. */
  readonly noRun: boolean;
  /** Do steps 1 to 5 for real; print the GitHub commands instead of running the writing ones. */
  readonly dryRun: boolean;
}

export interface IPrompter {
  /** Asks one question; a secret answer is not echoed. Rejects with a ConfigError when there is no answer. */
  ask(label: string, secret: boolean): Promise<string>;
  close(): void;
}

export const USAGE = 'usage: pnpm smoke:configure <staging|production> [--no-run] [--dry-run]';

export function parseArgs(argv: readonly string[]): IConfigureOptions {
  let environment: TTargetEnvironment | null = null;
  let noRun = false;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--no-run') noRun = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === 'staging' || arg === 'production') {
      if (environment !== null) throw new ConfigError(`more than one environment given. ${USAGE}`);
      environment = arg;
    } else throw new ConfigError(`unknown argument "${arg}". ${USAGE}`);
  }
  if (environment === null) throw new ConfigError(`name the environment to configure. ${USAGE}`);
  return { environment, noRun, dryRun };
}

export interface IInputs {
  readonly config: ISmokeConfig;
  /** The raw values, as the GitHub Environment secrets need them. */
  readonly secrets: Readonly<Record<'SMOKE_BASE_URL' | 'SMOKE_EMAIL' | 'SMOKE_PASSWORD', string>>;
}

const FIELDS = [
  { name: 'SMOKE_BASE_URL', label: 'Base URL of the environment (https://...)', secret: false },
  { name: 'SMOKE_EMAIL', label: 'Smoke account e-mail', secret: false },
  { name: 'SMOKE_PASSWORD', label: 'Smoke account password (not shown)', secret: true },
] as const;

/** Each value comes from the environment when set (empty counts as unset), otherwise from the prompt. */
export async function readInputs(env: TEnv, prompter: IPrompter): Promise<IInputs> {
  const values: Record<string, string> = {};
  for (const field of FIELDS) {
    const fromEnv = env[field.name]?.trim();
    values[field.name] = fromEnv ? fromEnv : (await prompter.ask(field.label, field.secret)).trim();
    if (!values[field.name]) throw new ConfigError(`${field.name} is required`);
  }
  const config = parseConfig({ ...values, SMOKE_SIGN_IN: 'password' });
  return {
    config,
    secrets: {
      SMOKE_BASE_URL: config.baseUrl,
      SMOKE_EMAIL: config.email ?? '',
      SMOKE_PASSWORD: values['SMOKE_PASSWORD'] ?? '',
    },
  };
}

/** A prompter on the terminal. With a TTY the secret answer is not echoed; with piped input it reads one line per question. */
export function createTerminalPrompter(input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout): IPrompter {
  const tty = Boolean((input as NodeJS.ReadStream).isTTY);
  let muted = false;
  const gate = new Writable({
    write(chunk, encoding, callback): void {
      if (!muted) output.write(chunk, encoding as BufferEncoding);
      callback();
    },
  });
  const rl = createInterface({ input, output: gate, terminal: tty });
  const lines = rl[Symbol.asyncIterator]();
  return {
    async ask(label, secret): Promise<string> {
      output.write(`${label}: `);
      muted = secret;
      try {
        const next = await lines.next();
        if (next.done) throw new ConfigError(`no answer for "${label}" (input ended); set it in the environment instead`);
        return next.value;
      } finally {
        muted = false;
        if (secret) output.write('\n');
      }
    },
    close: () => rl.close(),
  };
}
