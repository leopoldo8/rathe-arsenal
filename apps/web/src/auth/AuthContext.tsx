import { createContext } from 'react';

export type TUserRole = 'user' | 'admin';

export interface IAuthUser {
  id: string;
  email: string;
  role: TUserRole;
  chatAccess: boolean;
  /** Name shown on shared pages; null until the user picks one (sharing asks for it first). */
  displayName?: string | null;
  /** Digits with country code; null until the user saves one. */
  whatsappNumber?: string | null;
}

export interface IAuthSettings {
  theme: 'dark' | 'light';
}

export interface IAuthContext {
  user: IAuthUser | null;
  token: string | null;
  isLoading: boolean;
  /**
   * U12 — server-persisted user preferences mirrored into context for first-paint
   * theme correctness. Optional to avoid breaking every existing `useAuth()`
   * consumer (shell + ThemeToggle are the required consumers).
   */
  settings?: IAuthSettings;
  setSettings: (next: IAuthSettings) => void;
  /** `shareToken` credits the shared page the visitor came from; the API ignores it when dead. */
  signUp: (
    email: string,
    password: string,
    shareToken?: string,
  ) => Promise<{ _devVerificationLink?: string | undefined }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  verifyEmail: (token: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  /**
   * Phase 1a Unit 2 (A8) — soft-deletes the authenticated user's account
   * after password re-entry. Clears the local JWT and user on success so
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
