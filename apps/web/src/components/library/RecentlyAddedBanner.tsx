import React, { useEffect, useState } from 'react';
import styles from './RecentlyAddedBanner.module.css';

const STORAGE_KEY = 'rathe-arsenal:recently-added-source';

export type TRecentlyAddedKind = 'csv' | 'fabrary' | 'manual';

export interface IRecentlyAddedSource {
  readonly kind: TRecentlyAddedKind;
  /** Source label / deck name to surface to the user. */
  readonly label: string;
  /** Total card copies the source contributed. */
  readonly cardCount: number;
}

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

function consumeRecentlyAddedSource(): IRecentlyAddedSource | null {
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

/**
 * One-time banner shown on the route the user lands on after a successful
 * import. Renders nothing if there's no payload to consume.
 */
export function RecentlyAddedBanner(): React.ReactElement | null {
  const [payload, setPayload] = useState<IRecentlyAddedSource | null>(null);

  useEffect(() => {
    setPayload(consumeRecentlyAddedSource());
  }, []);

  if (!payload) return null;

  const verb =
    payload.kind === 'fabrary'
      ? 'imported from Fabrary'
      : payload.kind === 'csv'
        ? 'imported from CSV'
        : 'added';

  return (
    <aside className={styles.banner} role="status" aria-live="polite">
      <span className={styles.diamond} aria-hidden="true">◆</span>
      <p className={styles.body}>
        <span className={styles.count}>{payload.cardCount}</span>{' '}
        {payload.cardCount === 1 ? 'card' : 'cards'} {verb} as{' '}
        <em>{payload.label}</em>.
      </p>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => setPayload(null)}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </aside>
  );
}
