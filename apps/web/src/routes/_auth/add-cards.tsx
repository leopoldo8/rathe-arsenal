import React from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { DEFAULT_LIBRARY_SEARCH } from './-library.helpers';
import styles from './add-cards.module.css';

export const Route = createFileRoute('/_auth/add-cards')({
  component: AddCardsLayout,
});

type TTabPath = '/add-cards/manual' | '/add-cards/csv' | '/add-cards/fabrary' | '/add-cards/scan';

interface ITab {
  readonly to: TTabPath;
  readonly labelKey: string;
  readonly sentenceKey: string;
}

const ADD_CARDS_TABS: readonly ITab[] = [
  { to: '/add-cards/manual', labelKey: 'decks.addCardsTabManual', sentenceKey: 'decks.addCardsManualSentence' },
  { to: '/add-cards/csv', labelKey: 'decks.addCardsTabCsv', sentenceKey: 'decks.addCardsCsvSentence' },
  { to: '/add-cards/fabrary', labelKey: 'decks.addCardsTabFabrary', sentenceKey: 'decks.addCardsFabrarySentence' },
  { to: '/add-cards/scan', labelKey: 'decks.addCardsTabScan', sentenceKey: 'decks.addCardsScanSentence' },
];

export function AddCardsLayout(): React.ReactElement {
  const { t } = useTranslation();
  const pathname = useLocation({ select: (location) => location.pathname });
  const activeTab = ADD_CARDS_TABS.find((tab) => pathname.startsWith(tab.to));

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <Link to="/library" search={DEFAULT_LIBRARY_SEARCH} className={styles.backLink}>
          <span aria-hidden="true">←</span> {t('shell.navLibrary')}
        </Link>
        <h1 className={styles.title}>{t('decks.addCardsTitle')}</h1>
        <p className={styles.subtitle}>{t('decks.addCardsSubtitle')}</p>
      </header>

      <nav className={styles.tabs} aria-label={t('decks.addCardsMethodsAria')}>
        {ADD_CARDS_TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={styles.tab}
              data-active={active ? 'true' : 'false'}
              aria-current={active ? 'page' : undefined}
            >
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </nav>

      {activeTab && <p className={styles.sentence}>{t(activeTab.sentenceKey)}</p>}

      <section className={styles.panel}>
        <Outlet />
      </section>

      <footer className={styles.pageFooter}>
        <Link to="/library-csv-sources" className={styles.manageLink}>
          {t('decks.manageLibrarySources')}
        </Link>
      </footer>
    </div>
  );
}
