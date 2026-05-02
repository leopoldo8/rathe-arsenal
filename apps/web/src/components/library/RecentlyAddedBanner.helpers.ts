/**
 * Types and helpers for the RecentlyAddedBanner component.
 *
 * Extracted into a sibling file so that `RecentlyAddedBanner.tsx` remains
 * a component-only module and Fast Refresh works without warnings.
 */

export type TRecentlyAddedKind = 'csv' | 'fabrary' | 'manual';

export interface IRecentlyAddedSource {
  readonly kind: TRecentlyAddedKind;
  /** Source label / deck name to surface to the user. */
  readonly label: string;
  /** Total card copies the source contributed. */
  readonly cardCount: number;
}

const STORAGE_KEY = 'rathe-arsenal:recently-added-source';

/**
 * Records that an import just succeeded — read by `RecentlyAddedBanner` on
 * the destination route. Survives a single page navigation; cleared on read
 * so the banner is genuinely one-time.
 *
 * Stored in `sessionStorage` instead of router search params to keep URLs
 * clean and avoid teaching users to bookmark a "?recentlyAddedSource=…"
 * permalink.
 */
export function recordRecentlyAddedSource(payload: IRecentlyAddedSource): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* sessionStorage may throw in private mode — non-fatal */
  }
}

export function consumeRecentlyAddedSource(): IRecentlyAddedSource | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw !== null) window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as IRecentlyAddedSource;
    if (
      typeof parsed?.label === 'string' &&
      typeof parsed?.cardCount === 'number' &&
      (parsed?.kind === 'csv' || parsed?.kind === 'fabrary' || parsed?.kind === 'manual')
    ) {
      return parsed;
    }
  } catch {
    /* malformed payload — ignore */
  }
  return null;
}
