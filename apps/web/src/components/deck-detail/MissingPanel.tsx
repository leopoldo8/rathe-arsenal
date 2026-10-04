import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IBreakdownEntry } from '../../api/deck-detail';
import type { IShoppingLineResponse } from '../../api/shopping-line';
import type { TVariantFetchMutationStatus } from '../ShoppingLine';
import { useVariantFetchPolling } from '../useVariantFetchPolling';
import { MarkOwnedButton } from './MarkOwnedButton';
import { MissingRowBuy, MissingRowStoreMeta, MissingRowVariants } from './MissingRowStore';
import { MissingStoreSummary } from './MissingStoreSummary';
import { entryKey } from './deckDetailModel';
import { resolveRowStore } from './missingStoreModel';
import { MISSING_PANEL_ID } from './DeckStatusStrip';
import styles from './MissingPanel.module.css';

interface IMissingPanelProps {
  readonly entries: readonly IBreakdownEntry[];
  readonly shoppingData: IShoppingLineResponse | null;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
  readonly onFetchVariants: () => void;
  readonly fetchMutationStatus: TVariantFetchMutationStatus;
  readonly isCooldownActive: boolean;
  readonly onPollingChange: (startedAt: number | undefined) => void;
  readonly onShoppingRetry: () => void;
}

const PITCH_CLASS = {
  1: styles.pitchRed ?? '',
  2: styles.pitchYellow ?? '',
  3: styles.pitchBlue ?? '',
} as const;

function pitchClass(pitch: IBreakdownEntry['pitch']): string {
  return pitch === null ? (styles.pitchNone ?? '') : PITCH_CLASS[pitch];
}

export function MissingPanel({
  entries,
  shoppingData,
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
  onFetchVariants,
  fetchMutationStatus,
  isCooldownActive,
  onPollingChange,
  onShoppingRetry,
}: IMissingPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const populated = shoppingData?.kind === 'populated' ? shoppingData : null;
  const isFetching = useVariantFetchPolling(populated?.variantFetchProgress, onPollingChange);
  const cardStatus = populated?.variantFetchProgress?.cards;

  return (
    <section
      id={MISSING_PANEL_ID}
      className={styles.panel}
      aria-labelledby="deck-missing-title"
      data-testid="deck-missing-panel"
    >
      <h2 id="deck-missing-title" className={styles.title}>
        {t('deckDetail.missingTitle')}
      </h2>
      {populated !== null && (
        <MissingStoreSummary
          data={populated}
          isFetching={isFetching}
          onFetchVariants={onFetchVariants}
          fetchMutationStatus={fetchMutationStatus}
          isCooldownActive={isCooldownActive}
        />
      )}
      {shoppingData?.kind === 'error' && (
        <div role="status" className={styles.storeError}>
          <span>{t('decks.shoppingUnavailable')}</span>
          <button type="button" onClick={onShoppingRetry} className={styles.retry}>
            {t('decks.retry')}
          </button>
        </div>
      )}
      {entries.length === 0 ? (
        <p className={styles.empty}>{t('deckDetail.missingEmpty')}</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => {
            const store = resolveRowStore(shoppingData, entry.cardIdentifier);
            return (
              <li key={entryKey(entry)} className={styles.row} data-testid="missing-row">
                <span className={`${styles.pitchBar} ${pitchClass(entry.pitch)}`} aria-hidden="true" />
                <div className={styles.body}>
                  <span className={styles.name}>{entry.name}</span>
                  <span className={styles.meta} data-testid="missing-row-meta">
                    {entry.slot !== 'mainboard' && (
                      <span>{t(`swaps.slot.${entry.slot}`, { defaultValue: entry.slot })} </span>
                    )}
                    <MissingRowStoreMeta
                      store={store}
                      storeName={populated?.storeName ?? ''}
                      cardName={entry.name}
                      fetchStatus={cardStatus?.[entry.cardIdentifier]}
                    />
                  </span>
                </div>
                <span className={styles.qty}>{t('deckDetail.missingCopies', { count: entry.quantity })}</span>
                <span className={styles.action}>
                  <MissingRowBuy store={store} cardName={entry.name} />
                </span>
                <span className={styles.owned}>
                  <MarkOwnedButton
                    cardIdentifier={entry.cardIdentifier}
                    onMarkOwned={onMarkOwned}
                    isPending={isMarkingOwned}
                    pendingCard={pendingCard}
                  />
                </span>
                <MissingRowVariants store={store} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
