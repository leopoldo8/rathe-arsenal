export type TSignInMode = 'code' | 'password' | 'none';
export type TInboxKind = 'resend' | 'dev-response';

export interface ISmokeConfig {
  /** Origin of the deployed environment, no trailing slash. */
  readonly baseUrl: string;
  readonly signIn: TSignInMode;
  readonly email: string | null;
  readonly password: string | null;
  readonly inbox: TInboxKind | null;
  readonly resendApiKey: string | null;
  /** When set, the run first waits until /api/health reports this commit. */
  readonly expectCommit: string | null;
  readonly turnstileToken: string | null;
  readonly commitWaitMs: number;
  readonly codeWaitMs: number;
  /** Hard bound on the whole run, sign-out included. */
  readonly totalTimeoutMs: number;
}

export class ConfigError extends Error {}

export type TEnv = Readonly<Record<string, string | undefined>>;

const DEFAULT_COMMIT_WAIT_MS = 10 * 60_000;
const DEFAULT_CODE_WAIT_MS = 90_000;
const DEFAULT_WORK_BUDGET_MS = 4 * 60_000;

/** GitHub passes an unset secret as an empty string, so empty counts as unset. */
function read(env: TEnv, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

function readMs(env: TEnv, name: string, fallback: number): number {
  const raw = read(env, name);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new ConfigError(`${name} must be a positive whole number of milliseconds, got "${raw}"`);
  return parsed;
}

function parseBaseUrl(raw: string | null): string {
  if (raw === null) throw new ConfigError('SMOKE_BASE_URL is required (the origin of the environment to check)');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError('SMOKE_BASE_URL is not a valid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ConfigError('SMOKE_BASE_URL must start with http:// or https://');
  return url.origin;
}

function parseSignIn(raw: string | null): TSignInMode {
  if (raw === 'code' || raw === 'password' || raw === 'none') return raw;
  throw new ConfigError('SMOKE_SIGN_IN is required and must be one of: code, password, none');
}

function parseInbox(raw: string | null): TInboxKind | null {
  if (raw === null) return null;
  if (raw === 'resend' || raw === 'dev-response') return raw;
  throw new ConfigError('SMOKE_INBOX must be resend or dev-response');
}

export function parseConfig(env: TEnv): ISmokeConfig {
  const baseUrl = parseBaseUrl(read(env, 'SMOKE_BASE_URL'));
  const signIn = parseSignIn(read(env, 'SMOKE_SIGN_IN'));
  const email = read(env, 'SMOKE_EMAIL');
  const password = read(env, 'SMOKE_PASSWORD');
  const inbox = parseInbox(read(env, 'SMOKE_INBOX'));
  const resendApiKey = read(env, 'RESEND_INBOUND_API_KEY');
  const expectCommit = read(env, 'SMOKE_EXPECT_COMMIT');

  if (signIn !== 'none' && email === null) throw new ConfigError(`SMOKE_EMAIL is required when SMOKE_SIGN_IN is ${signIn}`);
  if (signIn === 'password' && password === null) throw new ConfigError('SMOKE_PASSWORD is required when SMOKE_SIGN_IN is password');
  if (signIn === 'code' && inbox === null) throw new ConfigError('SMOKE_INBOX is required when SMOKE_SIGN_IN is code (resend or dev-response)');
  if (signIn === 'code' && inbox === 'resend' && resendApiKey === null) {
    throw new ConfigError('RESEND_INBOUND_API_KEY is required when SMOKE_INBOX is resend');
  }
  if (expectCommit !== null && !/^[0-9a-f]{7,40}$/i.test(expectCommit)) {
    throw new ConfigError('SMOKE_EXPECT_COMMIT must be a git commit SHA (7 to 40 hex characters)');
  }

  const commitWaitMs = readMs(env, 'SMOKE_COMMIT_WAIT_MS', DEFAULT_COMMIT_WAIT_MS);
  const codeWaitMs = readMs(env, 'SMOKE_CODE_WAIT_MS', DEFAULT_CODE_WAIT_MS);
  const workBudgetMs = DEFAULT_WORK_BUDGET_MS + (signIn === 'code' ? codeWaitMs : 0);
  const totalTimeoutMs = readMs(env, 'SMOKE_TOTAL_TIMEOUT_MS', (expectCommit === null ? 0 : commitWaitMs) + workBudgetMs);

  return {
    baseUrl,
    signIn,
    email: email?.toLowerCase() ?? null,
    password,
    inbox,
    resendApiKey,
    expectCommit,
    turnstileToken: read(env, 'SMOKE_TURNSTILE_TOKEN'),
    commitWaitMs,
    codeWaitMs,
    totalTimeoutMs,
  };
}
