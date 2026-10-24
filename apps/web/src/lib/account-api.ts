import { authFetch } from './auth-fetch';

export type TStartNext = 'new' | 'password' | 'code';

export interface ICodeRequest {
  /** ISO time the e-mailed code stops working. */
  readonly expiresAt: string;
  /** ISO time "Reenviar" may be offered. */
  readonly resendAfter: string;
}

const JSON_POST = { method: 'POST' } as const;

/** Asks what an address takes next: a new account, a password, or an e-mailed code. */
export async function startAccount(email: string): Promise<TStartNext> {
  const res = await authFetch<{ next: TStartNext }>('/auth/start', { ...JSON_POST, body: JSON.stringify({ email }) });
  return res.next;
}

export function requestSignInCode(email: string, turnstileToken?: string): Promise<ICodeRequest> {
  return authFetch<ICodeRequest>('/auth/codes', {
    ...JSON_POST,
    body: JSON.stringify({ email, ...(turnstileToken !== undefined ? { turnstileToken } : {}) }),
  });
}

export interface IEmailConfirmation {
  /** The page the account was made from, when it kept one. */
  readonly returnPath: string | null;
  /** The address that was confirmed, so a visitor who is not signed in can be offered the code sign-in for it. */
  readonly email: string;
}

export async function confirmEmail(token: string): Promise<IEmailConfirmation> {
  const res = await authFetch<IEmailConfirmation & { verified: true }>('/auth/verify-email', {
    ...JSON_POST,
    body: JSON.stringify({ token }),
  });
  return { returnPath: res.returnPath, email: res.email };
}

/** Sends the signed-in account's confirmation e-mail again. */
export function resendConfirmation(): Promise<void> {
  return authFetch<void>('/auth/resend-verification', JSON_POST);
}

/** Moves an unconfirmed account to a corrected address and sends the confirmation there. */
export function changeAccountEmail(email: string): Promise<{ user: { email: string } }> {
  return authFetch<{ user: { email: string } }>('/auth/me/email', { method: 'PATCH', body: JSON.stringify({ email }) });
}
