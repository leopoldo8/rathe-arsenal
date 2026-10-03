import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TCardFetchStatus } from '../../api/shopping-line';
import { formatBrl } from '../../utils/format-brl';
import { VariantBreakdownTable } from '../ShoppingLineVariantBreakdown';
import { formatVariantPrice } from '../ShoppingLineVariantBreakdown.helpers';
import type { TRowStore } from './missingStoreModel';
import styles from './MissingPanel.module.css';

interface IMissingRowStoreProps {
  readonly store: TRowStore;
  readonly storeName: string;
  readonly cardName: string;
  readonly fetchStatus: TCardFetchStatus | undefined;
}

export function MissingRowStore({
  store,
  storeName,
  cardName,
  fetchStatus,
}: IMissingRowStoreProps): React.ReactElement | null {
  const { t } = useTranslation();
  if (store.kind === 'none') return null;

  if (store.kind === 'unavailable') {
    return (
      <span className={styles.unavailable} data-testid="missing-row-unavailable">
        {store.verifiedZero
          ? t('deckDetail.storeOutOfStockVerified', { storeName })
          : t('deckDetail.storeUnavailable', { storeName })}
      </span>
    );
  }

  const { line, buyUrl } = store;
  const cheapest = line.hasVariantData === true ? line.variants?.[0] : undefined;
  const price =
    cheapest !== undefined
      ? formatVariantPrice(cheapest)
      : line.unitPriceCents === null
        ? t('decks.priceOnRequest')
        : `~${formatBrl(line.unitPriceCents)}`;
  const isPartial = line.quantityAvailable < line.quantityNeeded;

  return (
    <>
      {fetchStatus === 'failed' && (
        <span
          role="status"
          aria-label={t('decks.failedToFetchVariants', { name: cardName })}
          data-testid="line-item-fetch-failed"
          className={styles.failedBadge}
        >
          {t('deckDetail.storeFetchFailed')}
        </span>
      )}
      {isPartial && (
        <span className={styles.partial}>
          {t('deckDetail.storeAvailablePartial', {
            available: line.quantityAvailable,
            needed: line.quantityNeeded,
          })}
        </span>
      )}
      <span className={styles.price} data-testid="missing-row-price">
        {price}
      </span>
      {buyUrl !== null && (
        <a
          href={buyUrl}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          className={styles.buy}
          aria-label={t('deckDetail.buyAria', { name: cardName })}
        >
          {t('deckDetail.buy')}
        </a>
      )}
    </>
  );
}

interface IMissingRowVariantsProps {
  readonly store: TRowStore;
}

export function MissingRowVariants({ store }: IMissingRowVariantsProps): React.ReactElement | null {
  const { t } = useTranslation();
  if (store.kind !== 'available') return null;
  const { line } = store;
  const variants = line.hasVariantData === true ? line.variants : undefined;
  if (variants === undefined || variants.length <= 1) return null;
  return (
    <details data-testid="variant-breakdown-details" className={styles.variants}>
      <summary className={styles.variantsSummary}>
        {t('decks.variantMoreCount', { count: variants.length - 1 })}
      </summary>
      <VariantBreakdownTable variants={variants} />
    </details>
  );
}
