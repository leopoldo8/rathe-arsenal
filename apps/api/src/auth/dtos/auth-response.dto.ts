import { EUserRole } from '../../database/entities/user.entity';

export interface IAuthUser {
  id: string;
  email: string;
  role: EUserRole;
  chatAccess: boolean;
  /** True once the address is confirmed; until then the account cannot create share links. */
  emailConfirmed: boolean;
  /** False for an account that signs in with an e-mailed code only. */
  hasPassword: boolean;
}

/**
 * U12 — user settings shape embedded in auth responses.
 * Only `theme` is included to keep the auth response lightweight.
 * The full /api/users/me/settings endpoint exposes the same data on demand.
 */
export interface IAuthSettings {
  theme: 'dark' | 'light';
}

/**
 * Extended auth response including user settings for first-paint correctness.
 * The `settings` field lets the frontend apply the server's theme immediately
 * after sign-in without a second network round-trip.
 *
 * Nullish fallback: `settings.theme` defaults to `'dark'` when the user's
 * `preferences` column is NULL (rows created before migration 1776621087000,
 * or malformed rows). This prevents a 500 from leaking internally.
 */
export interface IAuthResponse {
  user: IAuthUser;
  settings: IAuthSettings;
}

/** What an address takes next, from `POST /api/auth/start`. */
export interface IStartResponse {
  next: 'new' | 'password' | 'code';
}

/** Sign-up answers like a sign-in; the dev link only exists in development. */
export interface ISignUpResponse extends IAuthResponse {
  _devVerificationLink?: string;
}

/** A sign-in by code or button also names the page the account was made from, when it kept one. */
export interface ICodeSignInResponse extends IAuthResponse {
  returnPath: string | null;
}

/** What confirming an address answers; `email` lets a visitor who is not signed in be offered the code sign-in for it. */
export interface IVerifyEmailResponse {
  verified: true;
  returnPath: string | null;
  email: string;
}
