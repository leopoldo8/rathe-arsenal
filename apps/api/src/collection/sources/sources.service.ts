import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';

/**
 * Manages `csv_source` rows. Owns the lifecycle of both `kind='manual'` and
 * `kind='csv'` sources. Every write to `collection_card` calls
 * `ensureManualSource` so the manual source exists before the card row is
 * inserted.
 *
 * Design: `ensureManualSource` is idempotent — two concurrent calls for the
 * same user will resolve to the same row because:
 * 1. The first call succeeds (INSERT) or the DB enforces the partial unique
 *    index `(userId) WHERE kind='manual'` and throws a unique-constraint
 *    violation.
 * 2. On constraint violation the catch block re-reads the row within the same
 *    EntityManager context, ensuring the caller participates in the outer tx.
 */
@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name);

  constructor(
    @InjectRepository(CsvSourceEntity)
    private readonly csvSourceRepo: Repository<CsvSourceEntity>,
  ) {}

  /**
   * Returns the `kind='manual'` source for `userId`, creating it if it does
   * not yet exist. Idempotent: two parallel calls for the same user will both
   * resolve to the same row.
   *
   * @param userId - The authenticated user's UUID.
   * @param manager - Optional outer EntityManager when called inside a
   *   transaction (e.g. deck import). Pass it so the find-or-create
   *   participates in the same transaction and cannot be rolled back
   *   independently.
   */
  async ensureManualSource(
    userId: string,
    manager?: EntityManager,
  ): Promise<CsvSourceEntity> {
    const repo = manager
      ? manager.getRepository(CsvSourceEntity)
      : this.csvSourceRepo;

    // Fast path: row already exists.
    const existing = await repo.findOne({
      where: { userId, kind: 'manual' },
    });

    if (existing) {
      return existing;
    }

    // Slow path: insert. On unique-constraint violation (concurrent call),
    // fall back to a re-read.
    try {
      const source = repo.create({
        userId,
        kind: 'manual',
        label: 'Manual entries',
        originalFilename: null,
        sourceUrl: null,
        contentHash: null,
        cardCount: null,
        active: true,
      });

      const saved = await repo.save(source);

      this.logger.log('Manual source created', { userId, sourceId: saved.id });

      return saved;
    } catch (error) {
      // Unique constraint violation means another concurrent caller already
      // inserted the row. Re-read within the same manager so the caller's
      // transaction stays consistent.
      const errorCode = (error as { code?: string }).code;
      if (errorCode === '23505') {
        const refetched = await repo.findOne({
          where: { userId, kind: 'manual' },
        });
        if (refetched) {
          return refetched;
        }
      }
      throw error;
    }
  }
}
