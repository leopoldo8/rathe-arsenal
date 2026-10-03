import React from 'react';
import { useTranslation } from 'react-i18next';
import { BULK_MAX_ROWS } from './swap-bulk';
import type { TBulkAction } from './swap-bulk';
import styles from './SwapsBulkBar.module.css';

interface ISwapsBulkBarProps {
  readonly selectedCount: number;
  readonly isBulkRunning: boolean;
  readonly progress: { readonly settled: number; readonly total: number } | null;
  readonly onBulkAction: (action: TBulkAction) => void;
  readonly onClearSelection: () => void;
}

export function SwapsBulkBar({
  selectedCount,
  isBulkRunning,
  progress,
  onBulkAction,
  onClearSelection,
}: ISwapsBulkBarProps): React.ReactElement {
  const { t } = useTranslation();

  // The live region stays mounted while empty so screen readers announce the
  // bar the moment the first row is checked.
  if (selectedCount === 0) {
    return (
      <div
        role="region"
        aria-label={t('swaps.bulkActionsAria')}
        aria-live="polite"
        aria-atomic="false"
      />
    );
  }

  const isAtCap = selectedCount >= BULK_MAX_ROWS;
  const buttons: ReadonlyArray<{
    readonly action: TBulkAction;
    readonly label: string;
    readonly className: string;
  }> = [
    { action: 'approve', label: t('swaps.approveSelected'), className: styles['btn--approve'] ?? '' },
    { action: 'reject', label: t('swaps.rejectSelected'), className: styles['btn--reject'] ?? '' },
    { action: 'reset', label: t('swaps.resetSelected'), className: styles['btn--reset'] ?? '' },
  ];

  return (
    <div
      className={styles.bar}
      role="region"
      aria-label={t('swaps.bulkActionsAria')}
      aria-live="polite"
      aria-atomic="false"
    >
      {isAtCap && (
        <div role="status" className={styles.capHint}>
          {t('swaps.bulkCapped', { max: BULK_MAX_ROWS })}
        </div>
      )}
      <div className={styles.inner}>
        <span className={styles.count}>{t('swaps.selectedCount', { count: selectedCount })}</span>

        <div className={styles.actions}>
          {buttons.map(({ action, label, className }) => (
            <button
              key={action}
              type="button"
              className={`${styles.btn} ${className}`}
              disabled={isBulkRunning}
              onClick={() => onBulkAction(action)}
            >
              {label}
            </button>
          ))}
        </div>

        {progress && (
          <span className={styles.progress} role="status">
            {t('swaps.bulkProgress', { done: progress.settled, total: progress.total })}
          </span>
        )}

        <button
          type="button"
          className={styles.clearBtn}
          onClick={onClearSelection}
          aria-label={t('swaps.clearSelectionAria')}
          disabled={isBulkRunning}
        >
          {t('swaps.clear')}
        </button>
      </div>
    </div>
  );
}
