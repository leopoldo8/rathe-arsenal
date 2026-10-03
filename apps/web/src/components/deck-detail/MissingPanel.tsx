import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IBreakdownEntry } from '../../api/deck-detail';
import type { IShoppingLineResponse } from '../../api/shopping-line';
import type { TVariantFetchMutationStatus } from '../ShoppingLine';
import { MarkOwnedButton } from './MarkOwnedButton';
import { ShoppingPanel } from './ShoppingPanel';
import { entryKey } from './deckDetailModel';
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

function findProductUrl(shoppingData: IShoppingLineResponse | null, cardIdentifier: string): string | null {
  if (shoppingData === null || shoppingData.kind !== 'populated') return null;
  return shoppingData.lines.find((line) => line.cardIdentifier === cardIdentifier)?.productUrl ?? null;
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
      {entries.length === 0 ? (
        <p className={styles.empty}>{t('deckDetail.missingEmpty')}</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => {
            const productUrl = findProductUrl(shoppingData, entry.cardIdentifier);
            return (
              <li key={entryKey(entry)} className={styles.row} data-testid="missing-row">
                <span className={`${styles.pitchBar} ${pitchClass(entry.pitch)}`} aria-hidden="true" />
                <div className={styles.body}>
                  <span className={styles.name}>{entry.name}</span>
                  <span className={styles.meta}>{entry.slot}</span>
                </div>
                <span className={styles.qty}>{t('deckDetail.missingCopies', { count: entry.quantity })}</span>
                <MarkOwnedButton
                  cardIdentifier={entry.cardIdentifier}
                  onMarkOwned={onMarkOwned}
                  isPending={isMarkingOwned}
                  pendingCard={pendingCard}
                />
                {productUrl !== null && (
                  <a
                    href={productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.buy}
                    aria-label={t('deckDetail.buyAria', { name: entry.name })}
                  >
                    {t('deckDetail.buy')}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ShoppingPanel
        data={shoppingData}
        onFetchVariants={onFetchVariants}
        fetchMutationStatus={fetchMutationStatus}
        isCooldownActive={isCooldownActive}
        onPollingChange={onPollingChange}
        onRetry={onShoppingRetry}
      />
    </section>
  );
}
