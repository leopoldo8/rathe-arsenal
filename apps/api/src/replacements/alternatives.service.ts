import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  catalog,
  findAlternatives,
  ICatalogCard,
  IAlternativeGroup,
  IAlternativeRationale,
  TAlternativeGroup,
  TSupportedFormat,
} from '@rathe-arsenal/engine';
import { CollectionReadService } from '../collection/collection-read.service';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { ShoppingLineService } from '../stores/shopping-line.service';
import { SubstitutionService } from '../substitution/substitution.service';
import { SwapSuggestionQueryService } from '../swaps/swap-suggestion-query.service';
import { computeNeeded } from './compute-needed';
import { replacementConflict } from './replacement-errors';
import { ReplacementsQueryService } from './replacements-query.service';

/** Slots whose cards never get stand-ins, so they get no alternatives either. */
export const NON_REPLACEABLE_SLOTS: ReadonlySet<string> = new Set(['hero', 'weapon']);

export interface IAlternativeCardResponse {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly imageUrl: ICatalogCard['imageUrl'];
  readonly freeCopies: number;
  readonly priceCents: number | null;
  readonly productUrl: string | null;
  readonly rationale: IAlternativeRationale;
}

export interface IAlternativesResponse {
  readonly needed: number;
  readonly groups: readonly {
    readonly group: TAlternativeGroup;
    readonly cards: readonly IAlternativeCardResponse[];
  }[];
}

export interface IAlternativesRequest {
  readonly userId: string;
  readonly deckId: number;
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly query?: string | undefined;
}

@Injectable()
export class AlternativesService {
  private readonly logger = new Logger(AlternativesService.name);

  constructor(
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDecks: Repository<TrackedDeckEntity>,
    @InjectRepository(DeckCardEntity)
    private readonly deckCards: Repository<DeckCardEntity>,
    private readonly substitutionService: SubstitutionService,
    private readonly swapSuggestionQueryService: SwapSuggestionQueryService,
    private readonly replacementsQueryService: ReplacementsQueryService,
    private readonly collectionReadService: CollectionReadService,
    private readonly shoppingLineService: ShoppingLineService,
  ) {}

  async list({ userId, deckId, cardIdentifier, slot, query }: IAlternativesRequest): Promise<IAlternativesResponse> {
    const deck = await this.trackedDecks.findOne({ where: { id: deckId, userId } });
    const [deckCardRows, activeReplacements, readinessInputs] = await Promise.all([
      this.deckCards.find({ where: { trackedDeckId: deckId } }),
      this.replacementsQueryService.loadActive(deckId),
      this.swapSuggestionQueryService.loadReadinessInputs(deckId),
    ]);

    // A fresh compute, not the stored snapshot: the collection may have changed since it was written.
    const readiness = await this.substitutionService.computeReadinessWithExclusions(
      deckId,
      userId,
      readinessInputs.excludedIdentifiers,
      readinessInputs.approvedIdentifiers,
    );
    const needed = computeNeeded(readiness.breakdown.notOwned, activeReplacements, cardIdentifier, slot);
    const missing = this.findCard(cardIdentifier);
    if (needed === 0 || missing === null || deck === null) throw replacementConflict('NOTHING_TO_REPLACE');

    const groups = NON_REPLACEABLE_SLOTS.has(slot)
      ? []
      : await this.searchGroups(missing, needed, deck, deckCardRows, userId, query);

    this.logger.log({
      event: 'alternatives.listed',
      userId,
      trackedDeckId: deckId,
      cardIdentifier,
      slot,
      needed,
      groupCounts: Object.fromEntries(groups.map((group) => [group.group, group.cards.length])),
      hasQuery: query !== undefined,
    });

    return { needed, groups };
  }

  private findCard(cardIdentifier: string): ICatalogCard | null {
    try {
      return catalog.getCard(cardIdentifier);
    } catch {
      return null;
    }
  }

  private async searchGroups(
    missing: ICatalogCard,
    needed: number,
    deck: TrackedDeckEntity,
    deckCardRows: readonly DeckCardEntity[],
    userId: string,
    query: string | undefined,
  ): Promise<IAlternativesResponse['groups']> {
    const heroCard = deck.heroIdentifier ? this.findCard(deck.heroIdentifier) : null;
    if (heroCard === null) return [];

    const deckCopies = new Map<string, number>();
    for (const row of deckCardRows) {
      deckCopies.set(row.cardIdentifier, (deckCopies.get(row.cardIdentifier) ?? 0) + row.quantity);
    }

    const found: readonly IAlternativeGroup[] = findAlternatives(
      {
        missing,
        needed,
        heroCard,
        format: deck.format as TSupportedFormat,
        deckCopies,
        owned: await this.collectionReadService.loadOwned(userId),
        query,
      },
      catalog,
    );

    const listed = found.flatMap((group) => group.cards.map((entry) => entry.card.cardIdentifier));
    const prices = await this.shoppingLineService.priceCards(listed, needed);

    return found.map((group) => ({
      group: group.group,
      cards: group.cards.map(({ card, freeCopies, rationale }) => ({
        cardIdentifier: card.cardIdentifier,
        name: card.name,
        pitch: card.pitch,
        imageUrl: card.imageUrl,
        freeCopies,
        priceCents: prices.get(card.cardIdentifier)?.priceCents ?? null,
        productUrl: prices.get(card.cardIdentifier)?.productUrl ?? null,
        rationale,
      })),
    }));
  }
}
