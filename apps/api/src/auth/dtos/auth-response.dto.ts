import { EUserRole } from '../../database/entities/user.entity';

export interface IAuthUser {
  id: string;
  email: string;
  role: EUserRole;
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
  jwt: string;
  user: IAuthUser;
  settings: IAuthSettings;
}

/**
 * Sign-up and resend-verification endpoints return the same generic response
 * regardless of whether the email already exists / is already verified. This
 * prevents account-existence enumeration (A4/A6). The `_devVerificationLink`
 * field is only populated in development to ease local testing.
 */
export interface IGenericAuthAcceptedResponse {
  message: string;
  _devVerificationLink?: string;
}
