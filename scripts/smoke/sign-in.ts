import type { ApiClient } from './api-client';
import type { ISmokeConfig } from './config';
import { createResendInbox, waitForCode } from './inbox';
import { describeBody, expect } from './steps';

const CODE_POLL_INTERVAL_MS = 3_000;

/** E-mail + password sign-in: no Turnstile, no e-mail. */
export async function signInWithPassword(api: ApiClient, config: ISmokeConfig): Promise<void> {
  const res = await api.request('POST', '/api/auth/sign-in', { body: { email: config.email, password: config.password } });
  expect(res.status === 200, `sign-in answered ${res.status}, expected 200 (${describeBody(res.text)}). Wrong password, or the account has none.`);
  expect(api.hasSession, 'sign-in answered 200 but set no ra_session cookie');
}

/** Requests an e-mailed code, reads it from the chosen inbox and verifies it. */
export async function signInWithCode(api: ApiClient, config: ISmokeConfig): Promise<void> {
  const requestedAtMs = Date.now();
  const body: Record<string, string> = { email: config.email ?? '' };
  if (config.turnstileToken) body['turnstileToken'] = config.turnstileToken;
  const requested = await api.request('POST', '/api/auth/codes', { body });
  if (requested.status === 429) {
    throw new Error(`the code request is rate limited (Retry-After ${requested.headers.get('retry-after') ?? '?'} s); a failed run that never tried its code uses one of five per hour`);
  }
  expect(requested.status === 202, `the code request answered ${requested.status}, expected 202 (${describeBody(requested.text)}). A 400 or 403 usually means Turnstile refused the token.`);

  const code = config.inbox === 'dev-response' ? devCodeOf(requested.json) : await readCodeFromResend(config, requestedAtMs);

  const verified = await api.request('POST', '/api/auth/codes/verify', { body: { email: config.email, code } });
  expect(verified.status === 200, `code verification answered ${verified.status}, expected 200 (${describeBody(verified.text)})`);
  expect(api.hasSession, 'code verification answered 200 but set no ra_session cookie');
}

function devCodeOf(json: unknown): string {
  const code = (json as { _devCode?: unknown } | null)?._devCode;
  expect(typeof code === 'string' && /^\d{6}$/.test(code), 'the answer has no _devCode; start the API with EXPOSE_DEV_SECRETS=true, and use an address that has an account');
  return code as string;
}

async function readCodeFromResend(config: ISmokeConfig, requestedAtMs: number): Promise<string> {
  expect(config.resendApiKey && config.email, 'RESEND_INBOUND_API_KEY and SMOKE_EMAIL are required to read the inbox');
  try {
    return await waitForCode(createResendInbox(config.resendApiKey), {
      address: config.email,
      requestedAtMs,
      timeoutMs: config.codeWaitMs,
      intervalMs: CODE_POLL_INTERVAL_MS,
    });
  } catch (error) {
    throw new Error(`no sign-in code e-mail reached the inbox: ${(error as Error).message}`);
  }
}

export async function signIn(api: ApiClient, config: ISmokeConfig): Promise<void> {
  if (config.signIn === 'password') return signInWithPassword(api, config);
  if (config.signIn === 'code') return signInWithCode(api, config);
  throw new Error('SMOKE_SIGN_IN is none: there is nothing to sign in with');
}
