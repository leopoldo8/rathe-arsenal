import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardNotFoundError } from '@rathe-arsenal/engine';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { AuthzService } from '../auth/authz.service';
import { CatalogService } from '../catalog/catalog.service';
import { SubstitutionService } from '../substitution/substitution.service';
import {
  IBreakdown,
  IBreakdownEntry,
  ISubstitutionEntry,
  ITrackedDeckDetailSnapshot,
} from '../decks/dtos/tracked-deck-detail.response.dto';
import {
  IAddCardRecomputedDeck,
  IAddCardResponse,
} from './dtos/add-card.dto';
import { IMarkOwnedResponse } from './dtos/mark-owned.response.dto';

const MAX_COLLECTION_QUANTITY = 20;

@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  constructor(
    @InjectRepository(CollectionCardEntity)
    private readonly collectionCardRepo: Repository<CollectionCardEntity>,
    @InjectRepository(DeckCardEntity)
    private readonly deckCardRepo: Repository<DeckCardEntity>,
    @InjectRepository(DeckReadinessSnapshotEntity)
    private readonly snapshotRepo: Repository<DeckReadinessSnapshotEntity>,
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
    private readonly authzService: AuthzService,
    private readonly catalogService: CatalogService,
    private readonly substitutionService: SubstitutionService,
  ) {}

  async markOwned(
    userId: string,
    deckId: number,
    cardIdentifier: string,
  ): Promise<IMarkOwnedResponse> {
    await this.authzService.assertOwnsTrackedDeck(userId, deckId);

    // Load latest snapshot to validate the card is in the missing list
    const latestSnapshot = await this.snapshotRepo.findOne({
      where: { trackedDeckId: deckId },
      order: { computedAt: 'DESC' },
    });

    if (!latestSnapshot) {
      throw new BadRequestException(
        'No readiness snapshot exists for this deck',
      );
    }

    const breakdown = latestSnapshot.breakdown as unknown as IBreakdown;
    const missingEntries: readonly IBreakdownEntry[] = breakdown.missing ?? [];

    const missingEntry = missingEntries.find(
      (entry) => entry.cardIdentifier === cardIdentifier,
    );

    if (!missingEntry) {
      throw new BadRequestException(
        `Card "${cardIdentifier}" is not in the missing list for this deck`,
      );
    }

    // Determine the deck's required quantity for this card
    const deckCards = await this.deckCardRepo.find({
      where: { trackedDeckId: deckId },
    });

    const deckCard = deckCards.find(
      (dc) => dc.cardIdentifier === cardIdentifier,
    );

    const requiredQuantity = deckCard?.quantity ?? missingEntry.quantity;

    // Upsert CollectionCard: insert with qty 1 if new, else increment (capped)
    const existing = await this.collectionCardRepo.findOne({
      where: { userId, cardIdentifier },
    });

    let newQuantity: number;

    if (existing) {
      newQuantity = Math.min(existing.quantity + 1, requiredQuantity);
      await this.collectionCardRepo.update(existing.id, {
        quantity: newQuantity,
      });
    } else {
      newQuantity = 1;
      const entity = this.collectionCardRepo.create({
        userId,
        cardIdentifier,
        quantity: 1,
      });
      await this.collectionCardRepo.save(entity);
    }

    // Recompute readiness
    const newSnapshotEntity =
      await this.substitutionService.computeAndStoreReadiness(deckId, userId);

    // Derive path + fidelityPercent for the response. deckCards is already
    // loaded above, so totalCards is cheap to compute locally.
    const totalCards = deckCards.reduce((sum, c) => sum + c.quantity, 0);
    const derived = this.substitutionService.deriveSnapshotFields(
      newSnapshotEntity,
      totalCards,
    );

    const snapshot: ITrackedDeckDetailSnapshot = {
      id: newSnapshotEntity.id,
      rawPercent: newSnapshotEntity.rawPercent,
      effectivePercent: newSnapshotEntity.effectivePercent,
      path: derived.path,
      fidelityPercent: derived.fidelityPercent,
      breakdown:
        newSnapshotEntity.breakdown as unknown as IBreakdown,
      substitutions:
        newSnapshotEntity.substitutions as unknown as Record<
          string,
          ISubstitutionEntry
        >,
      computedAt: newSnapshotEntity.computedAt.toISOString(),
    };

    this.logger.log('Card marked as owned', {
      userId,
      deckId,
      cardIdentifier,
      newQuantity,
    });

    return {
      cardIdentifier,
      newQuantity,
      snapshot,
    };
  }

  /**
   * Manual add-card entry point for the autocomplete component. Upserts a
   * single card into the user's collection, then recomputes readiness for
   * every tracked deck that references that card. Cost is O(decks containing
   * the card) which is acceptable at Phase 1 scale (<20 decks per user).
   *
   * Recompute failures are logged but do not abort the add: the DB upsert is
   * already committed, and the next readiness request (or the next addCard
   * for the same deck) will retry the computation. This matches the
   * DecksImportService policy and keeps the user-facing action non-fragile.
   */
  async addCard(
    userId: string,
    cardIdentifier: string,
    quantity: number = 1,
  ): Promise<IAddCardResponse> {
    // Validate the card exists in the catalog before we touch the DB.
    try {
      this.catalogService.getCard(cardIdentifier);
    } catch (error) {
      if (error instanceof CardNotFoundError) {
        throw new BadRequestException({
          code: 'INVALID_CARD_IDENTIFIER',
          message: `Card "${cardIdentifier}" does not exist in the catalog`,
        });
      }
      throw error;
    }

    // Upsert the collection row. Quantities are capped at
    // MAX_COLLECTION_QUANTITY to keep user input bounded.
    const existing = await this.collectionCardRepo.findOne({
      where: { userId, cardIdentifier },
    });

    let newQuantity: number;

    if (existing) {
      newQuantity = Math.min(
        existing.quantity + quantity,
        MAX_COLLECTION_QUANTITY,
      );
      await this.collectionCardRepo.update(existing.id, {
        quantity: newQuantity,
      });
    } else {
      newQuantity = Math.min(quantity, MAX_COLLECTION_QUANTITY);
      const entity = this.collectionCardRepo.create({
        userId,
        cardIdentifier,
        quantity: newQuantity,
      });
      await this.collectionCardRepo.save(entity);
    }

    // Cross-deck recompute: find every tracked deck owned by this user that
    // references the added card, then recompute readiness for each.
    const affectedDeckIds = await this.findAffectedDeckIds(
      userId,
      cardIdentifier,
    );

    const recomputedDecks: IAddCardRecomputedDeck[] = [];
    for (const trackedDeckId of affectedDeckIds) {
      try {
        const snapshot =
          await this.substitutionService.computeAndStoreReadiness(
            trackedDeckId,
            userId,
          );
        recomputedDecks.push({
          trackedDeckId,
          rawPercent: snapshot.rawPercent,
          effectivePercent: snapshot.effectivePercent,
        });
      } catch (error) {
        // Non-fatal: the collection upsert already succeeded. Log and move on.
        // The next readiness request for this deck will re-compute.
        this.logger.warn({
          msg: 'Failed to recompute readiness after addCard',
          userId,
          trackedDeckId,
          cardIdentifier,
          error: (error as Error).message,
        });
      }
    }

    this.logger.log('Card added to collection', {
      userId,
      cardIdentifier,
      newQuantity,
      affectedDeckCount: affectedDeckIds.length,
    });

    return {
      cardIdentifier,
      newQuantity,
      recomputedDecks,
    };
  }

  private async findAffectedDeckIds(
    userId: string,
    cardIdentifier: string,
  ): Promise<readonly number[]> {
    // Join deck_card -> tracked_deck filtered by userId and cardIdentifier.
    // Use the query builder so the JOIN runs as a single SQL round-trip.
    const rows = await this.deckCardRepo
      .createQueryBuilder('dc')
      .innerJoin(
        TrackedDeckEntity,
        'td',
        'td.id = dc.trackedDeckId AND td.userId = :userId',
        { userId },
      )
      .where('dc.cardIdentifier = :cardIdentifier', { cardIdentifier })
      .select('DISTINCT dc.trackedDeckId', 'trackedDeckId')
      .getRawMany<{ trackedDeckId: number }>();

    return rows.map((row) => Number(row.trackedDeckId));
  }
}
