import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IShoppingLinePopulated } from '../../api/shopping-line';
import { formatBrl } from '../../utils/format-brl';
import { formatRelativeTime, isStale, isVeryStale } from '../../utils/format-relative-time';
import type { TVariantFetchMutationStatus } from '../ShoppingLine';
import {
  PartialFailureNotice,
  VariantFetchCta,
  VariantFetchProgress,
} from '../ShoppingLineFetchControls';
import styles from './MissingStoreSummary.module.css';

interface IMissingStoreSummaryProps {
  readonly data: IShoppingLinePopulated;
  readonly isFetching: boolean;
  readonly onFetchVariants: () => void;
  readonly fetchMutationStatus: TVariantFetchMutationStatus;
  readonly isCooldownActive: boolean;
}

export function MissingStoreSummary({
  data,
  isFetching,
  onFetchVariants,
  fetchMutationStatus,
  isCooldownActive,
}: IMissingStoreSummaryProps): React.ReactElement {
  const { t } = useTranslation();
  const {
    storeName,
    totalCostCents,
    availableCardCount,
    unavailableCardCount,
    lastFetchedAt,
    isEstimated,
    variantFetchProgress,
  } = data;
  const totalMissing = availableCardCount + unavailableCardCount;
  const when = formatRelativeTime(lastFetchedAt, t);
  const veryStale = isVeryStale(lastFetchedAt);
  const isPending = fetchMutationStatus === 'pending';
  const showCta = Boolean(isEstimated) && !isFetching && totalMissing > 0;
  const showRetryFailed = Boolean(
    variantFetchProgress && !variantFetchProgress.inProgress && variantFetchProgress.failed > 0,
  );
  const freshnessText =
    availableCardCount > 0 ? t('decks.shoppingUpdated', { when }) : t('decks.shoppingLastChecked', { when });

  return (
    <div className={styles.summary} data-testid="missing-store-summary">
      <div className={styles.line}>
        <p className={styles.headline} aria-live="polite">
          {availableCardCount > 0 ? (
            <>
              <span className={styles.total} data-testid="missing-store-total">
                {isEstimated && (
                  <span aria-label={t('decks.estimatedPriceAria')} title={t('decks.estimatedPriceTooltip')}>
                    ~
                  </span>
                )}
                {formatBrl(totalCostCents)}
              </span>{' '}
              {t('deckDetail.storeCoverage', { storeName, available: availableCardCount, count: totalMissing })}
            </>
          ) : (
            <>
              {t('decks.shoppingHeadlineEmpty', { storeName })}
            </>
          )}
          <span className={styles.sep} aria-hidden="true">
            ·
          </span>
          <span
            className={styles.freshness}
            data-freshness={veryStale ? 'very-stale' : isStale(lastFetchedAt) ? 'stale' : 'ok'}
            data-testid={veryStale ? 'missing-store-stale' : undefined}
            title={lastFetchedAt}
          >
            <span className={styles.phrase}>{freshnessText}</span>
            {veryStale && (
              <>
                {' '}
                <span className={styles.phrase}>{t('decks.pricesMayHaveChanged')}</span>
              </>
            )}
          </span>
        </p>
        {showCta &&
          (isCooldownActive ? (
            <span className={styles.cooldown}>{t('decks.pricesUpToDate')}</span>
          ) : (
            <VariantFetchCta
              onGetExactPrices={onFetchVariants}
              isPending={isPending}
              isError={fetchMutationStatus === 'error'}
              appearance="quiet"
            />
          ))}
      </div>

      {isFetching && variantFetchProgress !== undefined && (
        <VariantFetchProgress progress={variantFetchProgress} />
      )}
      {showRetryFailed && variantFetchProgress !== undefined && (
        <PartialFailureNotice
          progress={variantFetchProgress}
          onRetry={onFetchVariants}
          isPending={isPending}
        />
      )}
    </div>
  );
}
