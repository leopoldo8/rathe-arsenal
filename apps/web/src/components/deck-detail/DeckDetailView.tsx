import React, { useMemo } from 'react';
import type { IDeckDetailResponse, IDeckDetailSnapshot } from '../../api/deck-detail';
import type { IShoppingLineResponse } from '../../api/shopping-line';
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
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
  readonly pendingSubstituteId: string | null;
  readonly onApproveSubstitute: (id: string) => void;
  readonly onRejectSubstitute: (id: string) => void;
  readonly onResetSubstitute: (id: string) => void;
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
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
  pendingSubstituteId,
  onApproveSubstitute,
  onRejectSubstitute,
  onResetSubstitute,
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
        decisions: deck.decisions,
      }),
    [snapshot, deck.decisions],
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
      {deck.rejectedCount > 0 && (
        <ModifiedViewBanner
          rejectedCount={deck.rejectedCount}
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
          decisions={deck.decisions}
          openMissing={summary.openMissing}
          shoppingData={shoppingData}
          onMarkOwned={onMarkOwned}
          isMarkingOwned={isMarkingOwned}
          pendingCard={pendingCard}
          pendingSubstituteId={pendingSubstituteId}
          onApproveSubstitute={onApproveSubstitute}
          onRejectSubstitute={onRejectSubstitute}
          onResetSubstitute={onResetSubstitute}
          onFetchVariants={onFetchVariants}
          fetchMutationStatus={fetchMutationStatus}
          isCooldownActive={isCooldownActive}
          onPollingChange={onPollingChange}
          onShoppingRetry={onShoppingRetry}
        />
      )}
      <DeckList items={items} />
    </div>
  );
}
