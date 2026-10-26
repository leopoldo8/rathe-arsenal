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
import {
  IAddCardsBatchResponse,
  IAddCardsBatchResult,
} from './dtos/add-cards-batch.dto';
import { IMarkOwnedResponse } from './dtos/mark-owned.response.dto';
import { ISetOwnedResponse } from './dtos/set-owned.dto';
import { ICopyVersion, NO_VERSION, TVersionParts, withDefaults } from './versions/copy-version';
import { assertVersionBelongsToCard } from './versions/collection-versions.service';

const MAX_COLLECTION_QUANTITY = 20;

interface IBatchItem {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly printingCode?: string | undefined;
  readonly edition?: ICopyVersion['edition'] | undefined;
  readonly finish?: ICopyVersion['finish'] | undefined;
}

/** One card at one version: the unit a batch sums and increments. */
interface IBatchEntry extends ICopyVersion {
  readonly cardIdentifier: string;
  readonly quantity: number;
}

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
      order: { id: 'ASC' },
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
      where: { userId, cardIdentifier, sourceId: manualSource.id, ...NO_VERSION },
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

    const snapshot = await this.recomputeSnapshot(userId, deckId, deckCards);

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

  /** Recomputes the deck's readiness and answers the snapshot the way the deck detail does. */
  private async recomputeSnapshot(
    userId: string,
    deckId: number,
    deckCards: readonly DeckCardEntity[],
  ): Promise<ITrackedDeckDetailSnapshot> {
    const newSnapshotEntity = await this.substitutionService.computeAndStoreReadiness(deckId, userId);
    const totalCards = deckCards.reduce((sum, c) => sum + c.quantity, 0);
    const derived = this.substitutionService.deriveSnapshotFields(newSnapshotEntity, totalCards);
    return {
      id: newSnapshotEntity.id,
      rawPercent: newSnapshotEntity.rawPercent,
      effectivePercent: newSnapshotEntity.effectivePercent,
      path: derived.path,
      fidelityPercent: derived.fidelityPercent,
      breakdown: newSnapshotEntity.breakdown as unknown as IBreakdown,
      substitutions: newSnapshotEntity.substitutions as unknown as Record<string, ISubstitutionEntry>,
      computedAt: newSnapshotEntity.computedAt.toISOString(),
    };
  }

  /**
   * Sets how many copies of a card the player owns in all, through the manual source: the manual quantity becomes
   * the total asked minus what the other active sources hold. One statement writes it and reads the value it replaced.
   */
  async setOwned(userId: string, deckId: number, cardIdentifier: string, ownedTotal: number): Promise<ISetOwnedResponse> {
    await this.authzService.assertOwnsTrackedDeck(userId, deckId);
    const deckCards = await this.deckCardRepo.find({ where: { trackedDeckId: deckId, cardIdentifier }, order: { id: 'ASC' } });
    if (deckCards.length === 0) throw new NotFoundException(`Card "${cardIdentifier}" is not part of this deck`);
    const deckQuantity = deckCards.reduce((sum, row) => sum + row.quantity + row.inventoryQuantity, 0);
    if (ownedTotal > deckQuantity) {
      throw new BadRequestException({ code: 'OWNED_TOTAL_TOO_HIGH', message: 'The total is above what the deck uses of this card' });
    }

    const manualSource = await this.sourcesService.ensureManualSource(userId);
    const [held] = await this.dataSource.query(
      `SELECT COALESCE(SUM(c.quantity) FILTER (WHERE c."sourceId" <> $3), 0)::int AS "otherQuantity"
       FROM collection_card c JOIN csv_source s ON s.id = c."sourceId"
       WHERE c."userId" = $1 AND c."cardIdentifier" = $2 AND s.active = true`,
      [userId, cardIdentifier, manualSource.id],
    );
    const otherQuantity = held.otherQuantity as number;
    if (ownedTotal < otherQuantity) {
      throw new BadRequestException({ code: 'OWNED_TOTAL_BELOW_OTHER_SOURCES', message: 'Other imports already hold more than this total' });
    }

    const manualQuantity = ownedTotal - otherQuantity;
    // One statement writes the manual quantity and returns the one it replaced (a data-changing CTE reads the
    // table as the statement found it). A total that leaves nothing for the manual source removes its row.
    const keyMatch = `"userId" = $1 AND "cardIdentifier" = $2 AND "sourceId" = $3
      AND "printingCode" = '' AND edition = '' AND finish = '' AND condition = ''`;
    const [written] = await this.dataSource.query(
      manualQuantity === 0
        ? `WITH previous AS (SELECT quantity FROM collection_card WHERE ${keyMatch}),
                removed AS (DELETE FROM collection_card WHERE ${keyMatch} RETURNING 1)
           SELECT COALESCE((SELECT quantity FROM previous), 0)::int AS "previousManualQuantity"`
        : `WITH previous AS (SELECT quantity FROM collection_card WHERE ${keyMatch}),
                written AS (
                  INSERT INTO collection_card ("userId", "cardIdentifier", "sourceId", quantity)
                  VALUES ($1, $2, $3, $4)
                  ON CONFLICT ("userId", "cardIdentifier", "sourceId", "printingCode", edition, finish, condition)
                  DO UPDATE SET quantity = EXCLUDED.quantity, "lastUpdated" = now()
                  RETURNING 1
                )
           SELECT COALESCE((SELECT quantity FROM previous), 0)::int AS "previousManualQuantity" FROM written`,
      manualQuantity === 0 ? [userId, cardIdentifier, manualSource.id] : [userId, cardIdentifier, manualSource.id, manualQuantity],
    );
    const previousManualQuantity = written.previousManualQuantity as number;

    const snapshot = await this.recomputeSnapshot(userId, deckId, await this.deckCardRepo.find({ where: { trackedDeckId: deckId }, order: { id: 'ASC' } }));
    this.logger.log('Owned total set', { userId, deckId, cardIdentifier, ownedTotal });
    return { ownedTotal, previousManualQuantity, snapshot };
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
      where: { userId, cardIdentifier, sourceId: manualSource.id, ...NO_VERSION },
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

    const recomputedDecks = await this.recomputeDecks(userId, affectedDeckIds, {
      msg: 'Failed to recompute readiness after addCard',
      cardIdentifier,
    });

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

  async addCardsBatch(
    userId: string,
    items: readonly IBatchItem[],
  ): Promise<IAddCardsBatchResponse> {
    const entries = sumByCardVersion(items);
    const cardIdentifiers = [...new Set(entries.map((entry) => entry.cardIdentifier))];
    this.assertCardsExist(cardIdentifiers);
    for (const entry of entries) assertVersionBelongsToCard(entry.cardIdentifier, entry);

    // Created before the transaction: its unique-violation recovery re-reads
    // the row, which an aborted Postgres transaction cannot do.
    const manualSource = await this.sourcesService.ensureManualSource(userId);
    const results = await this.dataSource.transaction((manager) =>
      this.incrementQuantities(manager, userId, manualSource.id, entries),
    );

    const affectedDeckIds = await this.findAffectedDeckIdsForCards(userId, cardIdentifiers);
    const recomputedDecks = await this.recomputeDecks(userId, affectedDeckIds, {
      msg: 'Failed to recompute readiness after addCardsBatch',
    });

    this.logger.log('Cards batch-added to collection', {
      userId,
      itemCount: entries.length,
      totalQuantity: entries.reduce((sum, entry) => sum + entry.quantity, 0),
      cappedCount: results.filter((result) => result.capped).length,
      affectedDeckCount: affectedDeckIds.length,
    });

    return { results, recomputedDeckCount: recomputedDecks.length };
  }

  private assertCardsExist(cardIdentifiers: readonly string[]): void {
    for (const cardIdentifier of cardIdentifiers) {
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
    }
  }

  private async incrementQuantities(
    manager: EntityManager,
    userId: string,
    sourceId: string,
    entries: readonly IBatchEntry[],
  ): Promise<IAddCardsBatchResult[]> {
    const cardIdentifiers = [...new Set(entries.map((entry) => entry.cardIdentifier))];
    const previousRows: ({ quantity: number } & ICopyVersion & { cardIdentifier: string })[] = await manager.query(
      `SELECT "cardIdentifier", "printingCode", edition, finish, condition, quantity FROM collection_card
       WHERE "userId" = $1 AND "sourceId" = $2 AND "cardIdentifier" = ANY($3)
       FOR UPDATE`,
      [userId, sourceId, cardIdentifiers],
    );
    const previous = new Map(previousRows.map((row) => [entryKey(row), row.quantity]));

    const updatedRows: ({ quantity: number } & ICopyVersion & { cardIdentifier: string })[] = await manager.query(
      `INSERT INTO collection_card ("userId", "cardIdentifier", "sourceId", "printingCode", edition, finish, condition, quantity)
       SELECT $1, input."cardIdentifier", $2, input."printingCode", input.edition, input.finish, input.condition, input.quantity
       FROM unnest($3::varchar[], $4::varchar[], $5::varchar[], $6::varchar[], $7::varchar[], $8::int[])
         AS input("cardIdentifier", "printingCode", edition, finish, condition, quantity)
       ON CONFLICT ("userId", "cardIdentifier", "sourceId", "printingCode", edition, finish, condition)
       DO UPDATE SET quantity = LEAST(collection_card.quantity + EXCLUDED.quantity, $9),
                     "lastUpdated" = now()
       RETURNING "cardIdentifier", "printingCode", edition, finish, condition, quantity`,
      [
        userId,
        sourceId,
        entries.map((entry) => entry.cardIdentifier),
        entries.map((entry) => entry.printingCode),
        entries.map((entry) => entry.edition),
        entries.map((entry) => entry.finish),
        entries.map((entry) => entry.condition),
        entries.map((entry) => entry.quantity),
        MAX_COLLECTION_QUANTITY,
      ],
    );
    const updated = new Map(updatedRows.map((row) => [entryKey(row), row.quantity]));

    return entries.map((entry) => ({
      cardIdentifier: entry.cardIdentifier,
      newQuantity: updated.get(entryKey(entry)) ?? 0,
      capped: (previous.get(entryKey(entry)) ?? 0) + entry.quantity > MAX_COLLECTION_QUANTITY,
    }));
  }

  /** Readiness of every deck that uses a card, after something outside the collection routes changed its copies. */
  async recomputeReadinessForCard(userId: string, cardIdentifier: string, failureMessage: string): Promise<void> {
    const affectedDeckIds = await this.findAffectedDeckIds(userId, cardIdentifier);
    await this.recomputeDecks(userId, affectedDeckIds, { msg: failureMessage, cardIdentifier });
  }

  private async recomputeDecks(
    userId: string,
    trackedDeckIds: readonly number[],
    failureLog: Readonly<Record<string, unknown>>,
  ): Promise<IAddCardRecomputedDeck[]> {
    const recomputedDecks: IAddCardRecomputedDeck[] = [];
    for (const trackedDeckId of trackedDeckIds) {
      try {
        const snapshot = await this.substitutionService.computeAndStoreReadiness(trackedDeckId, userId);
        recomputedDecks.push({
          trackedDeckId,
          rawPercent: snapshot.rawPercent,
          effectivePercent: snapshot.effectivePercent,
        });
      } catch (error) {
        // Non-fatal: the collection write already committed; the next
        // readiness request for this deck recomputes it.
        this.logger.warn({
          ...failureLog,
          userId,
          trackedDeckId,
          error: (error as Error).message,
        });
      }
    }
    return recomputedDecks;
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
    requestedSourceId: string | undefined,
    quantity: number = 1,
    requestedVersion: TVersionParts = {},
  ): Promise<IDecrementCardResponse> {
    if (quantity < 1) {
      throw new BadRequestException('Decrement quantity must be at least 1');
    }

    let sourceId = requestedSourceId ?? '';
    const result = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        // Without a named import the card must have one row to take from; with copies in more than
        // one import or version the player has to say which (the web picker always does).
        let version = withDefaults(requestedVersion);
        if (requestedSourceId === undefined) {
          const sole = await this.soleRowOf(manager, userId, cardIdentifier);
          sourceId = sole.sourceId;
          version = withDefaults(sole);
        }
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
          where: { userId, cardIdentifier, sourceId, ...version },
        });
        if (!row) {
          throw new NotFoundException(
            `No "${cardIdentifier}" row on this source at that version`,
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
        const snapshot = await this.substitutionService.computeAndStoreReadiness(trackedDeckId, userId);
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

  private async soleRowOf(
    manager: EntityManager,
    userId: string,
    cardIdentifier: string,
  ): Promise<CollectionCardEntity> {
    const rows = await manager.find(CollectionCardEntity, { where: { userId, cardIdentifier } });
    if (rows.length === 0) {
      throw new NotFoundException(`No copy of "${cardIdentifier}" in the collection`);
    }
    if (rows.length > 1) {
      throw new BadRequestException({
        code: 'SOURCE_REQUIRED',
        message: `"${cardIdentifier}" is held in more than one import or version: name the import and version`,
      });
    }
    return rows[0]!;
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
        'td.id = dc.trackedDeckId AND td.userId = :userId AND td.deletedAt IS NULL',
        { userId },
      )
      .where('dc.cardIdentifier = :cardIdentifier', { cardIdentifier })
      .select('DISTINCT dc.trackedDeckId', 'trackedDeckId')
      .getRawMany<{ trackedDeckId: number }>();

    return rows.map((row) => Number(row.trackedDeckId));
  }

  private async findAffectedDeckIdsForCards(
    userId: string,
    cardIdentifiers: readonly string[],
  ): Promise<readonly number[]> {
    const rows = await this.deckCardRepo
      .createQueryBuilder('dc')
      .innerJoin(
        TrackedDeckEntity,
        'td',
        'td.id = dc.trackedDeckId AND td.userId = :userId AND td.deletedAt IS NULL',
        { userId },
      )
      .where('dc.cardIdentifier IN (:...cardIdentifiers)', { cardIdentifiers })
      .select('DISTINCT dc.trackedDeckId', 'trackedDeckId')
      .getRawMany<{ trackedDeckId: number }>();

    return rows.map((row) => Number(row.trackedDeckId));
  }
}

function entryKey(entry: ICopyVersion & { readonly cardIdentifier: string }): string {
  return [entry.cardIdentifier, entry.printingCode, entry.edition, entry.finish, entry.condition].join('|');
}

/** One entry per card and version; items naming the same card at the same version are summed. */
function sumByCardVersion(items: readonly IBatchItem[]): IBatchEntry[] {
  const summed = new Map<string, IBatchEntry>();
  for (const item of items) {
    const entry: IBatchEntry = {
      cardIdentifier: item.cardIdentifier,
      ...withDefaults({ printingCode: item.printingCode, edition: item.edition, finish: item.finish }),
      quantity: item.quantity,
    };
    const key = entryKey(entry);
    const known = summed.get(key);
    summed.set(key, known ? { ...known, quantity: known.quantity + entry.quantity } : entry);
  }
  return [...summed.values()];
}
