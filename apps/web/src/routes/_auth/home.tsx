import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useDecksQuery, useUntrackDeckMutation } from '../../api/decks';
import { PopulatedHomeHero } from '../../components/home/PopulatedHomeHero';
import { ReadinessShelves } from '../../components/home/ReadinessShelves';
import { AggregateCallout } from '../../components/home/AggregateCallout';
import { EducationalEmptyState } from '../../components/home/EducationalEmptyState';
import { Skeleton } from '../../components/ui/Skeleton/Skeleton';
import { Button } from '../../components/ui/Button/Button';
import styles from './home.module.css';

export const Route = createFileRoute('/_auth/home')({
  component: HomePage,
});

/**
 * Home page — readiness-shelves state machine.
 *
 * Modes:
 *  - Loading: skeleton matching the populated-mode layout (no flash of empty).
 *  - Error: inline error with a retry button wired to TanStack Query refetch.
 *  - Empty: `trackedDecks.length === 0` — EducationalEmptyState.
 *  - Populated: PopulatedHomeHero + ReadinessShelves + AggregateCallout.
 *
 * Mode transitions happen naturally via TanStack Query invalidation of the
 * ['decks'] key from mutations (untrack, import, add-card).
 */
function HomePage(): React.ReactElement {
  const decksQuery = useDecksQuery();
  const untrackMutation = useUntrackDeckMutation();

  if (decksQuery.isLoading) {
    return <HomeSkeleton />;
  }

  if (decksQuery.isError) {
    return (
      <section role="alert" className={styles.errorSection}>
        <h2 className={styles.errorHeading}>Something went wrong loading your decks</h2>
        <p className={styles.errorMessage}>
          {(decksQuery.error as Error).message}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => decksQuery.refetch()}
        >
          Retry
        </Button>
      </section>
    );
  }

  const data = decksQuery.data;
  const trackedDecks = data?.trackedDecks ?? [];
  const collectionCardCount = data?.collectionCardCount ?? 0;

  if (trackedDecks.length === 0) {
    return <EducationalEmptyState collectionCardCount={collectionCardCount} />;
  }

  const uniqueCardsMissing =
    data?.aggregateShoppingLine?.kind === 'populated'
      ? (data.aggregateShoppingLine.uniqueCardsMissing ?? null)
      : null;

  const untrackingDeckId =
    untrackMutation.isPending ? (untrackMutation.variables ?? null) : null;

  return (
    <section className={styles.populated}>
      <PopulatedHomeHero
        decks={trackedDecks}
        uniqueCardsMissing={uniqueCardsMissing}
      />
      <ReadinessShelves
        decks={trackedDecks}
        onUntrack={(deckId) => untrackMutation.mutate(deckId)}
        untrackingDeckId={untrackingDeckId}
      />
      <AggregateCallout aggregateShoppingLine={data?.aggregateShoppingLine ?? null} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

/**
 * HomeSkeleton — mirrors the populated layout to avoid a flash of empty state
 * while the decks query is in-flight.
 */
function HomeSkeleton(): React.ReactElement {
  return (
    <section aria-busy="true" aria-live="polite" className={styles.skeleton}>
      {/* Hero skeleton */}
      <div className={styles.skeletonHero}>
        <div className={styles.skeletonHeroLeft}>
          <Skeleton width="120px" height="14px" aria-label="Loading eyebrow" />
          <Skeleton width="200px" height="36px" aria-label="Loading headline" />
          <Skeleton width="280px" height="16px" aria-label="Loading summary" />
        </div>
        <div className={styles.skeletonStats}>
          <Skeleton width="60px" height="56px" aria-label="Loading stat" />
          <Skeleton width="60px" height="56px" aria-label="Loading stat" />
          <Skeleton width="80px" height="56px" aria-label="Loading stat" />
        </div>
      </div>

      {/* Shelf skeletons */}
      {([0, 1] as const).map((i) => (
        <div key={i} className={styles.skeletonShelf}>
          <Skeleton width="160px" height="20px" aria-label="Loading shelf heading" />
          <div className={styles.skeletonGrid}>
            {([0, 1, 2] as const).map((j) => (
              <div key={j} className={styles.skeletonCard}>
                <Skeleton width="70%" height="18px" aria-label="Loading deck name" />
                <Skeleton width="50%" height="14px" aria-label="Loading deck meta" />
                <Skeleton width="80px" height="32px" aria-label="Loading readiness" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
