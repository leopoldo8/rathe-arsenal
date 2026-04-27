import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CardNotFoundError } from '@rathe-arsenal/engine';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { CsvSourceEntity } from '../database/entities/csv-source.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { AuthzService } from '../auth/authz.service';
import { CatalogService } from '../catalog/catalog.service';
import { SubstitutionService } from '../substitution/substitution.service';
import { DecisionsService } from '../decks/decisions/decisions.service';
import { SourcesService } from './sources/sources.service';
import {
  IBreakdown,
  ISubstitutionEntry,
  ITrackedDeckDetailSnapshot,
} from '../decks/dtos/tracked-deck-detail.response.dto';
import {
  IAddCardRecomputedDeck,
  IAddCardResponse,
} from './dtos/add-card.dto';
import { IDecrementCardResponse } from './dtos/decrement-card.dto';
import { IMarkOwnedResponse } from './dtos/mark-owned.response.dto';

const MAX_COLLECTION_QUANTITY = 20;

@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  constructor(
    @InjectRepository(CollectionCardEntity)
    private readonly collectionCardRepo: Repository<CollectionCardEntity>,
    @InjectRepository(CsvSourceEntity)
    private readonly csvSourceRepo: Repository<CsvSourceEntity>,
    @InjectRepository(DeckCardEntity)
    private readonly deckCardRepo: Repository<DeckCardEntity>,
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
    private readonly dataSource: DataSource,
    private readonly authzService: AuthzService,
    private readonly catalogService: CatalogService,
    private readonly substitutionService: SubstitutionService,
    private readonly decisionsService: DecisionsService,
    private readonly sourcesService: SourcesService,
  ) {}

  async markOwned(
    userId: string,
    deckId: number,
    cardIdentifier: string,
  ): Promise<IMarkOwnedResponse> {
    await this.authzService.assertOwnsTrackedDeck(userId, deckId);

    // Validate against the deck's card list — the source of truth for
    // which cards belong to the deck. This is more correct than checking
    // the breakdown because a card can move between missing/substituted
    // sections as readiness is recomputed.
    const deckCards = await this.deckCardRepo.find({
      where: { trackedDeckId: deckId },
    });

    const deckCard = deckCards.find(
      (dc) => dc.cardIdentifier === cardIdentifier,
    );

    if (!deckCard) {
      throw new BadRequestException(
        `Card "${cardIdentifier}" is not part of this deck`,
      );
    }

    const requiredQuantity = deckCard.quantity;

    // Ensure the user has a manual source before writing the card row.
    const manualSource = await this.sourcesService.ensureManualSource(userId);

    // Upsert CollectionCard: insert with qty 1 if new, else increment (capped).
    // Scoped to the manual source so CSV source rows are never overwritten.
    const existing = await this.collectionCardRepo.findOne({
      where: { userId, cardIdentifier, sourceId: manualSource.id },
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
        sourceId: manualSource.id,
        quantity: 1,
      });
      await this.collectionCardRepo.save(entity);
    }

    // Load rejected decisions so the recompute respects them.
    const excludedIdentifiers = await this.decisionsService.loadExclusions(deckId);

    // Recompute readiness
    const newSnapshotEntity =
      await this.substitutionService.computeAndStoreReadiness(
        deckId,
        userId,
        excludedIdentifiers,
      );

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

    // Ensure the user has a manual source before writing the card row.
    const manualSource = await this.sourcesService.ensureManualSource(userId);

    // Upsert the collection row. Quantities are capped at
    // MAX_COLLECTION_QUANTITY to keep user input bounded.
    // Scoped to the manual source so CSV source rows are never overwritten.
    const existing = await this.collectionCardRepo.findOne({
      where: { userId, cardIdentifier, sourceId: manualSource.id },
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
        sourceId: manualSource.id,
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
        // Load rejected decisions for this deck so recompute respects them.
        const deckExclusions = await this.decisionsService.loadExclusions(trackedDeckId);

        const snapshot =
          await this.substitutionService.computeAndStoreReadiness(
            trackedDeckId,
            userId,
            deckExclusions,
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

  /**
   * Subtracts `quantity` from the `collection_card` row owned by `(userId,
   * cardIdentifier, sourceId)`. Powers the hover stepper on /library: a
   * `−` click sends the source the user picked (or the only contributing
   * source when there's no ambiguity).
   *
   * Semantics:
   *  - 404 if the source doesn't belong to the user OR there's no row
   *    for this card on that source.
   *  - 400 if `quantity` exceeds the row's current quantity. Clamping
   *    silently would mask a stale UI; surfacing a 400 lets the client
   *    refetch and present the correct state.
   *  - When the row's quantity reaches 0 we delete the row inside the
   *    same transaction that updates `csv_source.cardCount` (decremented
   *    by 1) — the source itself stays so the user can later re-upload
   *    the original CSV file or toggle it active/inactive without losing
   *    the label.
   *  - Cross-deck readiness is recomputed best-effort, mirroring
   *    `addCard` — recompute failures do not abort the response.
   */
  async decrementCardFromSource(
    userId: string,
    cardIdentifier: string,
    sourceId: string,
    quantity: number = 1,
  ): Promise<IDecrementCardResponse> {
    if (quantity < 1) {
      throw new BadRequestException('Decrement quantity must be at least 1');
    }

    const result = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        // Verify the source belongs to the user. Querying by
        // `(id, userId)` makes the ownership check the same SQL round-trip
        // as the existence check.
        const source = await manager.findOne(CsvSourceEntity, {
          where: { id: sourceId, userId },
        });
        if (!source) {
          throw new NotFoundException('Source not found');
        }

        const row = await manager.findOne(CollectionCardEntity, {
          where: { userId, cardIdentifier, sourceId },
        });
        if (!row) {
          throw new NotFoundException(
            `No "${cardIdentifier}" row on this source`,
          );
        }

        if (quantity > row.quantity) {
          throw new BadRequestException(
            `Cannot decrement ${quantity} — only ${row.quantity} on this source`,
          );
        }

        const newQuantity = row.quantity - quantity;
        let removed = false;
        if (newQuantity === 0) {
          await manager.delete(CollectionCardEntity, { id: row.id });
          // Keep `csv_source.cardCount` in sync with the actual number
          // of `collection_card` rows owned by this source. Failing to
          // decrement here would leave the count drifting whenever a
          // user fully removes a card from a CSV/Fabrary import.
          if ((source.cardCount ?? 0) > 0) {
            await manager.update(
              CsvSourceEntity,
              { id: sourceId },
              { cardCount: (source.cardCount ?? 0) - 1 },
            );
          }
          removed = true;
        } else {
          await manager.update(
            CollectionCardEntity,
            { id: row.id },
            { quantity: newQuantity },
          );
        }

        return { newQuantity, removed };
      },
    );

    // Cross-deck recompute outside the transaction — keeps the user-
    // facing mutation transactional while the readiness write is best-
    // effort. Mirrors the `addCard` policy.
    const affectedDeckIds = await this.findAffectedDeckIds(
      userId,
      cardIdentifier,
    );
    const recomputedDecks: IAddCardRecomputedDeck[] = [];
    for (const trackedDeckId of affectedDeckIds) {
      try {
        const exclusions = await this.decisionsService.loadExclusions(trackedDeckId);
        const snapshot = await this.substitutionService.computeAndStoreReadiness(
          trackedDeckId,
          userId,
          exclusions,
        );
        recomputedDecks.push({
          trackedDeckId,
          rawPercent: snapshot.rawPercent,
          effectivePercent: snapshot.effectivePercent,
        });
      } catch (error) {
        this.logger.warn({
          msg: 'Failed to recompute readiness after decrementCardFromSource',
          userId,
          trackedDeckId,
          cardIdentifier,
          error: (error as Error).message,
        });
      }
    }

    this.logger.log({
      event: 'collection.cards.decrement',
      userId,
      cardIdentifier,
      sourceId,
      quantity,
      newQuantity: result.newQuantity,
      removed: result.removed,
    });

    return {
      cardIdentifier,
      sourceId,
      newQuantity: result.newQuantity,
      removed: result.removed,
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
