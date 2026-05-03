import React, { useCallback, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useReviewsQuery,
  useBulkReviewsMutation,
  resolveActionLabel,
  buildSuccessMessage,
} from '../../api/reviews';
import type { TReviewRowId, IBulkOperation, IReviewRow } from '../../api/reviews';
import { useToast } from '../../components/ui/Toast/useToast';
import { ReviewsTabs } from '../../components/reviews/ReviewsTabs';
import type { TTabValue } from '../../components/reviews/ReviewsTabs';
import { ReviewsFilters } from '../../components/reviews/ReviewsFilters';
import type { IReviewsFilters } from '../../components/reviews/ReviewsFilters.helpers';
import { ReviewsRowList } from '../../components/reviews/ReviewsRowList';
import { ReviewsBulkBar } from '../../components/reviews/ReviewsBulkBar';
import { applyFilters, computeTabCounts, deriveUniqueDecks } from './-swaps.helpers';
import type { ISwapsSearch } from './-swaps.helpers';
import styles from './swaps.module.css';

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

/** Stable empty array used as fallback for allRows to avoid a new reference each render. */
const EMPTY_ROWS: readonly IReviewRow[] = [];

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/_auth/swaps')({
  component: SwapsPage,
  validateSearch: (search: Record<string, unknown>): ISwapsSearch => {
    const rawState = search.state as string | undefined;
    const validStates = ['pending', 'approved', 'rejected', 'all'] as const;
    const state = validStates.includes(rawState as (typeof validStates)[number])
      ? (rawState as ISwapsSearch['state'])
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

export function SwapsPage(): React.ReactElement {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { show } = useToast();

  const reviewsQuery = useReviewsQuery();
  const bulkMutation = useBulkReviewsMutation();

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<TReviewRowId>>(
    new Set<TReviewRowId>(),
  );

  // --- Derived data ---

  const reviewsData = reviewsQuery.data;
  // Memoized so downstream useMemo hooks receive a stable reference and only
  // recompute when the server response actually changes.
  const allRows = useMemo<readonly IReviewRow[]>(
    () => reviewsData?.rows ?? EMPTY_ROWS,
    [reviewsData],
  );

  // Derive available decks + heroes from the full row set for filter chips.
  const availableDecks = useMemo(
    () => deriveUniqueDecks(allRows),
    [allRows],
  );

  const availableHeroes = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.hero))).sort(),
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
        <h1 className={styles.heading}>Swaps</h1>
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
