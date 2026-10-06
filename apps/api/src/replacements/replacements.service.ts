import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  catalog,
  findCardLegalityViolation,
  getCopyLimit,
  ICatalogCard,
  TSupportedFormat,
} from '@rathe-arsenal/engine';
import { CollectionReadService } from '../collection/collection-read.service';
import { CardReplacementEntity } from '../database/entities/card-replacement.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { SwapSuggestionEntity } from '../database/entities/swap-suggestion.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { SubstitutionService } from '../substitution/substitution.service';
import { SwapSuggestionQueryService } from '../swaps/swap-suggestion-query.service';
import { NON_REPLACEABLE_SLOTS } from './alternatives.service';
import { computeNeeded } from './compute-needed';
import { PickReplacementDto } from './dtos/pick-replacement.dto';
import { replacementConflict } from './replacement-errors';
import { ReplacementsQueryService } from './replacements-query.service';

export interface IReplacementResponse {
  readonly id: string;
  readonly slot: string;
  readonly originalCardIdentifier: string;
  readonly replacementCardIdentifier: string;
  readonly quantity: number;
  readonly pickedFrom: CardReplacementEntity['pickedFrom'];
  readonly status: CardReplacementEntity['status'];
  readonly createdAt: string;
  readonly resolvedAt: string | null;
}

export type TResolveAction = 'revert' | 'keep';

function toResponse(entity: CardReplacementEntity): IReplacementResponse {
  return {
    id: entity.id,
    slot: entity.slot,
    originalCardIdentifier: entity.originalCardIdentifier,
    replacementCardIdentifier: entity.replacementCardIdentifier,
    quantity: entity.quantity,
    pickedFrom: entity.pickedFrom,
    status: entity.status,
    createdAt: entity.createdAt.toISOString(),
    resolvedAt: entity.resolvedAt ? entity.resolvedAt.toISOString() : null,
  };
}

/**
 * Picks, reverts and keeps. Each takes the `tracked_deck` `FOR NO KEY UPDATE`
 * lock first, as `SwapsService.applyTransition` does, then decides from rows it
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
    private readonly swapSuggestionQueryService: SwapSuggestionQueryService,
    private readonly replacementsQueryService: ReplacementsQueryService,
    private readonly collectionReadService: CollectionReadService,
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

      const deckCards = await manager.find(DeckCardEntity, { where: { trackedDeckId: deckId } });
      const activeReplacements = await this.replacementsQueryService.loadActive(deckId, manager);
      const inputs = await this.swapSuggestionQueryService.loadReadinessInputs(deckId, manager);
      const readiness = await this.substitutionService.computeReadinessWithExclusions(
        deckId,
        userId,
        inputs.excludedIdentifiers,
        inputs.approvedIdentifiers,
        manager,
      );
      const needed = computeNeeded(readiness.breakdown.notOwned, activeReplacements, original.cardIdentifier, dto.slot);
      if (needed === 0) throw replacementConflict('NOTHING_TO_REPLACE');

      const copiesHeld = deckCards
        .filter((row) => row.cardIdentifier === replacement.cardIdentifier)
        .reduce((sum, row) => sum + row.quantity, 0);
      this.assertLegal(deck, replacement, copiesHeld + needed);

      await this.moveCopies(manager, deckCards, {
        trackedDeckId: deckId,
        slot: dto.slot,
        from: original.cardIdentifier,
        to: replacement.cardIdentifier,
        quantity: needed,
      });

      const saved = await manager.save(
        manager.create(CardReplacementEntity, {
          userId,
          trackedDeckId: deckId,
          slot: dto.slot,
          originalCardIdentifier: original.cardIdentifier,
          replacementCardIdentifier: replacement.cardIdentifier,
          quantity: needed,
          pickedFrom: dto.pickedFrom,
          status: 'active',
          resolvedAt: null,
        }),
      );

      // Reconciliation only retires a row whose position left the deck; a partly owned original stays in its slot.
      await manager.update(
        SwapSuggestionEntity,
        {
          trackedDeckId: deckId,
          cardIdentifier: original.cardIdentifier,
          slot: dto.slot,
          status: In(['pending', 'approved']),
        },
        { status: 'retired' },
      );

      await this.recompute(manager, userId, deckId);
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

  async resolve(userId: string, replacementId: string, action: TResolveAction): Promise<IReplacementResponse> {
    const resolved = await this.dataSource.transaction(async (manager) => {
      const located = await manager.findOne(CardReplacementEntity, { where: { id: replacementId, userId } });
      if (!located) throw new NotFoundException('Replacement not found');

      await this.lockDeck(manager, located.trackedDeckId, userId);
      const record = await manager.findOne(CardReplacementEntity, { where: { id: replacementId, userId } });
      if (!record) throw new NotFoundException('Replacement not found');
      if (record.status !== 'active') throw replacementConflict('REPLACEMENT_NOT_ACTIVE');

      if (action === 'revert') {
        const deckCards = await manager.find(DeckCardEntity, { where: { trackedDeckId: record.trackedDeckId } });
        await this.moveCopies(manager, deckCards, {
          trackedDeckId: record.trackedDeckId,
          slot: record.slot,
          from: record.replacementCardIdentifier,
          to: record.originalCardIdentifier,
          quantity: record.quantity,
        });
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
      where: { id: deckId, userId },
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

  private findHero(deck: TrackedDeckEntity): ICatalogCard | null {
    try {
      return deck.heroIdentifier ? catalog.getCard(deck.heroIdentifier) : null;
    } catch {
      return null;
    }
  }

  /** Takes `quantity` copies off one card's row in a slot (row deleted at 0) and adds them to another's (row created when absent). */
  private async moveCopies(
    manager: EntityManager,
    deckCards: readonly DeckCardEntity[],
    move: { trackedDeckId: number; slot: string; from: string; to: string; quantity: number },
  ): Promise<void> {
    // A deck may list one card twice in a slot (nothing forbids it), and the missing copies span every
    // such row, so the copies come off each in turn until `quantity` is taken.
    let toTake = move.quantity;
    for (const row of deckCards.filter((r) => r.cardIdentifier === move.from && r.slot === move.slot)) {
      if (toTake <= 0) break;
      const taken = Math.min(row.quantity, toTake);
      toTake -= taken;
      if (row.quantity - taken > 0) {
        await manager.update(DeckCardEntity, { id: row.id }, { quantity: row.quantity - taken });
      } else {
        await manager.delete(DeckCardEntity, { id: row.id });
      }
    }

    const target = deckCards.find((row) => row.cardIdentifier === move.to && row.slot === move.slot);
    if (target) {
      await manager.update(DeckCardEntity, { id: target.id }, { quantity: target.quantity + move.quantity });
    } else {
      await manager.insert(DeckCardEntity, {
        trackedDeckId: move.trackedDeckId,
        cardIdentifier: move.to,
        quantity: move.quantity,
        slot: move.slot,
      });
    }
  }

  private async recompute(manager: EntityManager, userId: string, trackedDeckId: number): Promise<void> {
    const { excludedIdentifiers, approvedIdentifiers } =
      await this.swapSuggestionQueryService.loadReadinessInputs(trackedDeckId, manager);
    await this.substitutionService.computeAndStoreReadiness(
      trackedDeckId,
      userId,
      excludedIdentifiers,
      approvedIdentifiers,
      manager,
    );
  }
}
