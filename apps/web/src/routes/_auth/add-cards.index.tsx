import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
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

interface IMethod {
  readonly to: '/add-cards/manual' | '/add-cards/csv' | '/add-cards/fabrary';
  readonly numeral: string;
  readonly title: string;
  readonly summary: string;
  readonly cta: string;
  readonly notes: readonly string[];
}

const METHODS: readonly IMethod[] = [
  {
    to: '/add-cards/manual',
    numeral: 'I',
    title: 'Manual',
    summary:
      'Search the catalog by name and add cards one by one. Best for quick adjustments after a single trade or a recent pull.',
    cta: 'Search the catalog',
    notes: ['One card at a time', 'Up to 3× per add'],
  },
  {
    to: '/add-cards/csv',
    numeral: 'II',
    title: 'CSV import',
    summary:
      'Upload a Fabrary or compatible CSV export. The import becomes a toggleable source you can deactivate later from sources management.',
    cta: 'Upload a file',
    notes: ['Bulk', 'Toggleable source'],
  },
  {
    to: '/add-cards/fabrary',
    numeral: 'III',
    title: 'Fabrary deck',
    summary:
      'Paste a Fabrary deck URL — every card the deck uses lands in your library as a new source. The deck itself stays where it is, no tracking added.',
    cta: 'Paste a link',
    notes: ['Deck → library only', 'No deck tracking'],
  },
];

function AddCardsPage(): React.ReactElement {
  return (
    <div className={styles.page}>
      <Link to="/library" search={DEFAULT_LIBRARY_SEARCH} className={styles.backLink}>
        <span aria-hidden="true">←</span> Library
      </Link>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>
          <span aria-hidden="true">◆</span> Three paths
        </p>
        <h1 className={styles.title}>Add cards</h1>
        <p className={styles.subtitle}>
          Three ways to grow your arsenal — pick whichever fits the moment.
        </p>
      </header>

      <ul className={styles.gallery} aria-label="Methods">
        {METHODS.map((method) => (
          <li key={method.to} className={styles.galleryItem}>
            <Link to={method.to} className={styles.method}>
              <div className={styles.methodHeader}>
                <span className={styles.methodNumeral} aria-hidden="true">
                  {method.numeral}
                </span>
                <h2 className={styles.methodTitle}>{method.title}</h2>
              </div>
              <p className={styles.methodSummary}>{method.summary}</p>
              <ul className={styles.methodNotes} aria-hidden="true">
                {method.notes.map((note) => (
                  <li key={note} className={styles.methodNote}>
                    {note}
                  </li>
                ))}
              </ul>
              <span className={styles.methodCta}>
                <span className={styles.methodCtaArrow} aria-hidden="true">
                  →
                </span>{' '}
                {method.cta}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <footer className={styles.pageFooter}>
        <Link to="/library-csv-sources" className={styles.manageLink}>
          Manage CSV sources
        </Link>
      </footer>
    </div>
  );
}
