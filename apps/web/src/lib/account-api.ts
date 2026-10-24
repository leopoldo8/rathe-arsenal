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

export function requestSignInCode(email: string): Promise<ICodeRequest> {
  return authFetch<ICodeRequest>('/auth/codes', { ...JSON_POST, body: JSON.stringify({ email }) });
}
