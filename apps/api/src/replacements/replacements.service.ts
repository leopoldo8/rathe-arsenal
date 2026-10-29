import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import {
  catalog,
  findCardLegalityViolation,
  getCopyLimit,
  ICatalogCard,
  TSupportedFormat,
} from '@rathe-arsenal/engine';
import { CollectionReadService } from '../collection/collection-read.service';
import { CardReplacementEntity, TReplacementSide } from '../database/entities/card-replacement.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { SubstitutionService } from '../substitution/substitution.service';
import { NON_REPLACEABLE_SLOTS } from './alternatives.service';
import { computeNeededOnSide } from './compute-needed';
import { PickReplacementDto } from './dtos/pick-replacement.dto';
import { replacementConflict } from './replacement-errors';
import { ReplacementsQueryService } from './replacements-query.service';
import { RecommendationQueueService } from '../recommendations/recommendation-queue.service';
import { RecommendationEntity } from '../database/entities/recommendation.entity';
import { RecommendationRunEntity } from '../database/entities/recommendation-run.entity';
import { decideAdoption } from './adoption-rules';
import { planSuggestedUses } from './plan-suggested-uses';

export interface IAdoptRequest {
  readonly cutCardIdentifier: string;
  readonly cutSlot: string;
}

export interface IReplacementResponse {
  readonly id: string;
  readonly slot: string;
  readonly originalCardIdentifier: string;
  readonly replacementCardIdentifier: string;
  readonly quantity: number;
  readonly side: TReplacementSide;
  readonly pickedFrom: CardReplacementEntity['pickedFrom'];
  readonly status: CardReplacementEntity['status'];
  readonly createdAt: string;
  readonly resolvedAt: string | null;
}

export interface ISuggestedUsesResponse {
  readonly replacements: readonly IReplacementResponse[];
  readonly skipped: number;
}

export type TResolveAction = 'revert' | 'keep';

function toResponse(entity: CardReplacementEntity): IReplacementResponse {
  return {
    id: entity.id,
    slot: entity.slot,
    originalCardIdentifier: entity.originalCardIdentifier,
    replacementCardIdentifier: entity.replacementCardIdentifier,
    quantity: entity.quantity,
    side: entity.side,
    pickedFrom: entity.pickedFrom,
    status: entity.status,
    createdAt: entity.createdAt.toISOString(),
    resolvedAt: entity.resolvedAt ? entity.resolvedAt.toISOString() : null,
  };
}

/**
 * Picks, reverts and keeps. Each takes the `tracked_deck` `FOR NO KEY UPDATE`
 * lock first, then decides from rows it
 * reads after the lock: a second request for the same copies waits, then finds
 * them gone.
 */
@Injectable()
export class ReplacementsService {
  private readonly logger = new Logger(ReplacementsService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly substitutionService: SubstitutionService,
    private readonly replacementsQueryService: ReplacementsQueryService,
    private readonly collectionReadService: CollectionReadService,
    private readonly recommendationQueue: RecommendationQueueService,
  ) {}

  async pick(userId: string, deckId: number, dto: PickReplacementDto): Promise<IReplacementResponse> {
    const original = this.requireCard(dto.originalCardIdentifier);
    const replacement = this.requireCard(dto.replacementCardIdentifier);

    const outcome = await this.dataSource.transaction(async (manager) => {
      const deck = await this.lockDeck(manager, deckId, userId);

      if (
        NON_REPLACEABLE_SLOTS.has(dto.slot) ||
        replacement.cardIdentifier === original.cardIdentifier
      ) {
        throw replacementConflict('REPLACEMENT_ILLEGAL');
      }

      const deckCards = await manager.find(DeckCardEntity, { where: { trackedDeckId: deckId }, order: { id: 'ASC' } });
      const activeReplacements = await this.replacementsQueryService.loadActive(deckId, manager);
      const readiness = await this.substitutionService.computeReadiness(deckId, userId, manager);
      const side: TReplacementSide = dto.side ?? 'deck';
      const stillNeeded = computeNeededOnSide(readiness.breakdown.notOwned, activeReplacements, original.cardIdentifier, dto.slot, side);
      if (stillNeeded === 0) throw replacementConflict('NOTHING_TO_REPLACE');
      if (dto.quantity !== undefined && dto.quantity > stillNeeded) throw replacementConflict('REPLACEMENT_ILLEGAL');
      const needed = dto.quantity ?? stillNeeded;

      const copiesHeld = deckCards
        .filter((row) => row.cardIdentifier === replacement.cardIdentifier)
        .reduce((sum, row) => sum + row.quantity + (row.inventoryQuantity ?? 0), 0);
      this.assertLegal(deck, replacement, copiesHeld + needed);

      await this.moveCopies(manager, deckCards, {
        trackedDeckId: deckId,
        slot: dto.slot,
        from: original.cardIdentifier,
        to: replacement.cardIdentifier,
        quantity: needed,
        side,
      });

      const saved = await manager.save(
        manager.create(CardReplacementEntity, {
          userId,
          trackedDeckId: deckId,
          slot: dto.slot,
          originalCardIdentifier: original.cardIdentifier,
          replacementCardIdentifier: replacement.cardIdentifier,
          quantity: needed,
          side,
          pickedFrom: dto.pickedFrom,
          status: 'active',
          resolvedAt: null,
        }),
      );

      await this.recompute(manager, userId, deckId);
      await this.recommendationQueue.enqueueAuto(manager, deckId);
      return { saved, copiesHeld, needed };
    });

    const owned = await this.collectionReadService.loadOwned(userId, [replacement.cardIdentifier]);
    this.logger.log({
      event: 'replacements.picked',
      userId,
      trackedDeckId: deckId,
      originalCardIdentifier: outcome.saved.originalCardIdentifier,
      replacementCardIdentifier: outcome.saved.replacementCardIdentifier,
      slot: outcome.saved.slot,
      quantity: outcome.saved.quantity,
      pickedFrom: outcome.saved.pickedFrom,
      owned: (owned.get(replacement.cardIdentifier) ?? 0) - outcome.copiesHeld >= outcome.needed,
    });
    return toResponse(outcome.saved);
  }

