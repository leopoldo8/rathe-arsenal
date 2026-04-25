import React from 'react';
import type { TReviewRowId, IBulkOperation, IReviewRow } from '../../api/reviews';
import { makeReviewRowId } from '../../api/reviews';
import styles from './ReviewsBulkBar.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IReviewsBulkBarProps {
  readonly selectedIds: ReadonlySet<TReviewRowId>;
  readonly rows: readonly IReviewRow[];
  readonly isBulkPending: boolean;
  readonly onBulkAction: (operations: IBulkOperation[]) => void;
  readonly onClearSelection: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Server-side hard-cap on bulk operations per request.
 * The client caps the selection at this limit and shows a UI hint.
 */
const BULK_MAX_OPS = 200;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ReviewsBulkBar — sticky bottom bar that appears when any rows are selected.
 *
 * Shows the selection count and three bulk action buttons: Approve, Reject,
 * Reset. All three are always enabled regardless of the selection composition
 * (mixed states are fine; the server-side upsert is idempotent). When
 * `isBulkPending` is true, all buttons disable while the request resolves.
 *
 * Caps selection at BULK_MAX_OPS (200) matching the server hard-cap. If the
 * selection exceeds this limit, a status hint is shown and operations are
 * trimmed to the first 200 matching rows.
 *
 * Accessibility: the container uses `role="region"` + `aria-live="polite"` so
 * screen readers announce the bar when selections change.
 */
export function ReviewsBulkBar({
  selectedIds,
  rows,
  isBulkPending,
  onBulkAction,
  onClearSelection,
}: IReviewsBulkBarProps): React.ReactElement | null {
  const count = selectedIds.size;

  // Only render when at least one row is selected.
  if (count === 0) return null;

  const isAtCap = count > BULK_MAX_OPS;

  function buildOperations(
    decision: 'APPROVED' | 'REJECTED' | 'RESET',
  ): IBulkOperation[] {
    return rows
      .filter((row) => selectedIds.has(makeReviewRowId(row.trackedDeckId, row.cardIdentifier)))
      .slice(0, BULK_MAX_OPS)
      .map((row): IBulkOperation => {
        if (decision === 'RESET') {
          return {
            trackedDeckId: row.trackedDeckId,
            cardIdentifier: row.cardIdentifier,
            reset: true,
          };
        }
        return {
          trackedDeckId: row.trackedDeckId,
          cardIdentifier: row.cardIdentifier,
          decision,
        };
      });
  }

  function handleApprove(): void {
    if (isBulkPending) return;
    onBulkAction(buildOperations('APPROVED'));
  }

  function handleReject(): void {
    if (isBulkPending) return;
    onBulkAction(buildOperations('REJECTED'));
  }

  function handleReset(): void {
    if (isBulkPending) return;
    onBulkAction(buildOperations('RESET'));
  }

  const selectionLabel = count === 1 ? '1 selected' : `${count} selected`;

  return (
    <div
      className={styles.bar}
      role="region"
      aria-label="Bulk actions"
      aria-live="polite"
      aria-atomic="false"
    >
      {isAtCap && (
        <div role="status" className={styles.capHint}>
          Capped at {BULK_MAX_OPS} — only the first {BULK_MAX_OPS} selected will be applied.
        </div>
      )}
      <div className={styles.inner}>
        <span className={styles.count}>{selectionLabel}</span>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles['btn--approve']}`}
            disabled={isBulkPending}
            onClick={handleApprove}
            aria-label={`Approve ${count} selected substitutions`}
          >
            Approve selected
          </button>

          <button
            type="button"
            className={`${styles.btn} ${styles['btn--reject']}`}
            disabled={isBulkPending}
            onClick={handleReject}
            aria-label={`Reject ${count} selected substitutions`}
          >
            Reject selected
          </button>

          <button
            type="button"
            className={`${styles.btn} ${styles['btn--reset']}`}
            disabled={isBulkPending}
            onClick={handleReset}
            aria-label={`Reset ${count} selected substitutions to pending`}
          >
            Reset selected
          </button>
        </div>

        <button
          type="button"
          className={styles.clearBtn}
          onClick={onClearSelection}
          aria-label="Clear selection"
          disabled={isBulkPending}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
