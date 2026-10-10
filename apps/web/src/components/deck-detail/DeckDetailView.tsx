import React, { useMemo, useState } from 'react';
import type { IDeckDetailResponse, IDeckDetailSnapshot } from '../../api/deck-detail';
import type { IShoppingLineResponse } from '../../api/shopping-line';
import type { IAlternativesTarget } from '../../api/replacements';
import type { ISwapRow } from '../../api/swaps';
import type { ITagResponse } from '../../api/tags';
import type { TVariantFetchMutationStatus } from '../ShoppingLine';
import { AlternativesSheet } from './AlternativesSheet';
import { DeckActionPanels } from './DeckActionPanels';
import { DeckAnalysisRow } from './DeckAnalysisRow';
import { DeckHeroBanner } from './DeckHeroBanner';
import { DeckList } from './DeckList';
import { DeckStatusStrip } from './DeckStatusStrip';
import { ModifiedViewBanner } from './ModifiedViewBanner';
import { RecommendationsPanel, type IRecommendationDeckCard } from './RecommendationsPanel';
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
  const [alternativesTarget, setAlternativesTarget] = useState<IAlternativesTarget | null>(null);
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
  const deckCards = useMemo((): IRecommendationDeckCard[] => {
    const seen = new Map<string, IRecommendationDeckCard>();
    for (const { entry } of items) {
      seen.set(`${entry.cardIdentifier}::${entry.slot}`, {
        cardIdentifier: entry.cardIdentifier,
        name: entry.name,
        slot: entry.slot,
        pitch: entry.pitch,
      });
    }
    return [...seen.values()];
  }, [items]);
  const recommendationsPanel = <RecommendationsPanel deckId={deck.id} deckCards={deckCards} />;

  return (
    <div className={styles.stack} data-testid="deck-detail-view">
      <DeckHeroBanner
        deckId={deck.id}
        deckName={deck.name}
        status={deck.status}
        format={deck.format}
        legality={deck.legality}
        heroIdentifier={deck.heroIdentifier}
        heroFallbackName={deck.hero}
        pct={snapshot.effectivePercent}
        onEdit={onEdit}
      />
      <div className={styles.tags}>
        <TagChipRow deckId={deck.id} tags={tags} />
      </div>
      <DeckStatusStrip
        summary={summary}
        fabraryUlid={deck.fabraryUlid}
        offFormat={deck.legality.category === 'illegal' ? deck.format : null}
        reachPercent={
          Math.round(snapshot.fidelityPercent) > Math.round(snapshot.rawPercent)
            ? Math.round(snapshot.fidelityPercent)
            : null
        }
      />
      {rejectedCount > 0 && (
        <ModifiedViewBanner
          rejectedCount={rejectedCount}
          onClearRejections={onClearRejections}
          isClearing={isClearingRejections}
        />
      )}
      <DeckAnalysisRow items={items} />
      {summary.kind === 'complete' ? (
        <div className={styles.recommendationsRow} data-testid="deck-recommendations-row">
          {recommendationsPanel}
        </div>
      ) : (
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
          replacements={deck.replacements}
          onOpenAlternatives={setAlternativesTarget}
          recommendations={recommendationsPanel}
        />
      )}
      <DeckList items={items} onEditCards={onEditCards} deckId={deck.id} replacements={deck.replacements} />
      {alternativesTarget !== null && (
        <AlternativesSheet
          deckId={deck.id}
          target={alternativesTarget}
          onClose={() => setAlternativesTarget(null)}
        />
      )}
    </div>
  );
}
