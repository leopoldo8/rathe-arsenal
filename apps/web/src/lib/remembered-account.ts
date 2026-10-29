/**
 * What this device remembers about the last account that signed in: the address, so the start
 * field comes back filled, and whether that sign-in used a password, so the password screen can
 * say so. Storage can be blocked (private mode); then nothing is remembered and nothing breaks.
 */

export const REMEMBERED_EMAIL_KEY = 'ra.lastEmail';
export const REMEMBERED_METHOD_KEY = 'ra.lastSignInMethod';

export type TSignInMethod = 'password' | 'code';

interface IStoredMethod {
  readonly email: string;
  readonly method: TSignInMethod;
}

export function readRememberedEmail(): string {
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberSignIn(email: string, method: TSignInMethod): void {
  try {
    localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    const stored: IStoredMethod = { email, method };
    localStorage.setItem(REMEMBERED_METHOD_KEY, JSON.stringify(stored));
  } catch {
    // Storage unavailable: the next visit simply starts with an empty field.
  }
}

/** True when this device's last sign-in for `email` used a password. */
export function lastSignInUsedPassword(email: string): boolean {
  try {
    const raw = localStorage.getItem(REMEMBERED_METHOD_KEY);
    if (raw === null) return false;
    const parsed = JSON.parse(raw) as Partial<IStoredMethod>;
    return parsed.email === email && parsed.method === 'password';
  } catch {
    return false;
  }
}
