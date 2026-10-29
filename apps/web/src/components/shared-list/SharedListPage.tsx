import React from 'react';
import { useTranslation } from 'react-i18next';
import { isShareLinkUnavailable } from '../../api/shared-decks';
import { useSharedListMatchesQuery, useSharedListQuery } from '../../api/shared-lists';
import { useAuth } from '../../auth/useAuth';
import { SharedContactButton } from '../shared-deck/SharedContactButton';
import { SharedDeckFooter } from '../shared-deck/SharedDeckFooter';
import { SharedDeckUnavailable } from '../shared-deck/SharedDeckUnavailable';
import { SharedTopBar } from '../shared-deck/SharedTopBar';
import { SharedListAside } from './SharedListAside';
import { SharedListBuyer } from './SharedListBuyer';
import { SharedListGallery } from './SharedListGallery';
import { SharedListTrade } from './SharedListTrade';
import { matchesByLine } from './sharedListModel';
import styles from './SharedListPage.module.css';

interface ISharedListPageProps {
  readonly token: string;
}

/**
 * Public page behind /l/:token. Works without an account: the list as a
 * gallery with a side column, and for a logged-in visitor what they already have.
 */
export function SharedListPage({ token }: ISharedListPageProps): React.ReactElement {
  const { t } = useTranslation();
  const { user } = useAuth();
  const query = useSharedListQuery(token);
  const list = query.data;
  const isVisitor = user !== null && list !== undefined && !list.isOwner;
  const matches = useSharedListMatchesQuery(token, isVisitor);

  if (query.isError && isShareLinkUnavailable(query.error)) {
    return (
      <div className={styles.page}>
        <SharedTopBar shareToken={null} isSignedIn={user !== null} page="l" />
        <main className={styles.main}>
          <SharedDeckUnavailable />
        </main>
        <SharedDeckFooter />
      </div>
    );
  }

  // The answer of the current API says whether the visitor owes the rule question; an answer without it keeps the gallery.
  const visitorView = isVisitor && list.spareNeedsRule !== undefined ? list : null;
  const hasContact = list?.contactWhatsapp != null && visitorView === null;
  const hasBar = hasContact || (list !== undefined && user === null);

  return (
    <div className={hasBar ? `${styles.page} ${styles.withBar}` : styles.page}>
      <SharedTopBar shareToken={token} isSignedIn={user !== null} page="l" />
      <main className={styles.main}>
        {list === undefined && query.isError && (
          <div className={styles.state} role="alert">
            <p>{t('sharing.page.loadFailed')}</p>
            <button type="button" className={styles.retry} onClick={() => void query.refetch()}>
              {t('sharing.page.retry')}
            </button>
          </div>
        )}
        {list === undefined && !query.isError && (
          <p className={styles.state} role="status" data-testid="shared-list-loading">
            {t('sharing.page.loading')}
          </p>
        )}
        {visitorView !== null && (visitorView.kind === 'sell' ? <SharedListBuyer list={visitorView} matches={matches.data} /> : <SharedListTrade list={visitorView} />)}
        {list !== undefined && visitorView === null && (
          <div className={styles.content}>
            <SharedListAside list={list} matches={matchesByLine(matches.data)} />
            <section className={styles.gallery} aria-label={list.name} data-testid="shared-list-gallery">
              {list.lines.length === 0 ? (
                <p className={styles.empty}>{t('sharing.sharedList.empty')}</p>
              ) : (
                <SharedListGallery list={list} matches={matchesByLine(matches.data)} />
              )}
            </section>
          </div>
        )}
      </main>
      <SharedDeckFooter
        {...(list === undefined ? {} : { glossaryBackLabel: t('glossary.page.backToSharedList', { name: list.sharerName }) })}
      />
      {list !== undefined && list.contactWhatsapp !== null && visitorView === null && (
        <SharedContactButton
          variant="bar"
          whatsapp={list.contactWhatsapp}
          sharerName={list.sharerName}
          message={t('sharing.sharedList.contactMessage', { list: list.name })}
        />
      )}
    </div>
  );
}
