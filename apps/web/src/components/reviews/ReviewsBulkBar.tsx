import React from 'react';
import { useTranslation } from 'react-i18next';
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
}: IReviewsBulkBarProps): React.ReactElement {
  const { t } = useTranslation();
  const count = selectedIds.size;

  // Pre-mount the aria-live region even when nothing is selected so screen
  // readers can announce the bar appearing when the first row is checked
  // (UXUI-13 AC5). Interactive controls are hidden until count > 0.
  if (count === 0) {
    return (
      <div
        role="region"
        aria-label={t('reviews.bulkActionsAria')}
        aria-live="polite"
        aria-atomic="false"
      />
    );
  }

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
            // Key by SUBSTITUTE id — consistent with per-row actions and what
            // deck-detail / loadExclusions look up by.
            cardIdentifier: row.substituteIdentifier,
            reset: true,
          };
        }
        return {
          trackedDeckId: row.trackedDeckId,
          // Key by SUBSTITUTE id — same reason as above.
          cardIdentifier: row.substituteIdentifier,
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

  return (
    <div
      className={styles.bar}
      role="region"
      aria-label={t('reviews.bulkActionsAria')}
      aria-live="polite"
      aria-atomic="false"
    >
      {isAtCap && (
        <div role="status" className={styles.capHint}>
          {t('reviews.cappedHint', { max: BULK_MAX_OPS })}
        </div>
      )}
      <div className={styles.inner}>
        <span className={styles.count}>{t('reviews.selectedCount', { count })}</span>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles['btn--approve']}`}
            disabled={isBulkPending}
            onClick={handleApprove}
            aria-label={t('reviews.approveSelectedAria', { count })}
          >
            {t('reviews.approveSelected')}
          </button>

          <button
            type="button"
            className={`${styles.btn} ${styles['btn--reject']}`}
            disabled={isBulkPending}
            onClick={handleReject}
            aria-label={t('reviews.rejectSelectedAria', { count })}
          >
            {t('reviews.rejectSelected')}
          </button>

          <button
            type="button"
            className={`${styles.btn} ${styles['btn--reset']}`}
            disabled={isBulkPending}
            onClick={handleReset}
            aria-label={t('reviews.resetSelectedAria', { count })}
          >
            {t('reviews.resetSelected')}
          </button>
        </div>

        <button
          type="button"
          className={styles.clearBtn}
          onClick={onClearSelection}
          aria-label={t('reviews.clearSelectionAria')}
          disabled={isBulkPending}
        >
          {t('reviews.clear')}
        </button>
      </div>
    </div>
  );
}