  /** Uses every current suggestion of the deck at once: one pick each, under one lock, with one recompute. */
  async useSuggestions(userId: string, deckId: number): Promise<ISuggestedUsesResponse> {
    const outcome = await this.dataSource.transaction(async (manager) => {
      const deck = await this.lockDeck(manager, deckId, userId);
      const deckCards = await manager.find(DeckCardEntity, { where: { trackedDeckId: deckId }, order: { id: 'ASC' } });
      const activeReplacements = await this.replacementsQueryService.loadActive(deckId, manager);
      const readiness = await this.substitutionService.computeReadiness(deckId, userId, manager);
      const plan = planSuggestedUses({
        notOwned: readiness.breakdown.notOwned,
        substituted: readiness.breakdown.substituted,
        activeReplacements,
        deckCards,
        owned: await this.collectionReadService.loadOwned(userId),
        heroCard: this.findHero(deck),
        format: deck.format as TSupportedFormat,
      });
      if (plan.uses.length === 0) throw replacementConflict('NOTHING_TO_REPLACE');

      const saved: CardReplacementEntity[] = [];
      for (const use of plan.uses) {
        const current = await manager.find(DeckCardEntity, { where: { trackedDeckId: deckId }, order: { id: 'ASC' } });
        await this.moveCopies(manager, current, {
          trackedDeckId: deckId,
          slot: use.slot,
          from: use.original,
          to: use.replacement,
          quantity: use.quantity,
        });
        saved.push(
          await manager.save(
            manager.create(CardReplacementEntity, {
              userId,
              trackedDeckId: deckId,
              slot: use.slot,
              originalCardIdentifier: use.original,
              replacementCardIdentifier: use.replacement,
              quantity: use.quantity,
              pickedFrom: 'suggested',
              status: 'active',
              resolvedAt: null,
            }),
          ),
        );
      }

      await this.recompute(manager, userId, deckId);
      await this.recommendationQueue.enqueueAuto(manager, deckId);
      return { saved, skipped: plan.skipped };
    });

    this.logger.log({
      event: 'replacements.used_suggestions',
      userId,
      trackedDeckId: deckId,
      used: outcome.saved.length,
      skipped: outcome.skipped,
    });
    return { replacements: outcome.saved.map(toResponse), skipped: outcome.skipped };
  }

