import React, { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { useSharedMatchesQuery, type ISharedDeckResponse } from '../../api/shared-decks';
import { writeShareReturn } from '../../lib/share-return';
import { SharedGallery } from './SharedGallery';
import { buildMissingText } from './sharedDeckModel';
import styles from './SharedMissingGallery.module.css';

const COPIED_FEEDBACK_MS = 2000;

interface ISharedMissingGalleryProps {
  readonly deck: ISharedDeckResponse;
}

/**
 * The missing-cards page body: the copy-list action, a sign-up line for
 * anonymous visitors, and the gallery of the missing cards. A signed-in
 * visitor who is not the owner also sees how many of each they own.
 */
export function SharedMissingGallery({ deck }: ISharedMissingGalleryProps): React.ReactElement {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisitor = user !== null && !deck.isOwner;
  const matches = useSharedMatchesQuery(deck.token, isVisitor);
  const ownedByCard = new Map((matches.data?.cards ?? []).map((card) => [card.cardIdentifier, card.owned]));
  const text = buildMissingText(
    deck.missing,
    deck.url,
    (key, options) => (options === undefined ? t(key) : t(key, options)) as string,
  );

  useEffect(
    () => () => {
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState('idle'), COPIED_FEEDBACK_MS);
  }

  if (deck.missing.length === 0) {
    return <p className={styles.empty}>{t('sharing.wanted.empty')}</p>;
  }

  return (
    <section className={styles.section} data-testid="shared-missing">
      <div className={styles.actions}>
        <button type="button" className={styles.copyBtn} onClick={() => void handleCopy()} data-testid="shared-copy-list">
          {copyState === 'copied' ? t('sharing.wanted.copied') : t('sharing.wanted.copyList')}
        </button>
        {user === null && (
          <p className={styles.prompt} data-testid="shared-signup-prompt">
            {t('sharing.wanted.signUpPrompt')}{' '}
            <Link to="/sign-up" className={styles.link} onClick={() => writeShareReturn(deck.token)}>
              {t('sharing.wanted.signUp')}
            </Link>
          </p>
        )}
        <p className={styles.status} role="status">
          {copyState === 'failed' ? t('sharing.wanted.copyFailed') : ''}
        </p>
      </div>
      <SharedGallery
        cards={deck.missing}
        countAs="missing"
        formatQuantity={(count) => String(count)}
        noteFor={(card) => {
          const owned = ownedByCard.get(card.cardIdentifier) ?? 0;
          return owned > 0 ? (
            <span className={styles.owned} data-testid="shared-owned">
              {t('sharing.wanted.youHave', { count: owned })}
            </span>
          ) : undefined;
        }}
      />
    </section>
  );
}
