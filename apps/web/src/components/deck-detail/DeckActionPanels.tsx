import React from 'react';
import type { IBreakdown, IBreakdownEntry } from '../../api/deck-detail';
import type { ISwapRow } from '../../api/swaps';
import type { IAlternativesTarget, IDeckReplacement } from '../../api/replacements';
import type { IShoppingLineResponse } from '../../api/shopping-line';
import type { TVariantFetchMutationStatus } from '../ShoppingLine';
import { MissingPanel } from './MissingPanel';
import { SwapsPanel } from './SwapsPanel';
import styles from './DeckActionPanels.module.css';

interface IDeckActionPanelsProps {
  readonly breakdown: IBreakdown;
  readonly deckSwaps: readonly ISwapRow[];
  readonly openMissing: readonly IBreakdownEntry[];
  readonly shoppingData: IShoppingLineResponse | null;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
  readonly pendingSwapId: string | null;
  readonly onApproveSwap: (swapId: string) => void;
  readonly onRejectSwap: (swapId: string) => void;
  readonly onUndoSwap: (swapId: string, decision: 'approved' | 'rejected') => void;
  readonly onFetchVariants: () => void;
  readonly fetchMutationStatus: TVariantFetchMutationStatus;
  readonly isCooldownActive: boolean;
  readonly onPollingChange: (startedAt: number | undefined) => void;
  readonly onShoppingRetry: () => void;
  readonly replacements: readonly IDeckReplacement[];
  readonly onOpenAlternatives: (target: IAlternativesTarget) => void;
}

export function DeckActionPanels({
  breakdown,
  deckSwaps,
  openMissing,
  shoppingData,
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
  pendingSwapId,
  onApproveSwap,
  onRejectSwap,
  onUndoSwap,
  onFetchVariants,
  fetchMutationStatus,
  isCooldownActive,
  onPollingChange,
  onShoppingRetry,
  replacements,
  onOpenAlternatives,
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
        replacements={replacements}
        onOpenAlternatives={onOpenAlternatives}
      />
      <SwapsPanel
        swaps={breakdown.substituted}
        deckSwaps={deckSwaps}
        pendingSwapId={pendingSwapId}
        onApprove={onApproveSwap}
        onReject={onRejectSwap}
        onUndo={onUndoSwap}
        onOpenAlternatives={onOpenAlternatives}
      />
    </div>
  );
}