  /** Swaps up to every copy of the cut card in its slot for the recommended card, capped by the copy limit. */
  async adopt(userId: string, deckId: number, recommendationId: string, dto: IAdoptRequest): Promise<IReplacementResponse> {
    const cut = this.requireCard(dto.cutCardIdentifier);

    const outcome = await this.dataSource.transaction(async (manager) => {
      const deck = await this.lockDeck(manager, deckId, userId);
      const recommendation = await manager
        .createQueryBuilder(RecommendationEntity, 'recommendation')
        .innerJoin(RecommendationRunEntity, 'run', 'run.id = recommendation.runId')
        .where('recommendation.id = :recommendationId', { recommendationId })
        .andWhere('run.trackedDeckId = :deckId', { deckId })
        .getOne();
      if (!recommendation) throw new NotFoundException('Recommendation not found');
      const recommended = this.requireCard(recommendation.cardIdentifier);
      const deckCards = await manager.find(DeckCardEntity, { where: { trackedDeckId: deckId }, order: { id: 'ASC' } });
      const decision = decideAdoption({
        recommended,
        cut,
        cutSlot: dto.cutSlot,
        heroCard: this.findHero(deck),
        format: deck.format as TSupportedFormat,
        deckCards,
      });
      if (decision.kind === 'refuse') throw replacementConflict(decision.code);
      const { quantity } = decision;

      await this.moveCopies(manager, deckCards, {
        trackedDeckId: deckId,
        slot: dto.cutSlot,
        from: cut.cardIdentifier,
        to: recommended.cardIdentifier,
        quantity,
      });

      const saved = await manager.save(
        manager.create(CardReplacementEntity, {
          userId,
          trackedDeckId: deckId,
          slot: dto.cutSlot,
          originalCardIdentifier: cut.cardIdentifier,
          replacementCardIdentifier: recommended.cardIdentifier,
          quantity,
          pickedFrom: 'recommendation',
          status: 'active',
          resolvedAt: null,
        }),
      );

      await this.recompute(manager, userId, deckId);
      await this.recommendationQueue.enqueueAuto(manager, deckId);
      return { saved, recommendation };
    });

    this.logger.log({
      event: 'recommendations.adopted',
      userId,
      trackedDeckId: deckId,
      recommendationId,
      rank: outcome.recommendation.rank,
      strength: outcome.recommendation.strength,
      cutCardIdentifier: outcome.saved.originalCardIdentifier,
      recommendedCardIdentifier: outcome.saved.replacementCardIdentifier,
      quantity: outcome.saved.quantity,
      suggestedCut: outcome.recommendation.cutCardIdentifier === outcome.saved.originalCardIdentifier,
    });
    return toResponse(outcome.saved);
  }

  /**
   * Applies an accepted chat swap inside the caller's transaction, as adopt does; a deck gone or one that
   * `decideAdoption` now refuses comes back as stale, with nothing written.
   */
  async applyChatSwap(
    manager: EntityManager,
    userId: string,
    swap: {
      readonly trackedDeckId: number;
      readonly originalCardIdentifier: string;
      readonly slot: string;
      readonly replacementCardIdentifier: string;
      /** Absent in a proposal stored before the swap carried them: every copy the limit allows, from the deck. */
      readonly quantity?: number | undefined;
      readonly side?: TReplacementSide | undefined;
    },
  ): Promise<{ readonly kind: 'applied'; readonly replacementId: string } | { readonly kind: 'stale'; readonly reason: string }> {
    const deck = await manager.findOne(TrackedDeckEntity, {
      where: { id: swap.trackedDeckId, userId, deletedAt: IsNull() },
      lock: { mode: 'for_no_key_update' },
    });
    if (!deck) return { kind: 'stale', reason: 'DECK_GONE' };
    const original = this.findCard(swap.originalCardIdentifier);
    const replacement = this.findCard(swap.replacementCardIdentifier);
    if (!original || !replacement) return { kind: 'stale', reason: 'CARD_UNKNOWN' };
    const deckCards = await manager.find(DeckCardEntity, { where: { trackedDeckId: deck.id }, order: { id: 'ASC' } });
    const decision = decideAdoption({
      recommended: replacement,
      cut: original,
      cutSlot: swap.slot,
      heroCard: this.findHero(deck),
      format: deck.format as TSupportedFormat,
      deckCards,
      quantity: swap.quantity,
      side: swap.side,
    });
    if (decision.kind === 'refuse') return { kind: 'stale', reason: decision.code };
    const side = swap.side ?? 'deck';

    await this.moveCopies(manager, deckCards, {
      trackedDeckId: deck.id,
      slot: swap.slot,
      from: original.cardIdentifier,
      to: replacement.cardIdentifier,
      quantity: decision.quantity,
      side,
    });
    const saved = await manager.save(
      manager.create(CardReplacementEntity, {
        userId,
        trackedDeckId: deck.id,
        slot: swap.slot,
        originalCardIdentifier: original.cardIdentifier,
        replacementCardIdentifier: replacement.cardIdentifier,
        quantity: decision.quantity,
        side,
        pickedFrom: 'chat',
        status: 'active',
        resolvedAt: null,
      }),
    );
    await this.recompute(manager, userId, deck.id);
    await this.recommendationQueue.enqueueAuto(manager, deck.id);
    return { kind: 'applied', replacementId: saved.id };
  }

