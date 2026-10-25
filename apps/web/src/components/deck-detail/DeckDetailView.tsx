import React, { useMemo, useState } from 'react';
import type { IDeckDetailResponse, IDeckDetailSnapshot } from '../../api/deck-detail';
import type { IShoppingLineResponse } from '../../api/shopping-line';
import type { IAlternativesTarget } from '../../api/replacements';
import type { ITagResponse } from '../../api/tags';
import type { TVariantFetchMutationStatus } from '../ShoppingLine';
import { AlternativesSheet } from './AlternativesSheet';
import { DeckActionPanels } from './DeckActionPanels';
import { DeckAnalysisRow } from './DeckAnalysisRow';
import { DeckHeroBanner } from './DeckHeroBanner';
import { ShareDialog } from './ShareDialog';
import type { TShareIntent } from '../../api/shared-decks';
import { DeckList } from './DeckList';
import { DeckStatusStrip } from './DeckStatusStrip';
import { DeckCauseLine } from './DeckCauseLine';
import type { IRecommendationDeckCard } from './recommendations/card-naming';
import { RecommendationsRail } from './recommendations/RecommendationsRail';
import { TagChipRow } from './TagChipRow';
import { findSuggestions, summariseDeck } from './deckDetailModel';
import { buildDeckList } from './deckListModel';
import { buildListCards } from './deckListCards';
import { CopyListSheet } from './CopyListSheet';
import { HeroOutsideFormatPanel } from './HeroOutsideFormatPanel';
import { hasHeroOutsideFormat } from './heroOutsideFormatModel';
import { useOtherFormatVerdicts } from './useOtherFormatVerdicts';
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
  onFetchVariants,
  fetchMutationStatus,
  isCooldownActive,
  onPollingChange,
  onShoppingRetry,
}: IDeckDetailViewProps): React.ReactElement {
  const [copyListOpen, setCopyListOpen] = useState(false);
  const [alternativesTarget, setAlternativesTarget] = useState<IAlternativesTarget | null>(null);
  const [share, setShare] = useState<{ readonly open: boolean; readonly intent: TShareIntent | null }>({
    open: false,
    intent: null,
  });
  const summary = useMemo(
    () =>
      summariseDeck({
        pct: snapshot.effectivePercent,
        breakdown: snapshot.breakdown,
        replacements: deck.replacements,
      }),
    [snapshot, deck.replacements],
  );
  const suggestions = useMemo(
    () => findSuggestions(snapshot.breakdown, deck.replacements),
    [snapshot.breakdown, deck.replacements],
  );
  const items = useMemo(
    () => buildDeckList(snapshot.breakdown, summary.openMissing),
    [snapshot.breakdown, summary.openMissing],
  );
  const listCards = useMemo(
    () => buildListCards(snapshot.breakdown, summary.openMissing, deck.hero),
    [snapshot.breakdown, summary.openMissing, deck.hero],
  );
  const otherFormats = useOtherFormatVerdicts(deck, snapshot);
  const deckCards = useMemo((): IRecommendationDeckCard[] => {
    const seen = new Map<string, IRecommendationDeckCard>();
    for (const { entry } of items) {
      seen.set(`${entry.cardIdentifier}::${entry.slot}`, {
        cardIdentifier: entry.cardIdentifier,
        name: entry.name,
        slot: entry.slot,
        pitch: entry.pitch,
        cost: entry.cost,
        imageUrl: entry.imageUrl,
      });
    }
    return [...seen.values()];
  }, [items]);

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
        onShare={() => setShare({ open: true, intent: null })}
        onCopyList={() => setCopyListOpen(true)}
      />
      <div className={styles.tags}>
        <TagChipRow deckId={deck.id} tags={tags} />
      </div>
      <DeckStatusStrip
        deckId={deck.id}
        summary={summary}
        fabraryUlid={deck.fabraryUlid}
        offFormat={deck.legality.category === 'illegal' ? deck.format : null}
      />
      <HeroOutsideFormatPanel
        deckId={deck.id}
        format={deck.format}
        legality={deck.legality}
        otherFormats={otherFormats}
      />
      {!hasHeroOutsideFormat(deck.legality.details) && <DeckCauseLine legality={deck.legality} />}
      <RecommendationsRail deckId={deck.id} deckCards={deckCards} heroName={deck.hero} />
      <DeckAnalysisRow items={items} />
      {summary.kind !== 'complete' && (
        <DeckActionPanels
          deckId={deck.id}
          openMissing={summary.openMissing}
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
          replacements={deck.replacements}
          onOpenAlternatives={setAlternativesTarget}
          onShareMissing={() => setShare({ open: true, intent: 'missing' })}
        />
      )}
      <DeckList
        items={items}
        onEditCards={onEditCards}
        deckId={deck.id}
        replacements={deck.replacements}
        listCards={listCards}
        legalityDetails={deck.legality.details}
      />
      <CopyListSheet
        open={copyListOpen}
        onOpenChange={setCopyListOpen}
        deckName={deck.name}
        format={deck.format}
        cards={listCards}
        legality={deck.legality}
      />
      <ShareDialog
        deckId={deck.id}
        deckName={deck.name}
        missingCount={summary.missingCards}
        open={share.open}
        initialIntent={share.intent}
        onOpenChange={(open) => setShare((current) => ({ ...current, open }))}
      />
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
