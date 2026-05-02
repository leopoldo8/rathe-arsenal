import React from 'react';
import { Button } from '../ui/Button/Button';
import styles from './EducationalEmptyState.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IEducationalEmptyStateProps {
  readonly collectionCardCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EducationalEmptyState — shown when the user has zero tracked decks.
 *
 * Upgraded copy per origin R22:
 *  - Explains what tracking is.
 *  - Explains what readiness means.
 *  - Shows 3-step explainer.
 *  - Prominent Import CTA.
 *  - "Skip to Library" secondary link (links to `/library`).
 *
 * The CardAutocomplete "add cards manually" affordance is preserved for
 * users who want to build their collection before importing a deck.
 */
export function EducationalEmptyState({
  collectionCardCount,
}: IEducationalEmptyStateProps): React.ReactElement {
  return (
    <section className={styles.container}>
      <div className={styles.intro}>
        <h1 className={styles.heading}>Welcome, Hero.</h1>
        <p className={styles.lead}>
          Your armory is empty. Track a deck to see how ready your collection
          is &mdash; we&apos;ll surface owned cards, valid substitutes, and
          exactly what&apos;s missing.
        </p>
        {collectionCardCount > 0 && (
          <p className={styles.collectionHint}>
            You already have{' '}
            <strong>{collectionCardCount}</strong>{' '}
            {collectionCardCount === 1 ? 'card' : 'cards'} in your collection.
          </p>
        )}
      </div>

      <div className={styles.steps} role="list" aria-label="How it works">
        <div className={styles.step} role="listitem">
          <div className={styles.stepNumber} aria-hidden="true">01</div>
          <h4 className={styles.stepTitle}>Paste a deck</h4>
          <p className={styles.stepBody}>
            From Fabrary, or pick a meta deck we&apos;ve indexed.
          </p>
        </div>
        <div className={styles.step} role="listitem">
          <div className={styles.stepNumber} aria-hidden="true">02</div>
          <h4 className={styles.stepTitle}>See your readiness</h4>
          <p className={styles.stepBody}>
            We&apos;ll cross-reference your collection and show what you own,
            what substitutes are valid, and exactly what&apos;s missing.
          </p>
        </div>
        <div className={styles.step} role="listitem">
          <div className={styles.stepNumber} aria-hidden="true">03</div>
          <h4 className={styles.stepTitle}>Approve &amp; buy</h4>
          <p className={styles.stepBody}>
            Approve or reject each substitution. Shop the missing cards in one
            click.
          </p>
        </div>
      </div>

      <div className={styles.cta}>
        <a href="/decks/new" className={styles.importLink}>
          <Button variant="primary" size="lg">
            Track your first deck
          </Button>
        </a>

        <a href="/library" className={styles.skipLink}>
          Skip to Library
        </a>
      </div>

      <div className={styles.manualAdd}>
        <p className={styles.manualAddText}>
          Want to add cards without a CSV?{' '}
          <a href="/library" className={styles.manualAddLink}>
            Go to Library
          </a>{' '}
          to search and add individual cards.
        </p>
      </div>
    </section>
  );
}
