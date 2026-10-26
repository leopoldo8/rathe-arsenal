import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { isShareLinkUnavailable, useSharedDeckQuery } from '../../api/shared-decks';
import { SharedContactButton } from './SharedContactButton';
import { SharedCopyList } from './SharedCopyList';
import { SharedComparison } from './SharedComparison';
import { SharedDeckFooter } from './SharedDeckFooter';
import { SharedDeckGallery } from './SharedDeckGallery';
import { SharedDeckHeader } from './SharedDeckHeader';
import { SharedLegalityBlock } from './SharedLegalityBlock';
import { SharedDeckUnavailable } from './SharedDeckUnavailable';
import { SharedMissingPage } from './SharedMissingPage';
import { SharedQuotePage } from './SharedQuotePage';
import { SharedTopBar } from './SharedTopBar';
import styles from './SharedDeckPage.module.css';

interface ISharedDeckPageProps {
  readonly token: string;
}

/**
 * Public page behind /d/:token. Works without an account. The link's intent
 * picks the page: a deck (gallery, comparison and copy) or a want list for
 * the cards the sharer is missing (gallery, WhatsApp, copy list).
 */
export function SharedDeckPage({ token }: ISharedDeckPageProps): React.ReactElement {
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
        <SharedDeckFooter />
      </div>
    );
  }

  if (deck?.intent === 'quote') return <SharedQuotePage token={token} quote={deck} />;
  if (deck?.intent === 'missing') return <SharedMissingPage deck={deck} />;

  const contactWhatsapp = deck?.contactWhatsapp ?? null;
  const contactProps =
    deck !== undefined && contactWhatsapp !== null
      ? {
          whatsapp: contactWhatsapp,
          sharerName: deck.sharerName,
          message: t('sharing.contact.message', { deck: deck.name }),
        }
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
            <div className={deck.intent === 'deck' ? styles.top : styles.topSingle}>
              <SharedDeckHeader
                deck={deck}
                contact={
                  contactProps === null ? undefined : (
                    <SharedContactButton {...contactProps} variant="pill" />
                  )
                }
              />
              {deck.intent === 'deck' && <SharedComparison deck={deck} />}
            </div>
            {deck.intent === 'deck' && deck.legality !== null && (
              <SharedLegalityBlock format={deck.format} legality={deck.legality} />
            )}
            {deck.intent === 'deck' && <SharedCopyList deck={deck} />}
            {deck.intent === 'deck' && <SharedDeckGallery cards={deck.cards} />}
          </div>
        )}
      </main>
      <SharedDeckFooter
        {...(deck === undefined ? {} : { glossaryBackLabel: t('glossary.page.backToSharedDeck', { name: deck.sharerName }) })}
      />
      {contactProps !== null && <SharedContactButton {...contactProps} variant="bar" />}
    </div>
  );
}
