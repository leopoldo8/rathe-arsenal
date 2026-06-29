import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LIBRARY_SEARCH } from './-library.helpers';
import styles from './add-cards.module.css';

/**
 * Index route for /add-cards — renders the gallery of three add methods.
 * The parent route `/_auth/add-cards` is a thin layout that just renders
 * `<Outlet />`, so child routes (manual / csv / fabrary) take over the
 * full page when navigated to.
 */
export const Route = createFileRoute('/_auth/add-cards/')({
  component: AddCardsPage,
});

export { AddCardsPage };

type TMethodKey = 'manual' | 'csv' | 'fabrary';

interface IMethod {
  readonly to: '/add-cards/manual' | '/add-cards/csv' | '/add-cards/fabrary';
  readonly numeral: string;
  readonly key: TMethodKey;
}

const METHOD_DEFS: readonly IMethod[] = [
  { to: '/add-cards/manual', numeral: 'I', key: 'manual' },
  { to: '/add-cards/csv', numeral: 'II', key: 'csv' },
  { to: '/add-cards/fabrary', numeral: 'III', key: 'fabrary' },
];

function AddCardsPage(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <Link to="/library" search={DEFAULT_LIBRARY_SEARCH} className={styles.backLink}>
        <span aria-hidden="true">←</span> {t('shell.navLibrary')}
      </Link>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>
          <span aria-hidden="true">◆</span> {t('decks.addCardsEyebrow')}
        </p>
        <h1 className={styles.title}>{t('decks.addCardsTitle')}</h1>
        <p className={styles.subtitle}>{t('decks.addCardsSubtitle')}</p>
      </header>

      <ul className={styles.gallery} aria-label={t('decks.addCardsMethodsAria')}>
        {METHOD_DEFS.map((method) => {
          const titleKey = `decks.method${method.key.charAt(0).toUpperCase() + method.key.slice(1)}Title` as const;
          const summaryKey = `decks.method${method.key.charAt(0).toUpperCase() + method.key.slice(1)}Summary` as const;
          const ctaKey = `decks.method${method.key.charAt(0).toUpperCase() + method.key.slice(1)}Cta` as const;
          const note1Key = `decks.method${method.key.charAt(0).toUpperCase() + method.key.slice(1)}Note1` as const;
          const note2Key = `decks.method${method.key.charAt(0).toUpperCase() + method.key.slice(1)}Note2` as const;
          return (
            <li key={method.to} className={styles.galleryItem}>
              <Link to={method.to} className={styles.method}>
                <div className={styles.methodHeader}>
                  <span className={styles.methodNumeral} aria-hidden="true">
                    {method.numeral}
                  </span>
                  <h2 className={styles.methodTitle}>{t(titleKey)}</h2>
                </div>
                <p className={styles.methodSummary}>{t(summaryKey)}</p>
                <ul className={styles.methodNotes} aria-hidden="true">
                  <li className={styles.methodNote}>{t(note1Key)}</li>
                  <li className={styles.methodNote}>{t(note2Key)}</li>
                </ul>
                <span className={styles.methodCta}>
                  <span className={styles.methodCtaArrow} aria-hidden="true">
                    →
                  </span>{' '}
                  {t(ctaKey)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <footer className={styles.pageFooter}>
        <Link to="/library-csv-sources" className={styles.manageLink}>
          {t('decks.manageLibrarySources')}
        </Link>
      </footer>
    </div>
  );
}
