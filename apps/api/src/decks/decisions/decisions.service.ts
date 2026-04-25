import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { SubstituteDecisionEntity } from '../../database/entities/substitute-decision.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { SubstitutionService } from '../../substitution/substitution.service';

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

// ---------------------------------------------------------------------------
// Bulk-write types (exported for use by ReviewsController + DTOs)
// ---------------------------------------------------------------------------

/**
 * A single operation within a bulk review write request.
 * Exactly one of `decision` or `reset` must be present.
 */
export interface IBulkReviewOperation {
  readonly trackedDeckId: number;
  readonly cardIdentifier: string;
  /** Present for upsert ops. Must be absent when `reset` is true. */
  readonly decision?: 'APPROVED' | 'REJECTED';
  /** Present for reset ops. Must be absent when `decision` is set. */
  readonly reset?: true;
}

/**
 * A single operation that failed pre-transaction validation.
 */
export interface IBulkReviewFailure {
  readonly trackedDeckId: string;
  readonly cardIdentifier: string;
  readonly error: 'NOT_ACCESSIBLE' | 'INVALID_SHAPE';
}

/**
 * Response shape from `DecisionsService.bulkUpsert`.
 */
export interface IBulkUpsertResult {
  readonly succeeded: number;
  readonly failed: readonly IBulkReviewFailure[];
  readonly transactionError?: {
    readonly code: string;
    readonly cursorHint?: number;
  };
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Validated upsert op — decision is guaranteed present. */
type IValidatedUpsertOp = {
  readonly kind: 'upsert';
  readonly trackedDeckId: number;
  readonly cardIdentifier: string;
  readonly decision: 'approved' | 'rejected';
};

/** Validated reset op — no decision field. */
type IValidatedResetOp = {
  readonly kind: 'reset';
  readonly trackedDeckId: number;
  readonly cardIdentifier: string;
};

type IValidatedOp = IValidatedUpsertOp | IValidatedResetOp;

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
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly substitutionService: SubstitutionService,
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
   * @param manager - Optional `EntityManager` for participating in an outer
   *   transaction (e.g. `bulkUpsert`). When omitted, uses the injected
   *   repository directly.
   */
  async upsert(input: IUpsertDecisionInput, manager?: EntityManager): Promise<IDecision> {
    const { userId, trackedDeckId, cardIdentifier, decision } = input;
    await this.assertOwnsDeck(userId, trackedDeckId);

    const repo = manager
      ? manager.getRepository(SubstituteDecisionEntity)
      : this.decisionRepo;

    const existing = await repo.findOne({
      where: { userId, trackedDeckId, cardIdentifier },
    });

    if (existing) {
      await repo.update(existing.id, {
        decision,
        updatedAt: new Date(),
      });
      this.logger.log('Decision updated', { userId, trackedDeckId, cardIdentifier, decision });
      return { cardIdentifier, decision };
    }

    const entity = repo.create({ userId, trackedDeckId, cardIdentifier, decision });
    await repo.save(entity);
    this.logger.log('Decision created', { userId, trackedDeckId, cardIdentifier, decision });
    return { cardIdentifier, decision };
  }

