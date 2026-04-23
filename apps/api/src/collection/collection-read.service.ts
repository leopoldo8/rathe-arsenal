import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { CsvSourceEntity } from '../database/entities/csv-source.entity';

/**
 * Read-only service that exposes the user's effective collection, summing
 * quantities across all *active* sources for each card identifier.
 *
 * This service is the single canonical read path for owned-card data.
 * All downstream consumers — CatalogService, SubstitutionService,
 * TestDeckService, DecksService, and the future LibraryService — should
 * inject CollectionReadService instead of querying `collection_card` directly.
 *
 * Why a separate service:
 * - Every read-side consumer depends only on reads, never on writes.
 * - Splitting the read surface narrows the dependency graph (write-side
 *   CollectionService is not pulled into catalog or substitution contexts).
 * - Centralising the summation query ensures inactive-source exclusion is
 *   applied consistently everywhere.
 */
@Injectable()
export class CollectionReadService {
  constructor(
    @InjectRepository(CollectionCardEntity)
    private readonly collectionCardRepo: Repository<CollectionCardEntity>,
    @InjectRepository(CsvSourceEntity)
    private readonly csvSourceRepo: Repository<CsvSourceEntity>,
  ) {}

  /**
   * Returns a map of `cardIdentifier → summed quantity` across all active
   * sources for `userId`. Cards with a sum of 0 are excluded.
   *
   * @param userId - The authenticated user's UUID.
   * @param cardIdentifiers - Optional filter. When provided, only these
   *   identifiers are included in the result; all others are omitted.
   *   Useful for the catalog search path where we only need quantities
   *   for the matched cards.
   */
  async loadOwned(
    userId: string,
    cardIdentifiers?: readonly string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();

    if (cardIdentifiers !== undefined && cardIdentifiers.length === 0) {
      return result;
    }

    // Find active source IDs for this user.
    const activeSources = await this.csvSourceRepo.find({
      where: { userId, active: true },
      select: ['id'],
    });

    if (activeSources.length === 0) {
      return result;
    }

    const activeSourceIds = activeSources.map((s) => s.id);

    // Build the where clause.
    const whereConditions: Parameters<typeof this.collectionCardRepo.find>[0] = {
      where: {
        userId,
        sourceId: In(activeSourceIds),
        ...(cardIdentifiers !== undefined
          ? { cardIdentifier: In([...cardIdentifiers]) }
          : {}),
      },
    };

    const rows = await this.collectionCardRepo.find(whereConditions);

    // Sum quantities per cardIdentifier across active sources.
    for (const row of rows) {
      const current = result.get(row.cardIdentifier) ?? 0;
      result.set(row.cardIdentifier, current + row.quantity);
    }

    // Remove any entries that summed to 0.
    for (const [identifier, qty] of result) {
      if (qty <= 0) {
        result.delete(identifier);
      }
    }

    return result;
  }

  /**
   * Returns the count of distinct card identifiers the user owns (summed
   * quantity > 0) across all active sources. Used for the home empty-state
   * "N cards owned" label.
   *
   * @param userId - The authenticated user's UUID.
   */
  async countUniqueOwned(userId: string): Promise<number> {
    const owned = await this.loadOwned(userId);
    return owned.size;
  }
}