  async resolve(userId: string, replacementId: string, action: TResolveAction): Promise<IReplacementResponse> {
    const resolved = await this.dataSource.transaction(async (manager) => {
      const located = await manager.findOne(CardReplacementEntity, { where: { id: replacementId, userId } });
      if (!located) throw new NotFoundException('Replacement not found');

      await this.lockDeck(manager, located.trackedDeckId, userId);
      const record = await manager.findOne(CardReplacementEntity, { where: { id: replacementId, userId } });
      if (!record) throw new NotFoundException('Replacement not found');
      if (record.status !== 'active') throw replacementConflict('REPLACEMENT_NOT_ACTIVE');

      if (action === 'revert') {
        const deckCards = await manager.find(DeckCardEntity, { where: { trackedDeckId: record.trackedDeckId }, order: { id: 'ASC' } });
        await this.moveCopies(manager, deckCards, {
          trackedDeckId: record.trackedDeckId,
          slot: record.slot,
          from: record.replacementCardIdentifier,
          to: record.originalCardIdentifier,
          quantity: record.quantity,
          side: record.side,
        });
        await this.recommendationQueue.enqueueAuto(manager, record.trackedDeckId);
      }

      await manager.update(
        CardReplacementEntity,
        { id: record.id },
        { status: action === 'revert' ? 'reverted' : 'kept', resolvedAt: new Date() },
      );
      await this.recompute(manager, userId, record.trackedDeckId);

      const closed = await manager.findOne(CardReplacementEntity, { where: { id: record.id } });
      if (!closed) throw new NotFoundException('Replacement not found');
      return closed;
    });

    this.logger.log({
      event: 'replacements.resolved',
      userId,
      trackedDeckId: resolved.trackedDeckId,
      replacementId,
      status: resolved.status,
    });
    return toResponse(resolved);
  }

  private requireCard(cardIdentifier: string): ICatalogCard {
    try {
      return catalog.getCard(cardIdentifier);
    } catch {
      throw new BadRequestException(`Unknown card "${cardIdentifier}"`);
    }
  }

  private async lockDeck(manager: EntityManager, deckId: number, userId: string): Promise<TrackedDeckEntity> {
    const deck = await manager.findOne(TrackedDeckEntity, {
      where: { id: deckId, userId, deletedAt: IsNull() },
      lock: { mode: 'for_no_key_update' },
    });
    if (!deck) throw new NotFoundException('Tracked deck not found');
    return deck;
  }

  private assertLegal(deck: TrackedDeckEntity, replacement: ICatalogCard, copiesAfterPick: number): void {
    const heroCard = this.findHero(deck);
    const format = deck.format as TSupportedFormat;
    if (
      heroCard === null ||
      findCardLegalityViolation(replacement, heroCard, format) !== null ||
      copiesAfterPick > getCopyLimit(replacement, format)
    ) {
      throw replacementConflict('REPLACEMENT_ILLEGAL');
    }
  }

  private findCard(cardIdentifier: string): ICatalogCard | null {
    try {
      return catalog.getCard(cardIdentifier);
    } catch {
      return null;
    }
  }

  private findHero(deck: TrackedDeckEntity): ICatalogCard | null {
    try {
      return deck.heroIdentifier ? catalog.getCard(deck.heroIdentifier) : null;
    } catch {
      return null;
    }
  }

  /**
   * Takes `quantity` copies off one card's row in a slot (row deleted when nothing is left on either side) and adds
   * them to another's (row created when absent), on the `side` named: the deck's copies or the inventory's.
   */
  private async moveCopies(
    manager: EntityManager,
    deckCards: readonly DeckCardEntity[],
    move: { trackedDeckId: number; slot: string; from: string; to: string; quantity: number; side?: TReplacementSide },
  ): Promise<void> {
    const side = move.side ?? 'deck';
    const column = side === 'deck' ? 'quantity' : 'inventoryQuantity';
    const other = side === 'deck' ? 'inventoryQuantity' : 'quantity';
    // A deck may list one card twice in a slot (nothing forbids it), and the missing copies span every
    // such row, so the copies come off each in turn until `quantity` is taken.
    let toTake = move.quantity;
    for (const row of deckCards.filter((r) => r.cardIdentifier === move.from && r.slot === move.slot)) {
      if (toTake <= 0) break;
      const taken = Math.min(row[column], toTake);
      toTake -= taken;
      // A row that still carries copies on the other side stays, with none left on this one.
      if (row[column] - taken > 0 || row[other] > 0) {
        await manager.update(DeckCardEntity, { id: row.id }, { [column]: row[column] - taken });
      } else {
        await manager.delete(DeckCardEntity, { id: row.id });
      }
    }

    const target = deckCards.find((row) => row.cardIdentifier === move.to && row.slot === move.slot);
    if (target) {
      await manager.update(DeckCardEntity, { id: target.id }, { [column]: target[column] + move.quantity });
    } else {
      await manager.insert(DeckCardEntity, {
        trackedDeckId: move.trackedDeckId,
        cardIdentifier: move.to,
        slot: move.slot,
        ...(side === 'deck' ? { quantity: move.quantity } : { quantity: 0, inventoryQuantity: move.quantity }),
      });
    }
  }

  private async recompute(manager: EntityManager, userId: string, trackedDeckId: number): Promise<void> {
    await this.substitutionService.computeAndStoreReadiness(trackedDeckId, userId, manager);
  }
}