  /**
   * Deletes the decision row for a single card, resetting it to the implicit
   * `pending` state. No-ops when the row doesn't exist (idempotent).
   *
   * @param manager - Optional `EntityManager` for participating in an outer
   *   transaction (e.g. `bulkUpsert`). When omitted, uses the injected
   *   repository directly.
   */
  async resetOne(
    userId: string,
    trackedDeckId: number,
    cardIdentifier: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.assertOwnsDeck(userId, trackedDeckId);

    const repo = manager
      ? manager.getRepository(SubstituteDecisionEntity)
      : this.decisionRepo;

    await repo.delete({ userId, trackedDeckId, cardIdentifier });
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

  /**
   * Bulk-writes up to 200 review operations (upserts + resets) in a single
   * transaction. Pre-validates ownership and then runs all validated ops
   * atomically (all-or-nothing). After commit, recomputes readiness once per
   * affected deck.
   *
   * ## Phase semantics
   *
   * 1. **Pre-validation (no writes)**: batch-check ownership with a single
   *    query; classify unknown/foreign decks as `NOT_ACCESSIBLE` (opaque —
   *    no distinction between forbidden and not-found to prevent enumeration).
   *
   * 2. **Transaction phase (all-or-nothing)**: all validated ops run inside
   *    a single `dataSource.transaction`. Any statement-level error aborts
   *    the entire batch (PostgreSQL semantics). No per-op savepoints.
   *
   * 3. **Post-commit recompute**: readiness is recomputed once per distinct
   *    `trackedDeckId` from the validated ops. Non-fatal.
   */
  async bulkUpsert(
    userId: string,
    operations: readonly IBulkReviewOperation[],
  ): Promise<IBulkUpsertResult> {
    // -----------------------------------------------------------------
    // Phase 1: Pre-validation (no writes)
    // -----------------------------------------------------------------

    // 1a. Batch ownership check: single query for all distinct deck IDs.
    const distinctDeckIds = [...new Set(operations.map((op) => op.trackedDeckId))];

    const ownedRows = await this.trackedDeckRepo.find({
      where: { userId, id: In(distinctDeckIds) },
      select: ['id'],
    });
    const ownedDeckIds = new Set(ownedRows.map((r) => r.id));

    const failures: IBulkReviewFailure[] = [];
    const validatedOps: IValidatedOp[] = [];

    for (const op of operations) {
      if (!ownedDeckIds.has(op.trackedDeckId)) {
        // Opaque error — do NOT distinguish forbidden vs. not-found.
        failures.push({
          trackedDeckId: String(op.trackedDeckId),
          cardIdentifier: op.cardIdentifier,
          error: 'NOT_ACCESSIBLE',
        });
        continue;
      }

      // 1b. Shape validation: exactly one of decision or reset must be present.
      const hasDecision = op.decision !== undefined;
      const hasReset = op.reset === true;

      if (hasDecision && hasReset) {
        failures.push({
          trackedDeckId: String(op.trackedDeckId),
          cardIdentifier: op.cardIdentifier,
          error: 'INVALID_SHAPE',
        });
        continue;
      }

      if (!hasDecision && !hasReset) {
        failures.push({
          trackedDeckId: String(op.trackedDeckId),
          cardIdentifier: op.cardIdentifier,
          error: 'INVALID_SHAPE',
        });
        continue;
      }

      if (hasReset) {
        validatedOps.push({
          kind: 'reset',
          trackedDeckId: op.trackedDeckId,
          cardIdentifier: op.cardIdentifier,
        });
      } else {
        // hasDecision is true here; TypeScript can't narrow op.decision
        // to non-undefined without the explicit check above, so we assert.
        const decisionValue = op.decision!.toLowerCase() as 'approved' | 'rejected';
        validatedOps.push({
          kind: 'upsert',
          trackedDeckId: op.trackedDeckId,
          cardIdentifier: op.cardIdentifier,
          decision: decisionValue,
        });
      }
    }

    if (validatedOps.length === 0) {
      // All ops were pre-classified as failures; nothing to commit.
      return { succeeded: 0, failed: failures };
    }

    // -----------------------------------------------------------------
    // Phase 2: Transaction phase (all-or-nothing)
    // -----------------------------------------------------------------

    let txAbortError: IBulkUpsertResult['transactionError'];

    try {
      await this.dataSource.transaction(async (manager: EntityManager) => {
        const repo = manager.getRepository(SubstituteDecisionEntity);

        for (let i = 0; i < validatedOps.length; i++) {
          const op = validatedOps[i]!;

          try {
            if (op.kind === 'reset') {
              await repo.delete({
                userId,
                trackedDeckId: op.trackedDeckId,
                cardIdentifier: op.cardIdentifier,
              });
            } else {
              // Upsert: find existing row and update, or insert new.
              const existing = await repo.findOne({
                where: {
                  userId,
                  trackedDeckId: op.trackedDeckId,
                  cardIdentifier: op.cardIdentifier,
                },
              });

              if (existing) {
                await repo.update(existing.id, {
                  decision: op.decision,
                  updatedAt: new Date(),
                });
              } else {
                const entity = repo.create({
                  userId,
                  trackedDeckId: op.trackedDeckId,
                  cardIdentifier: op.cardIdentifier,
                  decision: op.decision,
                });
                await repo.save(entity);
              }
            }
          } catch (innerError) {
            // Record cursor position and rethrow to abort the tx.
            const errorClass =
              (innerError as Error).constructor?.name ?? 'UnknownError';
            this.logger.warn({
              event: 'review.bulk.tx_aborted',
              userId,
              batchSize: validatedOps.length,
              failedAtIndex: i,
              errorClass,
              error: (innerError as Error).message,
            });
            txAbortError = { code: errorClass, cursorHint: i };
            throw innerError;
          }
        }
      });
    } catch (outerError) {
      if (txAbortError === undefined) {
        // Exception not raised from an inner op — record it anyway.
        const errorClass =
          (outerError as Error).constructor?.name ?? 'UnknownError';
        this.logger.warn({
          event: 'review.bulk.tx_aborted',
          userId,
          batchSize: validatedOps.length,
          errorClass,
          error: (outerError as Error).message,
        });
        txAbortError = { code: errorClass };
      }

      // On tx abort: all validated ops are re-classified as failures.
      const txFailures: IBulkReviewFailure[] = validatedOps.map((op) => ({
        trackedDeckId: String(op.trackedDeckId),
        cardIdentifier: op.cardIdentifier,
        error: 'INVALID_SHAPE' as const,
      }));

      return {
        succeeded: 0,
        failed: [...failures, ...txFailures],
        transactionError: txAbortError,
      };
    }

    // -----------------------------------------------------------------
    // Phase 3: Post-commit recompute (non-fatal, once per affected deck)
    // -----------------------------------------------------------------

    const affectedDeckIds = [...new Set(validatedOps.map((op) => op.trackedDeckId))];

    for (const deckId of affectedDeckIds) {
      try {
        const exclusions = await this.loadExclusions(deckId);
        await this.substitutionService.computeAndStoreReadiness(
          deckId,
          userId,
          exclusions,
        );
      } catch (recomputeError) {
        this.logger.warn({
          msg: 'Failed to recompute readiness after bulk review',
          userId,
          trackedDeckId: deckId,
          error: (recomputeError as Error).message,
        });
      }
    }

    // -----------------------------------------------------------------
    // Telemetry
    // -----------------------------------------------------------------

    const approvedCount = validatedOps.filter(
      (op): op is IValidatedUpsertOp =>
        op.kind === 'upsert' && op.decision === 'approved',
    ).length;
    const rejectedCount = validatedOps.filter(
      (op): op is IValidatedUpsertOp =>
        op.kind === 'upsert' && op.decision === 'rejected',
    ).length;
    const resetCount = validatedOps.filter((op) => op.kind === 'reset').length;

    this.logger.log({
      event: 'review.bulk',
      userId,
      approvedCount,
      rejectedCount,
      resetCount,
      failedCount: failures.length,
      deckCount: affectedDeckIds.length,
    });

    return {
      succeeded: validatedOps.length,
      failed: failures,
    };
  }
}
