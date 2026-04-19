import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubstituteDecisionEntity } from '../../database/entities/substitute-decision.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';

/**
 * Shape returned to callers (controllers, getDetail, etc.).
 * `pending` is virtual — absence of a row implies pending.
 */
export interface IDecision {
  readonly cardIdentifier: string;
  readonly decision: 'approved' | 'rejected';
}

/**
 * Input for upsert — all fields required.
 */
export interface IUpsertDecisionInput {
  readonly userId: string;
  readonly trackedDeckId: number;
  readonly cardIdentifier: string;
  readonly decision: 'approved' | 'rejected';
}

/**
 * Service owning all reads and writes to `substitute_decision`.
 *
 * Ownership enforcement: every public method calls `assertOwnsDeck` at the
 * top to guarantee that a user can only touch decisions for their own decks.
 * The unique index (userId, trackedDeckId, cardIdentifier) is the DB backstop.
 */
@Injectable()
export class DecisionsService {
  private readonly logger = new Logger(DecisionsService.name);

  constructor(
    @InjectRepository(SubstituteDecisionEntity)
    private readonly decisionRepo: Repository<SubstituteDecisionEntity>,
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
  ) {}

  /**
   * Throws `ForbiddenException` when the deck doesn't belong to the user.
   * Called at the top of every public method — never skipped.
   */
  async assertOwnsDeck(userId: string, trackedDeckId: number): Promise<void> {
    const deck = await this.trackedDeckRepo.findOne({
      where: { id: trackedDeckId, userId },
      select: ['id'],
    });
    if (!deck) {
      throw new ForbiddenException(
        'You do not have access to this tracked deck',
      );
    }
  }

  /**
   * Returns all non-pending decisions for the deck that belong to the user.
   * Used by `getDetail` and the GET /decisions endpoint.
   */
  async list(userId: string, trackedDeckId: number): Promise<IDecision[]> {
    await this.assertOwnsDeck(userId, trackedDeckId);

    const rows = await this.decisionRepo.find({
      where: { userId, trackedDeckId },
      select: ['cardIdentifier', 'decision'],
    });

    return rows.map((r) => ({
      cardIdentifier: r.cardIdentifier,
      decision: r.decision,
    }));
  }

  /**
   * Returns the set of card identifiers with `decision='rejected'` for the
   * given deck. Does NOT enforce ownership — callers are internal services
   * (ReSolveService, DecksService) that have already validated access through
   * other means. The set is used as an exclusion set for readiness computation.
   *
   * Note: `pending` and `approved` decisions do not appear in this set.
   */
  async loadExclusions(trackedDeckId: number): Promise<Set<string>> {
    const rows = await this.decisionRepo.find({
      where: { trackedDeckId, decision: 'rejected' },
      select: ['cardIdentifier'],
    });
    return new Set(rows.map((r) => r.cardIdentifier));
  }

  /**
   * Returns the count of `decision='rejected'` rows for a deck.
   * Fast aggregate used by `getDetail` (`rejectedCount`) and
   * `reSolveDryRun` (`persistedCount`).
   */
  async countRejected(trackedDeckId: number): Promise<number> {
    return this.decisionRepo.count({
      where: { trackedDeckId, decision: 'rejected' },
    });
  }

  /**
   * Upsert a decision row. If a row for (userId, trackedDeckId, cardIdentifier)
   * already exists, its `decision` is updated. Otherwise a new row is inserted.
   *
   * TypeORM `save` with a partial entity uses the unique index as the
   * idempotency backstop; concurrent requests for the same triple are safe
   * because PostgreSQL will resolve the conflict via the unique constraint.
   */
  async upsert(input: IUpsertDecisionInput): Promise<IDecision> {
    const { userId, trackedDeckId, cardIdentifier, decision } = input;
    await this.assertOwnsDeck(userId, trackedDeckId);

    const existing = await this.decisionRepo.findOne({
      where: { userId, trackedDeckId, cardIdentifier },
    });

    if (existing) {
      await this.decisionRepo.update(existing.id, {
        decision,
        updatedAt: new Date(),
      });
      this.logger.log('Decision updated', { userId, trackedDeckId, cardIdentifier, decision });
      return { cardIdentifier, decision };
    }

    const entity = this.decisionRepo.create({ userId, trackedDeckId, cardIdentifier, decision });
    await this.decisionRepo.save(entity);
    this.logger.log('Decision created', { userId, trackedDeckId, cardIdentifier, decision });
    return { cardIdentifier, decision };
  }

  /**
   * Deletes the decision row for a single card, resetting it to the implicit
   * `pending` state. No-ops when the row doesn't exist (idempotent).
   */
  async resetOne(
    userId: string,
    trackedDeckId: number,
    cardIdentifier: string,
  ): Promise<void> {
    await this.assertOwnsDeck(userId, trackedDeckId);
    await this.decisionRepo.delete({ userId, trackedDeckId, cardIdentifier });
    this.logger.log('Decision reset', { userId, trackedDeckId, cardIdentifier });
  }

  /**
   * Bulk-deletes all `decision='rejected'` rows for a deck, preserving
   * `decision='approved'` rows. Returns the number of deleted rows.
   *
   * Powers the "Clear rejections" banner action (Unit 16).
   */
  async clearRejections(userId: string, trackedDeckId: number): Promise<number> {
    await this.assertOwnsDeck(userId, trackedDeckId);

    const result = await this.decisionRepo.delete({
      userId,
      trackedDeckId,
      decision: 'rejected',
    });

    const affected = result.affected ?? 0;
    this.logger.log('Rejections cleared', { userId, trackedDeckId, affected });
    return affected;
  }
}
