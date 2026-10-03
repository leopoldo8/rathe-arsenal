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

  return (
    <div className={styles.summary} data-testid="missing-store-summary">
      <div className={styles.meta}>
        <span className={styles.store}>{t('deckDetail.storePricesAt', { storeName })}</span>
        <span
          className={styles.freshness}
          data-freshness={veryStale ? 'very-stale' : isStale(lastFetchedAt) ? 'stale' : 'ok'}
          title={lastFetchedAt}
        >
          {t('decks.shoppingUpdated', { when })}
        </span>
      </div>

      <div aria-live="polite">
        {availableCardCount > 0 ? (
          <p className={styles.headline}>
            {t('decks.shoppingHeadlineWith')}
            {isEstimated && (
              <span
                aria-label={t('decks.estimatedPriceAria')}
                title={t('decks.estimatedPriceTooltip')}
                className={styles.tilde}
              >
                ~
              </span>
            )}
            {formatBrl(totalCostCents)}{' '}
            {isEstimated && (
              <span className={styles.estimated} data-testid="estimated-badge">
                {t('decks.estimated')}
              </span>
            )}{' '}
            {t('decks.shoppingHeadlineAt', { storeName })} {availableCardCount}{' '}
            {t('decks.shoppingHeadlineMissingCards', { count: totalMissing, total: totalMissing })}.
          </p>
        ) : (
          <>
            <p className={styles.headlineEmpty}>{t('decks.shoppingHeadlineEmpty', { storeName })}</p>
            <p className={styles.noStock}>
              {t('decks.shoppingLastChecked', { when })} &mdash;{' '}
              <a href="#breakdown" className={styles.noStockLink}>
                {t('decks.trySubstitutionEditor')}
              </a>
            </p>
          </>
        )}
      </div>

      {veryStale && (
        <p className={styles.stale} data-testid="missing-store-stale">
          {t('decks.pricesMayHaveChanged')}
        </p>
      )}

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
      {showCta &&
        (isCooldownActive ? (
          <p className={styles.cooldown}>{t('decks.pricesUpToDate')}</p>
        ) : (
          <VariantFetchCta
            onGetExactPrices={onFetchVariants}
            isPending={isPending}
            isError={fetchMutationStatus === 'error'}
          />
        ))}
    </div>
  );
}
