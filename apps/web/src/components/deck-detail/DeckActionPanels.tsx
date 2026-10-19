import React from 'react';
import type { IBreakdownEntry, ISubstitutedEntry } from '../../api/deck-detail';
import type { IAlternativesTarget, IDeckReplacement } from '../../api/replacements';
import type { IShoppingLineResponse } from '../../api/shopping-line';
import type { TVariantFetchMutationStatus } from '../ShoppingLine';
import { MissingPanel } from './MissingPanel';
import styles from './DeckActionPanels.module.css';

interface IDeckActionPanelsProps {
  readonly deckId: number;
  readonly openMissing: readonly IBreakdownEntry[];
  readonly suggestions: ReadonlyMap<string, ISubstitutedEntry>;
  readonly shoppingData: IShoppingLineResponse | null;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
  readonly onFetchVariants: () => void;
  readonly fetchMutationStatus: TVariantFetchMutationStatus;
  readonly isCooldownActive: boolean;
  readonly onPollingChange: (startedAt: number | undefined) => void;
  readonly onShoppingRetry: () => void;
  readonly replacements: readonly IDeckReplacement[];
  readonly onOpenAlternatives: (target: IAlternativesTarget) => void;
  readonly onShareMissing?: (() => void) | undefined;
}

export function DeckActionPanels({
  deckId,
  openMissing,
  suggestions,
  shoppingData,
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
  onFetchVariants,
  fetchMutationStatus,
  isCooldownActive,
  onPollingChange,
  onShoppingRetry,
  replacements,
  onOpenAlternatives,
  onShareMissing,
}: IDeckActionPanelsProps): React.ReactElement {
  return (
    <div className={styles.row} data-testid="deck-action-panels">
      <MissingPanel
        deckId={deckId}
        entries={openMissing}
        suggestions={suggestions}
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
        onShareMissing={onShareMissing}
      />
    </div>
  );
}
