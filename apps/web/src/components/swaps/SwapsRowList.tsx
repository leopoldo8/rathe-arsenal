import React from 'react';
import { useTranslation } from 'react-i18next';
import { SwapRow } from './SwapRow';
import type { TResolvedSwap } from './SwapRow';
import { SwapsEmptyState } from './SwapsEmptyState';
import type { IRejectSubmission } from './SwapRejectPanel';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import type { ISwapRow, TSwapOutcome } from '../../api/swaps';
import type { TTabValue } from './SwapsTabs';
import styles from './SwapsRowList.module.css';

const SKELETON_COUNT = 5;

export interface ISwapRowHandlers {
  readonly onToggleSelect: (id: string) => void;
  readonly onApprove: (row: ISwapRow) => Promise<boolean>;
  readonly onReject: (row: ISwapRow, submission: IRejectSubmission) => Promise<boolean>;
  readonly onRevert: (row: ISwapRow) => Promise<boolean>;
  readonly onRestore: (row: ISwapRow) => Promise<boolean>;
  readonly onUndo: (row: ISwapRow, resolved: TResolvedSwap) => Promise<boolean>;
  readonly onOutcome: (row: ISwapRow, outcome: TSwapOutcome) => Promise<boolean>;
}

interface ISwapsRowListProps extends ISwapRowHandlers {
  readonly rows: readonly ISwapRow[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly onRetry: () => void;
  readonly selectedIds: ReadonlySet<string>;
  readonly busyIds: ReadonlySet<string>;
  readonly resolvedById: ReadonlyMap<string, TResolvedSwap>;
  readonly activeState: TTabValue;
  readonly totalRowCount: number;
  readonly hasActiveFilters: boolean;
  readonly onNavigateHome: () => void;
  readonly onNavigateApproved: () => void;
}

function resolveEmptyVariant(
  totalRowCount: number,
  activeState: TTabValue,
  hasFiltersApplied: boolean,
): 'no-subs' | 'all-reviewed' | 'none-approved' | 'none-rejected' | 'no-results' {
  if (totalRowCount === 0) return 'no-subs';
  if (hasFiltersApplied) return 'no-results';
  if (activeState === 'pending') return 'all-reviewed';
  if (activeState === 'approved') return 'none-approved';
  if (activeState === 'rejected') return 'none-rejected';
  return 'no-results';
}

export function SwapsRowList({
  rows,
  isLoading,
  isError,
  onRetry,
  selectedIds,
  busyIds,
  resolvedById,
  activeState,
  totalRowCount,
  hasActiveFilters,
  onNavigateHome,
  onNavigateApproved,
  ...handlers
}: ISwapsRowListProps): React.ReactElement {
  const { t } = useTranslation();

  if (isLoading) return <SwapsRowListSkeleton />;

  if (isError) {
    return (
      <div role="alert" className={styles.error}>
        <p className={styles.errorMessage}>{t('swaps.errorMessage')}</p>
        <button type="button" className={styles.retryBtn} onClick={onRetry}>
          {t('swaps.retry')}
        </button>
      </div>
    );
  }

  if (rows.length === 0) {
    const variant = resolveEmptyVariant(totalRowCount, activeState, hasActiveFilters);
    return (
      <SwapsEmptyState
        variant={variant}
        onNavigate={variant === 'no-subs' ? onNavigateHome : onNavigateApproved}
      />
    );
  }

  return (
    <ul className={styles.list} aria-label={t('swaps.listAria', { count: rows.length })}>
      {rows.map((row) => (
        <li key={row.id} className={styles.item}>
          <SwapRow
            row={row}
            resolved={resolvedById.get(row.id) ?? null}
            isSelected={selectedIds.has(row.id)}
            isBusy={busyIds.has(row.id)}
            {...handlers}
          />
        </li>
      ))}
    </ul>
  );
}

function SwapsRowListSkeleton(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={styles.skeleton}
      aria-label={t('swaps.loadingAria')}
    >
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <Skeleton key={index} width="100%" height="84px" />
      ))}
    </div>
  );
}
