import React from 'react';
import { ReviewsRow } from './ReviewsRow';
import { ReviewsEmptyState } from './ReviewsEmptyState';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import type {
  IReviewRow,
  TReviewRowId,
  IBulkOperation,
  TReviewState,
} from '../../api/reviews';
import { makeReviewRowId } from '../../api/reviews';
import styles from './ReviewsRowList.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IReviewsRowListProps {
  readonly rows: readonly IReviewRow[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly onRetry: () => void;
  readonly selectedIds: ReadonlySet<TReviewRowId>;
  readonly isBulkPending: boolean;
  readonly activeState: TReviewState | 'all';
  readonly totalRowCount: number;
  readonly onToggleSelect: (id: TReviewRowId) => void;
  readonly onAction: (operations: IBulkOperation[]) => void;
  readonly onNavigateApproved?: (() => void) | undefined;
}

// ---------------------------------------------------------------------------
// Skeleton constant
// ---------------------------------------------------------------------------

const SKELETON_COUNT = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ReviewsRowList — renders the main row list within the Reviews page.
 *
 * Delegates each row to `ReviewsRow`. Handles loading (skeleton), error
 * (inline retry), and empty states (no-subs, all-reviewed, no-results).
 */
export function ReviewsRowList({
  rows,
  isLoading,
  isError,
  onRetry,
  selectedIds,
  isBulkPending,
  activeState,
  totalRowCount,
  onToggleSelect,
  onAction,
  onNavigateApproved,
}: IReviewsRowListProps): React.ReactElement {
  // --- Loading ---
  if (isLoading) {
    return <ReviewsRowListSkeleton />;
  }

  // --- Error ---
  if (isError) {
    return (
      <div role="alert" className={styles.error}>
        <p className={styles.errorMessage}>Something went wrong loading reviews.</p>
        <button type="button" className={styles.retryBtn} onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  // --- Empty states ---
  if (rows.length === 0) {
    if (totalRowCount === 0) {
      // No substitutions at all across any deck.
      return (
        <ReviewsEmptyState
          variant="no-subs"
          onNavigate={onNavigateApproved}
        />
      );
    }

    if (activeState === 'pending') {
      // Pending tab is empty but other tabs have rows.
      return (
        <ReviewsEmptyState
          variant="all-reviewed"
          onNavigate={onNavigateApproved}
        />
      );
    }

    // Active filter or tab returned no rows.
    return <ReviewsEmptyState variant="no-results" />;
  }

  // --- Populated ---
  return (
    <div
      className={styles.list}
      role="list"
      aria-label={`Substitution reviews — ${rows.length} items`}
    >
      {rows.map((row) => {
        const id = makeReviewRowId(row.trackedDeckId, row.cardIdentifier);
        return (
          <div key={id} role="listitem">
            <ReviewsRow
              row={row}
              isSelected={selectedIds.has(id)}
              isBulkPending={isBulkPending}
              onToggleSelect={onToggleSelect}
              onAction={onAction}
            />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ReviewsRowListSkeleton(): React.ReactElement {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={styles.skeleton}
      aria-label="Loading reviews"
    >
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div key={i} className={styles.skeletonRow}>
          <Skeleton width="1rem" height="1rem" aria-label="Loading checkbox" />
          <Skeleton width="72px" height="103px" aria-label="Loading card" />
          <Skeleton width="2rem" height="1.25rem" aria-label="Loading connector" />
          <Skeleton width="72px" height="103px" aria-label="Loading card" />
          <div className={styles.skeletonMeta}>
            <Skeleton width="140px" height="14px" aria-label="Loading deck name" />
            <Skeleton width="80px" height="14px" aria-label="Loading tier" />
            <Skeleton width="200px" height="12px" aria-label="Loading rationale" />
            <div className={styles.skeletonActions}>
              <Skeleton width="72px" height="32px" aria-label="Loading action" />
              <Skeleton width="72px" height="32px" aria-label="Loading action" />
              <Skeleton width="64px" height="32px" aria-label="Loading action" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
