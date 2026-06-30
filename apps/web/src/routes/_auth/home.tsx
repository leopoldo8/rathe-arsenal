import React, { useMemo, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useDecksQuery, useUntrackDeckMutation } from '../../api/decks';
import { PopulatedHomeHero } from '../../components/home/PopulatedHomeHero';
import { StatusShelves } from '../../components/home/StatusShelves';
import { TagFilterChips } from '../../components/home/TagFilterChips';
import { AggregateCallout } from '../../components/home/AggregateCallout';
import { EducationalEmptyState } from '../../components/home/EducationalEmptyState';
import { Skeleton } from '../../components/ui/Skeleton/Skeleton';
import { Button } from '../../components/ui/Button/Button';
import { validateHomeSearch } from './-home.helpers';
import styles from './home.module.css';

export const Route = createFileRoute('/_auth/home')({
  validateSearch: validateHomeSearch,
  component: HomePage,
});

/**
 * Home page — status-shelves state machine.
 *
 * Modes:
 *  - Loading: skeleton matching the populated-mode layout (no flash of empty).
 *  - Error: inline error with a retry button wired to TanStack Query refetch.
 *  - Empty: `trackedDecks.length === 0` — EducationalEmptyState.
 *  - Populated: PopulatedHomeHero + TagFilterChips + StatusShelves + AggregateCallout.
 *
 * Mode transitions happen naturally via TanStack Query invalidation of the
 * ['decks'] key from mutations (untrack, import, add-card).
 *
 * The `tag` URL search param drives OR-logic tag filtering: only decks with
 * at least one of the active tags are shown in the StatusShelves.
 */
function HomePage(): React.ReactElement {
  const { t } = useTranslation();
  const decksQuery = useDecksQuery();
  const untrackMutation = useUntrackDeckMutation();
  const { tag: activeFilterTags } = Route.useSearch();
  const navigate = useNavigate();

  // All hooks must be called unconditionally before any early returns.
  // Compute derived data from query results; guard with empty fallbacks.
  const data = decksQuery.data;
  // Stabilise the trackedDecks reference so downstream useMemo hooks only
  // recompute when the actual data changes, not on every render.
  const trackedDecks = useMemo(
    () => data?.trackedDecks ?? [],
    [data],
  );

  // Derive distinct tags across all user decks for TagFilterChips
  // (sorted alphabetically for predictable chip order).
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const deck of trackedDecks) {
      for (const tag of deck.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [trackedDecks]);

  // Filter activeFilterTags to only include tags that exist in the user's decks
  // (unknown tags from hand-crafted URLs are silently ignored).
  const validActiveFilterTags = useMemo(
    () => activeFilterTags.filter((tag) => availableTags.includes(tag)),
    [activeFilterTags, availableTags],
  );

  // Tag filter change handler — updates the URL search param.
  // Owned here so the navigate call is typed against the home route's search schema.
  const handleFilterChange = useCallback(
    (newTags: readonly string[]) => {
      void navigate({
        to: '/home',
        search: { tag: newTags },
        replace: true,
      });
    },
    [navigate],
  );

  // --- Early returns (AFTER all hooks) ---

  if (decksQuery.isLoading) {
    return <HomeSkeleton />;
  }

  if (decksQuery.isError) {
    return (
      <section role="alert" className={styles.errorSection}>
        <h2 className={styles.errorHeading}>{t('home.errorHeading')}</h2>
        <p className={styles.errorMessage}>
          {(decksQuery.error as Error).message}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => decksQuery.refetch()}
        >
          {t('home.retryButton')}
        </Button>
      </section>
    );
  }

  const collectionCardCount = data?.collectionCardCount ?? 0;

  if (trackedDecks.length === 0) {
    return <EducationalEmptyState collectionCardCount={collectionCardCount} />;
  }

  const totalCardsMissing = data?.totalCardsMissing ?? null;

  const untrackingDeckId =
    untrackMutation.isPending ? (untrackMutation.variables ?? null) : null;

  return (
    <section className={styles.populated}>
      <PopulatedHomeHero
        decks={trackedDecks}
        totalCardsMissing={totalCardsMissing}
      />
      <TagFilterChips
        availableTags={availableTags}
        activeFilterTags={validActiveFilterTags}
        onFilterChange={handleFilterChange}
      />
      <StatusShelves
        decks={trackedDecks}
        onUntrack={(deckId) => untrackMutation.mutate(deckId)}
        untrackingDeckId={untrackingDeckId}
        activeFilterTags={validActiveFilterTags}
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
export function HomeSkeleton(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <section aria-busy="true" aria-live="polite" className={styles.skeleton}>
      {/* Hero skeleton */}
      <div className={styles.skeletonHero}>
        <div className={styles.skeletonHeroLeft}>
          <Skeleton width="120px" height="14px" aria-label={t('home.loadingEyebrow')} />
          <Skeleton width="200px" height="36px" aria-label={t('home.loadingHeadline')} />
          <Skeleton width="280px" height="16px" aria-label={t('home.loadingSummary')} />
        </div>
        <div className={styles.skeletonStats}>
          <Skeleton width="60px" height="56px" aria-label={t('home.loadingStat')} />
          <Skeleton width="60px" height="56px" aria-label={t('home.loadingStat')} />
          <Skeleton width="80px" height="56px" aria-label={t('home.loadingStat')} />
        </div>
      </div>

      {/* Shelf skeletons */}
      {([0, 1] as const).map((i) => (
        <div key={i} className={styles.skeletonShelf}>
          <Skeleton width="160px" height="20px" aria-label={t('home.loadingShelfHeading')} />
          <div className={styles.skeletonGrid}>
            {([0, 1, 2] as const).map((j) => (
              <div key={j} className={styles.skeletonCard} data-testid="skeleton-deck-card">
                <Skeleton width="70%" height="18px" aria-label={t('home.loadingDeckName')} />
                <Skeleton width="50%" height="14px" aria-label={t('home.loadingDeckMeta')} />
                <Skeleton width="80px" height="32px" aria-label={t('home.loadingReadiness')} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
