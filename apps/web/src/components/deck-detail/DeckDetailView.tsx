import React, { useMemo } from 'react';
import type { IDeckDetailResponse, IDeckDetailSnapshot } from '../../api/deck-detail';
import type { IShoppingLineResponse } from '../../api/shopping-line';
import type { ISwapRow } from '../../api/swaps';
import type { ITagResponse } from '../../api/tags';
import type { TVariantFetchMutationStatus } from '../ShoppingLine';
import { DeckActionPanels } from './DeckActionPanels';
import { DeckAnalysisRow } from './DeckAnalysisRow';
import { DeckHeroBanner } from './DeckHeroBanner';
import { DeckList } from './DeckList';
import { DeckStatusStrip } from './DeckStatusStrip';
import { ModifiedViewBanner } from './ModifiedViewBanner';
import { TagChipRow } from './TagChipRow';
import { summariseDeck } from './deckDetailModel';
import { buildDeckList } from './deckListModel';
import styles from './DeckDetailView.module.css';

interface IDeckDetailViewProps {
  readonly deck: IDeckDetailResponse;
  readonly snapshot: IDeckDetailSnapshot;
  readonly tags: readonly ITagResponse[];
  readonly shoppingData: IShoppingLineResponse | null;
  readonly onEdit: () => void;
  readonly onEditCards: () => void;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
  readonly deckSwaps: readonly ISwapRow[];
  readonly pendingSwapId: string | null;
  readonly onApproveSwap: (swapId: string) => void;
  readonly onRejectSwap: (swapId: string) => void;
  readonly onUndoSwap: (swapId: string, decision: 'approved' | 'rejected') => void;
  readonly onClearRejections: () => void;
  readonly isClearingRejections: boolean;
  readonly onFetchVariants: () => void;
  readonly fetchMutationStatus: TVariantFetchMutationStatus;
  readonly isCooldownActive: boolean;
  readonly onPollingChange: (startedAt: number | undefined) => void;
  readonly onShoppingRetry: () => void;
}

export function DeckDetailView({
  deck,
  snapshot,
  tags,
  shoppingData,
  onEdit,
  onEditCards,
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
  deckSwaps,
  pendingSwapId,
  onApproveSwap,
  onRejectSwap,
  onUndoSwap,
  onClearRejections,
  isClearingRejections,
  onFetchVariants,
  fetchMutationStatus,
  isCooldownActive,
  onPollingChange,
  onShoppingRetry,
}: IDeckDetailViewProps): React.ReactElement {
  const summary = useMemo(
    () =>
      summariseDeck({
        pct: snapshot.effectivePercent,
        path: snapshot.path,
        breakdown: snapshot.breakdown,
        swaps: deckSwaps,
      }),
    [snapshot, deckSwaps],
  );
  const rejectedCount = useMemo(
    () => deckSwaps.filter((swap) => swap.status === 'rejected').length,
    [deckSwaps],
  );
  const items = useMemo(
    () => buildDeckList(snapshot.breakdown, summary.openMissing),
    [snapshot.breakdown, summary.openMissing],
  );

  return (
    <div className={styles.stack} data-testid="deck-detail-view">
      <DeckHeroBanner
        deckId={deck.id}
        deckName={deck.name}
        status={deck.status}
        format={deck.format}
        leagueTag={tags[0]?.name ?? null}
        heroIdentifier={deck.heroIdentifier}
        heroFallbackName={deck.hero}
        pct={snapshot.effectivePercent}
        onEdit={onEdit}
      />
      <div className={styles.tags}>
        <TagChipRow deckId={deck.id} tags={tags} />
      </div>
      <DeckStatusStrip summary={summary} fabraryUlid={deck.fabraryUlid} />
      {rejectedCount > 0 && (
        <ModifiedViewBanner
          rejectedCount={rejectedCount}
          onClearRejections={onClearRejections}
          isClearing={isClearingRejections}
        />
      )}
      <DeckAnalysisRow
        rawPercent={snapshot.rawPercent}
        fidelityPercent={snapshot.fidelityPercent}
        legality={deck.legality}
        format={deck.format}
        items={items}
      />
      {summary.kind !== 'complete' && (
        <DeckActionPanels
          breakdown={snapshot.breakdown}
          deckSwaps={deckSwaps}
          openMissing={summary.openMissing}
          shoppingData={shoppingData}
          onMarkOwned={onMarkOwned}
          isMarkingOwned={isMarkingOwned}
          pendingCard={pendingCard}
          pendingSwapId={pendingSwapId}
          onApproveSwap={onApproveSwap}
          onRejectSwap={onRejectSwap}
          onUndoSwap={onUndoSwap}
          onFetchVariants={onFetchVariants}
          fetchMutationStatus={fetchMutationStatus}
          isCooldownActive={isCooldownActive}
          onPollingChange={onPollingChange}
          onShoppingRetry={onShoppingRetry}
        />
      )}
      <DeckList items={items} onEditCards={onEditCards} />
    </div>
  );
}
