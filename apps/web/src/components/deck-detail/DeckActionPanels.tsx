import React from 'react';
import type { IBreakdown, IDecisionEntry, IBreakdownEntry } from '../../api/deck-detail';
import type { IShoppingLineResponse } from '../../api/shopping-line';
import type { TVariantFetchMutationStatus } from '../ShoppingLine';
import { MissingPanel } from './MissingPanel';
import { SwapsPanel } from './SwapsPanel';
import styles from './DeckActionPanels.module.css';

interface IDeckActionPanelsProps {
  readonly breakdown: IBreakdown;
  readonly decisions: readonly IDecisionEntry[];
  readonly openMissing: readonly IBreakdownEntry[];
  readonly shoppingData: IShoppingLineResponse | null;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
  readonly pendingSubstituteId: string | null;
  readonly onApproveSubstitute: (id: string) => void;
  readonly onRejectSubstitute: (id: string) => void;
  readonly onResetSubstitute: (id: string) => void;
  readonly onFetchVariants: () => void;
  readonly fetchMutationStatus: TVariantFetchMutationStatus;
  readonly isCooldownActive: boolean;
  readonly onPollingChange: (startedAt: number | undefined) => void;
  readonly onShoppingRetry: () => void;
}

export function DeckActionPanels({
  breakdown,
  decisions,
  openMissing,
  shoppingData,
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
  pendingSubstituteId,
  onApproveSubstitute,
  onRejectSubstitute,
  onResetSubstitute,
  onFetchVariants,
  fetchMutationStatus,
  isCooldownActive,
  onPollingChange,
  onShoppingRetry,
}: IDeckActionPanelsProps): React.ReactElement {
  return (
    <div className={styles.row} data-testid="deck-action-panels">
      <MissingPanel
        entries={openMissing}
        shoppingData={shoppingData}
        onMarkOwned={onMarkOwned}
        isMarkingOwned={isMarkingOwned}
        pendingCard={pendingCard}
        onFetchVariants={onFetchVariants}
        fetchMutationStatus={fetchMutationStatus}
        isCooldownActive={isCooldownActive}
        onPollingChange={onPollingChange}
        onShoppingRetry={onShoppingRetry}
      />
      <SwapsPanel
        swaps={breakdown.substituted}
        decisions={decisions}
        pendingSubstituteId={pendingSubstituteId}
        onApprove={onApproveSubstitute}
        onReject={onRejectSubstitute}
        onReset={onResetSubstitute}
      />
    </div>
  );
}
