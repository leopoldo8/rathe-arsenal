/**
 * Return-after-auth for shared pages.
 *
 * An anonymous visitor who chooses sign-up or sign-in from a shared page has
 * the page remembered in localStorage (not in the URL, so it survives the
 * email-verification round trip). Sign-in and email verification then send the
 * visitor back, and sign-up credits the link the visitor came from.
 */

export const SHARE_RETURN_STORAGE_KEY = 'ra.shareReturn';

/** Path prefixes a stored return address may start with: shared decks and shared lists. */
const SAFE_RETURN_PREFIXES: readonly string[] = ['/d/', '/l/'];

/** Shape of a share token; the API rejects anything else before touching the database. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

/** A stored return older than this is stale: the visitor most likely moved on. */
export const SHARE_RETURN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface IShareReturn {
  readonly returnTo: string;
  readonly shareToken: string;
}

interface IStoredShareReturn extends IShareReturn {
  readonly savedAt: number;
}

/**
 * Accepts only a relative path under `/d/` or `/l/`. Anything else, including
 * absolute URLs, protocol-relative `//host` forms and backslash tricks, is
 * rejected so the stored value can never turn into an open redirect.
 */
export function isSafeReturnPath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!SAFE_RETURN_PREFIXES.some((prefix) => value.startsWith(prefix))) return false;
  if (value.length === 3) return false;
  return !/[\\\s]/.test(value) && !value.includes('//');
}

export function readShareReturn(): IShareReturn | null {
  try {
    const raw = localStorage.getItem(SHARE_RETURN_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { returnTo, shareToken, savedAt } = parsed as Record<string, unknown>;
    if (!isSafeReturnPath(returnTo)) return null;
    if (typeof shareToken !== 'string' || !TOKEN_SHAPE.test(shareToken)) return null;
    // Entries without a timestamp predate the expiry and are treated as stale.
    const isFresh = typeof savedAt === 'number' && Date.now() - savedAt <= SHARE_RETURN_MAX_AGE_MS;
    if (!isFresh) {
      clearShareReturn();
      return null;
    }
    return { returnTo, shareToken };
  } catch {
    return null;
  }
}

export function writeShareReturn(shareToken: string): void {
  if (!TOKEN_SHAPE.test(shareToken)) return;
  try {
    const value: IStoredShareReturn = { returnTo: `/d/${shareToken}`, shareToken, savedAt: Date.now() };
    localStorage.setItem(SHARE_RETURN_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private mode or storage blocked: the visitor just lands on the default page after auth.
  }
}

export function clearShareReturn(): void {
  try {
    localStorage.removeItem(SHARE_RETURN_STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
