import React, { useCallback, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useReviewsQuery,
  useBulkReviewsMutation,
  resolveActionLabel,
  buildSuccessMessage,
} from '../../api/reviews';
import type { TReviewRowId, IBulkOperation, IReviewRow } from '../../api/reviews';
import { makeReviewRowId } from '../../api/reviews';
import { useToast } from '../../components/ui/Toast/useToast';
import { ReviewsTabs } from '../../components/reviews/ReviewsTabs';
import type { TTabValue } from '../../components/reviews/ReviewsTabs';
import { ReviewsFilters } from '../../components/reviews/ReviewsFilters';
import type { IReviewsFilters } from '../../components/reviews/ReviewsFilters';
import { ReviewsRowList } from '../../components/reviews/ReviewsRowList';
import { ReviewsBulkBar } from '../../components/reviews/ReviewsBulkBar';
import styles from './reviews.module.css';

// ---------------------------------------------------------------------------
// URL search schema
// ---------------------------------------------------------------------------

interface IReviewsSearch {
  readonly state: TTabValue;
  readonly tier: ReadonlyArray<1 | 2 | 3>;
  readonly deck: readonly string[];
  readonly hero: readonly string[];
  readonly confidenceMin: number;
  readonly confidenceMax: number;
}

export const Route = createFileRoute('/_auth/reviews')({
  component: ReviewsPage,
  validateSearch: (search: Record<string, unknown>): IReviewsSearch => {
    const rawState = search.state as string | undefined;
    const validStates: TTabValue[] = ['pending', 'approved', 'rejected', 'all'];
    const state: TTabValue = validStates.includes(rawState as TTabValue)
      ? (rawState as TTabValue)
      : 'pending';

    const rawTier = search.tier;
    const tier: ReadonlyArray<1 | 2 | 3> = Array.isArray(rawTier)
      ? (rawTier.filter((t) => [1, 2, 3].includes(Number(t))).map(Number) as (1 | 2 | 3)[])
      : [];

    const rawDeck = search.deck;
    const deck: readonly string[] = Array.isArray(rawDeck)
      ? rawDeck.filter((d) => typeof d === 'string')
      : [];

    const rawHero = search.hero;
    const hero: readonly string[] = Array.isArray(rawHero)
      ? rawHero.filter((h) => typeof h === 'string')
      : [];

    const rawConfMin = Number(search.confidenceMin);
    const rawConfMax = Number(search.confidenceMax);
    const confidenceMin = isFinite(rawConfMin)
      ? Math.max(0, Math.min(100, rawConfMin))
      : 0;
    const confidenceMax = isFinite(rawConfMax)
      ? Math.max(0, Math.min(100, rawConfMax))
      : 100;

    return { state, tier, deck, hero, confidenceMin, confidenceMax };
  },
});

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function ReviewsPage(): React.ReactElement {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { show } = useToast();

  const reviewsQuery = useReviewsQuery();
  const bulkMutation = useBulkReviewsMutation();

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<TReviewRowId>>(
    new Set<TReviewRowId>(),
  );

  // --- Derived data ---

  const allRows: readonly IReviewRow[] = reviewsQuery.data?.rows ?? [];

  // Derive available decks + heroes from the full row set for filter chips.
  const availableDecks = useMemo(
    () =>
      deriveUniqueDecks(allRows),
    [allRows],
  );

  const availableHeroes = useMemo(
    () =>
      Array.from(new Set(allRows.map((r) => r.hero))).sort(),
    [allRows],
  );

  // Apply tab filter (state) then attribute filters.
  const filteredRows = useMemo(
    () => applyFilters(allRows, search),
    [allRows, search],
  );

  // Tab counts based on state only (no attribute filters — counts should reflect
  // total rows in each state, not the attribute-filtered subset).
  const tabCounts = useMemo(
    () => computeTabCounts(allRows),
    [allRows],
  );

  // --- URL state writers ---

  function setActiveTab(tab: TTabValue): void {
    // Clear selection when switching tabs.
    setSelectedIds(new Set<TReviewRowId>());
    void navigate({
      search: {
        state: tab,
        tier: search.tier,
        deck: search.deck,
        hero: search.hero,
        confidenceMin: search.confidenceMin,
        confidenceMax: search.confidenceMax,
      },
    });
  }

  function setFilters(filters: IReviewsFilters): void {
    void navigate({
      search: {
        state: search.state,
        tier: filters.tier,
        deck: filters.deck,
        hero: filters.hero,
        confidenceMin: filters.confidenceMin,
        confidenceMax: filters.confidenceMax,
      },
    });
  }

  // --- Selection handlers ---

  const handleToggleSelect = useCallback((id: TReviewRowId): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next as ReadonlySet<TReviewRowId>;
    });
  }, []);

  const handleClearSelection = useCallback((): void => {
    setSelectedIds(new Set<TReviewRowId>());
  }, []);

  // --- Bulk action handler (per-row single actions flow through here too) ---

  const handleAction = useCallback(
    (operations: IBulkOperation[]): void => {
      const actionLabel = resolveActionLabel(operations);
      bulkMutation.mutate(operations, {
        onSuccess: (result) => {
          // Clear selection after any bulk action.
          setSelectedIds(new Set<TReviewRowId>());

          // Show toast based on server result.
          if (result.transactionError) {
            show({
              kind: 'error',
              message: "Some changes couldn't be saved — please try again",
            });
          } else {
            show({
              kind: 'success',
              message: buildSuccessMessage(actionLabel, result.succeeded),
            });
          }
        },
        onError: () => {
          // Network / 4xx / 5xx — consolidated single error toast.
          show({
            kind: 'error',
            message: "Some changes couldn't be saved — please try again",
          });
        },
      });
    },
    [bulkMutation, show],
  );

  // --- Navigate to approved tab (empty state CTA) ---

  const handleNavigateApproved = useCallback((): void => {
    void navigate({
      search: {
        state: 'approved' as TTabValue,
        tier: search.tier,
        deck: search.deck,
        hero: search.hero,
        confidenceMin: search.confidenceMin,
        confidenceMax: search.confidenceMax,
      },
    });
  }, [navigate, search]);

  // --- Current filters object for the filter bar ---

  const currentFilters: IReviewsFilters = {
    tier: search.tier,
    deck: search.deck,
    hero: search.hero,
    confidenceMin: search.confidenceMin,
    confidenceMax: search.confidenceMax,
  };

  return (
    <div className={styles.page}>
      {/* Page heading */}
      <div className={styles.header}>
        <h1 className={styles.heading}>Reviews</h1>
        <p className={styles.subtitle}>
          Approve or reject substitution suggestions across all your tracked decks.
        </p>
      </div>

      {/* Filters bar */}
      <ReviewsFilters
        filters={currentFilters}
        availableDecks={availableDecks}
        availableHeroes={availableHeroes}
        onChange={setFilters}
      />

      {/* Tabs + row list */}
      <ReviewsTabs
        value={search.state}
        counts={tabCounts}
        onChange={setActiveTab}
      >
        <ReviewsRowList
          rows={filteredRows}
          isLoading={reviewsQuery.isLoading}
          isError={reviewsQuery.isError}
          onRetry={() => reviewsQuery.refetch()}
          selectedIds={selectedIds}
          isBulkPending={bulkMutation.isPending}
          activeState={search.state}
          totalRowCount={allRows.length}
          onToggleSelect={handleToggleSelect}
          onAction={handleAction}
          onNavigateApproved={handleNavigateApproved}
        />
      </ReviewsTabs>

      {/* Sticky bulk bar */}
      <ReviewsBulkBar
        selectedIds={selectedIds}
        rows={allRows}
        isBulkPending={bulkMutation.isPending}
        onBulkAction={handleAction}
        onClearSelection={handleClearSelection}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Filters `allRows` according to the active tab state and attribute filters.
 */
function applyFilters(
  rows: readonly IReviewRow[],
  search: IReviewsSearch,
): readonly IReviewRow[] {
  return rows.filter((row) => {
    // Tab filter (state)
    if (search.state !== 'all' && row.decision !== search.state) return false;

    // Tier filter
    if (search.tier.length > 0 && !search.tier.includes(row.tier)) return false;

    // Deck filter (uses trackedDeckId as string)
    if (
      search.deck.length > 0 &&
      !search.deck.includes(String(row.trackedDeckId))
    )
      return false;

    // Hero filter
    if (search.hero.length > 0 && !search.hero.includes(row.hero)) return false;

    // Confidence range
    if (row.confidence < search.confidenceMin || row.confidence > search.confidenceMax)
      return false;

    return true;
  });
}

/**
 * Derives per-state counts for the tab badges from the full row set.
 * The "All" count is the total regardless of state.
 */
function computeTabCounts(rows: readonly IReviewRow[]): {
  pending: number;
  approved: number;
  rejected: number;
  all: number;
} {
  let pending = 0;
  let approved = 0;
  let rejected = 0;

  for (const row of rows) {
    if (row.decision === 'pending') pending++;
    else if (row.decision === 'approved') approved++;
    else if (row.decision === 'rejected') rejected++;
  }

  return { pending, approved, rejected, all: rows.length };
}

/**
 * Derives a deduplicated list of {id, name} deck options from the row set.
 * Uses trackedDeckId as the id value (stringified for the filter URL param).
 */
function deriveUniqueDecks(
  rows: readonly IReviewRow[],
): ReadonlyArray<{ readonly id: string; readonly name: string }> {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const id = String(row.trackedDeckId);
    if (!seen.has(id)) {
      seen.set(id, row.deckName);
    }
  }
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
}

// Re-export makeReviewRowId so tests can use it without importing from api.
export { makeReviewRowId };
