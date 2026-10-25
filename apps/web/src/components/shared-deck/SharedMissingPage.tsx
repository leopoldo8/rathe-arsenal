import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import type { ISharedDeckResponse } from '../../api/shared-decks';
import { SharedDeckFooter } from './SharedDeckFooter';
import { SharedMissingGallery } from './SharedMissingGallery';
import { buildMissingText } from './sharedDeckModel';
import { SharedTopBar } from './SharedTopBar';
import styles from './SharedMissingPage.module.css';

const COPIED_FEEDBACK_MS = 2000;

interface ISharedMissingPageProps {
  readonly deck: ISharedDeckResponse;
}

/** The page behind a `missing` address, for the group: who asks, what people can give, and what the store has. */
export function SharedMissingPage({ deck }: ISharedMissingPageProps): React.ReactElement {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function handleCopy(): Promise<void> {
    const text = buildMissingText(deck.missing, deck.url, (key, options) => (options === undefined ? t(key) : t(key, options)) as string);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState('idle'), COPIED_FEEDBACK_MS);
  }

  return (
    <div className={styles.page}>
      <SharedTopBar shareToken={deck.token} isSignedIn={user !== null} offerSignUp={false} />
      <main className={styles.main}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>{t('sharing.missingPage.eyebrow')}</p>
          <h1 className={styles.title}>{t('sharing.missingPage.title', { name: deck.sharerName })}</h1>
          <p className={styles.deckName}>{deck.name}</p>
          <p className={styles.pitchHint}>{t('sharing.missingPage.pitchHint')}</p>
        </header>
        {deck.missing.length === 0 ? (
          <p className={styles.empty}>{t('sharing.wanted.empty')}</p>
        ) : (
          <>
            <SharedMissingGallery deck={deck} />
            <button type="button" className={styles.copy} onClick={() => void handleCopy()} data-testid="shared-copy-list">
              {copyState === 'copied' ? t('sharing.wanted.copied') : t('sharing.wanted.copyList')}
            </button>
            <p className={styles.status} role="status">
              {copyState === 'failed' ? t('sharing.wanted.copyFailed') : ''}
            </p>
          </>
        )}
      </main>
      <SharedDeckFooter note={t('sharing.missingPage.footNote')} />
    </div>
  );
}
