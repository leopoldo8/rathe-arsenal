import React, { useMemo, useState } from 'react';
import type { IDeckDetailResponse, IDeckDetailSnapshot } from '../../api/deck-detail';
import type { ITagResponse } from '../../api/tags';
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
import { summariseDeck } from './deckDetailModel';
import { MissingSummaryCard } from './MissingSummaryCard';
import { buildDeckList } from './deckListModel';
import { buildListCards } from './deckListCards';
import { CopyListSheet } from './CopyListSheet';
import { HeroOutsideFormatPanel } from './HeroOutsideFormatPanel';
import { RuleChangedNotice } from './RuleChangedNotice';
import { findRuleChangedProblem } from './ruleChangedModel';
import { RULE_CHANGES } from '@rathe-arsenal/engine/legality';
import { buildDraftInitialPayload } from '../../routes/_auth/-deck-detail-draft';
import { hasHeroOutsideFormat } from './heroOutsideFormatModel';
import { useOtherFormatVerdicts } from './useOtherFormatVerdicts';
import styles from './DeckDetailView.module.css';

interface IDeckDetailViewProps {
  readonly deck: IDeckDetailResponse;
  readonly snapshot: IDeckDetailSnapshot;
  readonly tags: readonly ITagResponse[];
  readonly onEdit: () => void;
  readonly onEditCards: () => void;
}

export function DeckDetailView({
  deck,
  snapshot,
  tags,
  onEdit,
  onEditCards,
}: IDeckDetailViewProps): React.ReactElement {
  const [copyListOpen, setCopyListOpen] = useState(false);
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
  const items = useMemo(
    () => buildDeckList(snapshot.breakdown, summary.openMissing),
    [snapshot.breakdown, summary.openMissing],
  );
  const listCards = useMemo(
    () => buildListCards(snapshot.breakdown, summary.openMissing, deck.hero),
    [snapshot.breakdown, summary.openMissing, deck.hero],
  );
  const otherFormats = useOtherFormatVerdicts(deck, snapshot);
  const savedCards = useMemo(() => buildDraftInitialPayload(deck, snapshot).cards, [deck, snapshot]);
  const showsRuleChange = findRuleChangedProblem(deck.format, deck.legality.details, savedCards, RULE_CHANGES) !== null;
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
      <RuleChangedNotice
        deckId={deck.id}
        format={deck.format}
        heroIdentifier={deck.heroIdentifier}
        legality={deck.legality}
        cards={savedCards}
      />
      {!hasHeroOutsideFormat(deck.legality.details) && !showsRuleChange && <DeckCauseLine legality={deck.legality} />}
      <RecommendationsRail deckId={deck.id} deckCards={deckCards} heroName={deck.hero} legality={deck.legality} format={deck.format} />
      <DeckAnalysisRow items={items} />
      {summary.kind !== 'complete' && <MissingSummaryCard deckId={deck.id} />}
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
    </div>
  );
}
