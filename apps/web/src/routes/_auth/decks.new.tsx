import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ImportFabraryCard } from '../../components/decks-new/ImportFabraryCard';
import { StartScratchCard } from '../../components/decks-new/StartScratchCard';
import styles from './decks.new.module.css';

export const Route = createFileRoute('/_auth/decks/new')({
  component: DecksNewPage,
});

export { DecksNewPage };

/**
 * DecksNewPage — /decks/new
 *
 * Two-path landing: "Import from Fabrary" (existing Fabrary URL flow) and
 * "Start from scratch" (hero + format → POST /decks → Edit mode).
 *
 * Layout: two cards side-by-side on desktop (≥768px), stacked on mobile.
 */
function DecksNewPage(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.page}>
      <header className={styles.subviewHeader}>
        <Link to="/home" search={{ tag: [] }} className={styles.back}>
          <span aria-hidden="true">←</span> {t('decks.backToHome')}
        </Link>
        <h1 className={styles.title}>{t('decks.addNewDeck')}</h1>
        <p className={styles.subtitle}>{t('decks.addNewDeckSubtitle')}</p>
      </header>

      <div className={styles.cards}>
        <ImportFabraryCard />
        <StartScratchCard />
      </div>
    </div>
  );
}
