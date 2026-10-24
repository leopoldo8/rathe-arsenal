import { createContext } from 'react';
import type { IEmailConfirmation } from '../lib/account-api';

export type TUserRole = 'user' | 'admin';

export interface IAuthUser {
  id: string;
  email: string;
  role: TUserRole;
  chatAccess: boolean;
  /** False until the address is confirmed; only creating share links waits for it. */
  emailConfirmed?: boolean;
  /** Name shown on shared pages; null until the user picks one (sharing asks for it first). */
  displayName?: string | null;
  /** Digits with country code; null until the user saves one. */
  whatsappNumber?: string | null;
}

export interface IAuthSettings {
  theme: 'dark' | 'light';
}

export interface ISignUpInput {
  readonly email: string;
  readonly password?: string;
  readonly shareToken?: string;
  readonly returnPath?: string;
}

export interface ICodeSignIn {
  readonly returnPath: string | null;
}

export interface IAuthContext {
  user: IAuthUser | null;
  isLoading: boolean;
  /** True while the signed-in user is the one this device's session restored on page load, not a sign-in made since. */
  restoredSession?: boolean;
  /** True when the server ended the session while the player was on a page: the sign-in sheet is open over it. */
  sessionEnded?: boolean;
  /**
   * U12 — server-persisted user preferences mirrored into context for first-paint
   * theme correctness. Optional to avoid breaking every existing `useAuth()`
   * consumer (shell + ThemeToggle are the required consumers).
   */
  settings?: IAuthSettings;
  setSettings: (next: IAuthSettings) => void;
  /**
   * Creates an account and signs it in at once. `password` is optional (an account with none signs in
   * with an e-mailed code); `shareToken` credits the shared page the visitor came from and the API
   * ignores it when dead; `returnPath` is the in-app page to come back to after confirming the e-mail.
   */
  signUp: (input: ISignUpInput) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Ends the session on the server and clears this device's state. */
  signOut: () => void;
  /** Confirms the address behind an e-mailed link. It signs nobody in; a signed-in owner of that address is marked confirmed. */
  verifyEmail: (token: string) => Promise<IEmailConfirmation>;
  /** Moves the unconfirmed account to a corrected address; the new confirmation e-mail goes out. */
  changeEmail: (email: string) => Promise<void>;
  /** Signs in with the six digits e-mailed to `email`; resolves with the page the account was made from, if any. */
  verifyCode: (email: string, code: string) => Promise<ICodeSignIn>;
  /** Signs in with the single-use token of the e-mail's button. */
  redeemCode: (token: string) => Promise<ICodeSignIn>;
  /**
   * Phase 1a Unit 2 (A8) — soft-deletes the authenticated user's account
   * after password re-entry. Clears the local user on success (the server ends every session) so
   * the app falls back to the landing page. Rejects with `AuthFetchError`
   * on 401 (wrong password) / 429 (rate limit) / other HTTP errors so the
   * caller can render inline feedback.
   */
  deleteAccount: (password: string) => Promise<void>;
  /** Mirrors a saved display name into the signed-in user without refetching /auth/me. */
  setDisplayName: (displayName: string) => void;
  /** Mirrors a saved (or removed, with null) WhatsApp number into the signed-in user. */
  setWhatsappNumber: (whatsappNumber: string | null) => void;
}

export const AuthContext = createContext<IAuthContext | null>(null);
