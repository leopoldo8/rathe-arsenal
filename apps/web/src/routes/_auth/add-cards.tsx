import React from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { DEFAULT_LIBRARY_SEARCH } from './-library.helpers';
import styles from './add-cards.module.css';

export const Route = createFileRoute('/_auth/add-cards')({
  component: AddCardsLayout,
});

const ENTRY_PATH = '/add-cards';

/**
 * The entry screen draws only its heading and the ways in. A page reached from one of them (typing a
 * name, a spreadsheet) keeps the way back to the collection and the link to the imports list.
 */
export function AddCardsLayout(): React.ReactElement {
  const { t } = useTranslation();
  const pathname = useLocation({ select: (location) => location.pathname });
  const isEntry = pathname.replace(/\/$/, '') === ENTRY_PATH;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        {!isEntry && (
          <Link to="/library" search={DEFAULT_LIBRARY_SEARCH} className={styles.backLink}>
            <span aria-hidden="true">←</span> {t('shell.navLibrary')}
          </Link>
        )}
        <h1 className={styles.title}>{t('decks.addCardsTitle')}</h1>
      </header>

      {isEntry ? (
        <Outlet />
      ) : (
        <section className={styles.panel}>
          <Outlet />
        </section>
      )}

      {!isEntry && (
        <footer className={styles.pageFooter}>
          <Link to="/library-csv-sources" className={styles.manageLink}>
            {t('decks.manageLibrarySources')}
          </Link>
        </footer>
      )}
    </div>
  );
}
