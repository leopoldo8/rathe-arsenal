import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [payload, setPayload] = useState<IRecentlyAddedSource | null>(() =>
    consumeRecentlyAddedSource(),
  );

  if (!payload) return null;

  const verb =
    payload.kind === 'fabrary'
      ? t('library.bannerVerbFabrary')
      : payload.kind === 'csv'
        ? t('library.bannerVerbCsv')
        : t('library.bannerVerbAdded');

  return (
    <aside className={styles.banner} role="status" aria-live="polite">
      <span className={styles.diamond} aria-hidden="true">◆</span>
      <p className={styles.body}>
        <span className={styles.count}>{payload.cardCount}</span>{' '}
        {payload.cardCount === 1 ? t('library.bannerCardSingular') : t('library.bannerCardPlural')} {verb} {t('library.bannerAs')}{' '}
        <em>{payload.label}</em>.
      </p>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => setPayload(null)}
        aria-label={t('library.bannerDismissAriaLabel')}
      >
        ✕
      </button>
    </aside>
  );
}
