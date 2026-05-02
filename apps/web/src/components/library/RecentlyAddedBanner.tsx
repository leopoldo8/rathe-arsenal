import React, { useState } from 'react';
import {
  consumeRecentlyAddedSource,
} from './RecentlyAddedBanner.helpers';
import type { IRecentlyAddedSource } from './RecentlyAddedBanner.helpers';
import styles from './RecentlyAddedBanner.module.css';

/**
 * One-time banner shown on the route the user lands on after a successful
 * import. Renders nothing if there's no payload to consume.
 *
 * The consume runs inside `useState`'s lazy initializer so it fires
 * exactly once per component instance — including under React strict
 * mode, where a `useEffect` would run twice (the second pass would read
 * an already-cleared sessionStorage entry and reset state to null,
 * dropping the banner before the user ever saw it).
 */
export function RecentlyAddedBanner(): React.ReactElement | null {
  const [payload, setPayload] = useState<IRecentlyAddedSource | null>(() =>
    consumeRecentlyAddedSource(),
  );

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
