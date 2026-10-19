import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { isShareLinkUnavailable, useSharedDeckQuery } from '../../api/shared-decks';
import { SharedContactButton } from './SharedContactButton';
import { SharedComparison } from './SharedComparison';
import { SharedDeckFooter } from './SharedDeckFooter';
import { SharedDeckHeader } from './SharedDeckHeader';
import { SharedDeckList } from './SharedDeckList';
import { SharedDeckUnavailable } from './SharedDeckUnavailable';
import { SharedMissingView } from './SharedMissingView';
import { SharedTopBar } from './SharedTopBar';
import styles from './SharedDeckPage.module.css';

interface ISharedDeckPageProps {
  readonly token: string;
  readonly view: 'missing' | undefined;
  readonly onViewChange: (view: 'missing' | undefined) => void;
}

/** Public page behind /d/:token. Works without an account; signed-in visitors get coverage and copy. */
export function SharedDeckPage({ token, view, onViewChange }: ISharedDeckPageProps): React.ReactElement {
  const { t } = useTranslation();
  const { user } = useAuth();
  const query = useSharedDeckQuery(token);
  const deck = query.data;

  if (query.isError && isShareLinkUnavailable(query.error)) {
    return (
      <div className={styles.page}>
        <SharedTopBar shareToken={null} isSignedIn={user !== null} />
        <main className={styles.main}>
          <SharedDeckUnavailable />
        </main>
        <SharedDeckFooter showRobotsNote={false} />
      </div>
    );
  }

  const contactWhatsapp = deck?.contactWhatsapp ?? null;
  const contactProps =
    deck !== undefined && contactWhatsapp !== null
      ? { whatsapp: contactWhatsapp, sharerName: deck.sharerName, deckName: deck.name }
      : null;

  return (
    <div className={contactProps === null ? styles.page : `${styles.page} ${styles.withBar}`}>
      <SharedTopBar shareToken={token} isSignedIn={user !== null} />
      <main className={styles.main}>
        {deck === undefined && query.isError && (
          <div className={styles.state} role="alert">
            <p>{t('sharing.page.loadFailed')}</p>
            <button type="button" className={styles.retry} onClick={() => void query.refetch()}>
              {t('sharing.page.retry')}
            </button>
          </div>
        )}
        {deck === undefined && !query.isError && (
          <p className={styles.state} role="status" data-testid="shared-deck-loading">
            {t('sharing.page.loading')}
          </p>
        )}
        {deck !== undefined && (
          <div className={styles.content}>
            <div className={styles.top}>
              <SharedDeckHeader
                deck={deck}
                contact={contactProps === null ? undefined : <SharedContactButton {...contactProps} variant="pill" />}
              />
              <SharedComparison deck={deck} />
            </div>
            <SharedDeckList
              cards={deck.cards}
              totalCards={deck.totalCards}
              missingCount={deck.missingCount}
              onOpenMissing={() => onViewChange('missing')}
            />
          </div>
        )}
      </main>
      {deck !== undefined && view === 'missing' && (
        <SharedMissingView deck={deck} onClose={() => onViewChange(undefined)} />
      )}
      <SharedDeckFooter />
      {contactProps !== null && <SharedContactButton {...contactProps} variant="bar" />}
    </div>
  );
}
