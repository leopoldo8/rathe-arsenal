import React from 'react';
import { Link } from '@tanstack/react-router';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import styles from './DeckDetailEmptyState.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TDeckDetailEmptyKind = 'not-found' | 'computing';

interface IDeckDetailEmptyStateProps {
  /** Determines which copy and affordances are shown. */
  readonly kind: TDeckDetailEmptyKind;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DeckDetailEmptyState — shown for two distinct non-populated states.
 *
 * - `kind="not-found"`: deck was removed or the URL is stale.
 *   Offers a primary CTA back to home and a secondary CTA to track a new deck.
 *
 * - `kind="computing"`: deck exists but readiness has not been computed yet.
 *   The route polls (TanStack refetchInterval ~3 s) and auto-transitions when
 *   the snapshot arrives. No CTA — auto-refresh is the contract.
 */
export function DeckDetailEmptyState({ kind }: IDeckDetailEmptyStateProps): React.ReactElement {
  if (kind === 'computing') {
    return (
      <section className={styles.container} aria-labelledby="deck-empty-heading">
        <div className={styles.diamond} aria-hidden="true">◆</div>

        <h1 id="deck-empty-heading" className={styles.heading}>
          Computing readiness&hellip;
        </h1>

        <p className={styles.body}>
          We&rsquo;re checking what you can play. This takes a few seconds for new decks.
        </p>

        <div className={styles.computingIndicator}>
          <Skeleton
            width="160px"
            height="0.875rem"
            aria-label="Computing readiness"
          />
        </div>
      </section>
    );
  }

  return (
    <section className={styles.container} aria-labelledby="deck-empty-heading">
      <div className={styles.diamond} aria-hidden="true">◆</div>

      <h1 id="deck-empty-heading" className={styles.heading}>
        This deck isn&rsquo;t in your arsenal.
      </h1>

      <p className={styles.body}>
        It may have been removed, or the link is stale.
      </p>

      <div className={styles.ctaGroup}>
        <Link to="/home" search={{ tag: [] }} className={styles.primaryCta}>
          Back to home
        </Link>

        <Link to="/add-cards/fabrary" className={styles.secondaryCta}>
          Track a Fabrary deck
        </Link>
      </div>
    </section>
  );
}
