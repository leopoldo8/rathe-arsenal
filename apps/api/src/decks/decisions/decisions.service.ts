import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { SwapSuggestionEntity } from '../../database/entities/swap-suggestion.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { SubstitutionService } from '../../substitution/substitution.service';
import { SwapSuggestionQueryService } from '../../swaps/swap-suggestion-query.service';

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
 * TEMPORARY compatibility shim (design/07-swaps.md "Landing sequence" —
 * "Half A keeps the three old endpoints alive as a thin, explicitly
 * temporary compatibility shim"). Re-implements the pre-redesign
 * `/decks/:trackedDeckId/decisions` surface (and, via `bulkUpsert`,
 * `POST /api/reviews/bulk`) against `swap_suggestion` instead of the
 * dropped `substitute_decision` table, so the currently-shipped Deck
 * detail and Swaps screens keep working during the gap before Half B
 * replaces them with the new five-endpoint model.
 *
 * Deliberately reproduces today's over-broad, substitute-only-keyed
 * behavior: a decision made through this surface applies to EVERY
 * `swap_suggestion` row in the deck whose `substituteIdentifier` matches
 * the bare `cardIdentifier` the old DTO carries — regardless of which
 * original card or slot each row belongs to — because the old contract
 * has no `slot` and no original card to disambiguate with. This is
 * byte-for-byte what this surface already does today (§1's
 * cross-original suppression behavior), and explicitly wrong as a
 * permanent behavior. Retired rows are never touched by this shim's
 * broad updates — reviving them via a blunt match would violate the
 * "retired rows only resurrect explicitly, never silently" rule the
 * five-endpoint model observes elsewhere.
 *
 * This entire file is deleted in the same commit that lands Half B's new
 * endpoints and screen.
 */
@Injectable()
export class DecisionsService {
  private readonly logger = new Logger(DecisionsService.name);

  constructor(
    @InjectRepository(SwapSuggestionEntity)
    private readonly swapRepo: Repository<SwapSuggestionEntity>,
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly substitutionService: SubstitutionService,
    private readonly swapSuggestionQueryService: SwapSuggestionQueryService,
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
   *
   * Old wire contract: one row per substitute identifier. The new
   * per-quadruple model can have several `swap_suggestion` rows sharing a
   * substitute (different original card or slot) with different statuses
   * — deduped by `dedupeBySubstitute`, rejected winning any conflict.
   */
  async list(userId: string, trackedDeckId: number): Promise<IDecision[]> {
    await this.assertOwnsDeck(userId, trackedDeckId);

    const rows = await this.swapRepo.find({
      where: { userId, trackedDeckId, status: In(['approved', 'rejected']) },
      select: ['substituteIdentifier', 'status'],
    });

    return this.dedupeBySubstitute(rows);
  }

  /**
   * Collapses per-quadruple rows into one decision per substitute
   * identifier, matching the old table's (userId, trackedDeckId,
   * cardIdentifier=substitute) uniqueness. When the same substitute backs
   * rows with conflicting statuses, `rejected` wins — the conservative
   * choice: a suppressed substitute should read as suppressed even if one
   * of its rows happens to also be approved elsewhere in the deck.
   */
  private dedupeBySubstitute(
    rows: readonly { substituteIdentifier: string; status: string }[],
  ): IDecision[] {
    const bySubstitute = new Map<string, 'approved' | 'rejected'>();
    for (const row of rows) {
      // The caller's query already filters to status IN ('approved',
      // 'rejected'); this narrows defensively rather than trusting the
      // query shape at the type level.
      if (row.status !== 'approved' && row.status !== 'rejected') continue;
      if (bySubstitute.get(row.substituteIdentifier) === 'rejected') continue;
      bySubstitute.set(row.substituteIdentifier, row.status);
    }
    return Array.from(bySubstitute.entries()).map(([cardIdentifier, decision]) => ({
      cardIdentifier,
      decision,
    }));
  }

  /**
   * Returns the count of distinct substitutes with a rejected decision for
   * a deck (not scoped to `userId` — matches the pre-existing, unscoped
   * query shape this method has always had).
   */
  async countRejected(trackedDeckId: number): Promise<number> {
    const rows = await this.swapRepo.find({
      where: { trackedDeckId, status: In(['approved', 'rejected']) },
      select: ['substituteIdentifier', 'status'],
    });
    return this.dedupeBySubstitute(rows).filter((d) => d.decision === 'rejected').length;
  }

  /**
   * Upsert a decision (approve or reject) for `cardIdentifier` — the
   * shim's broad, substitute-only match (see class header).
   *
   * @param manager - Optional `EntityManager` for participating in an outer
   *   transaction (e.g. `bulkUpsert`). When omitted, uses the injected
   *   repository directly.
   */
  async upsert(input: IUpsertDecisionInput, manager?: EntityManager): Promise<IDecision> {
    const { userId, trackedDeckId, cardIdentifier, decision } = input;
    await this.assertOwnsDeck(userId, trackedDeckId);
    await this.applyBroadDecision(trackedDeckId, cardIdentifier, decision, manager);
    this.logger.log('Decision applied (shim, broad substitute match)', {
      userId,
      trackedDeckId,
      cardIdentifier,
      decision,
    });
    return { cardIdentifier, decision };
  }

  private async applyBroadDecision(
    trackedDeckId: number,
    substituteIdentifier: string,
    decision: 'approved' | 'rejected',
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(SwapSuggestionEntity) : this.swapRepo;
    const now = new Date();
    await repo.update(
      {
        trackedDeckId,
        substituteIdentifier,
        // Every currently-live row except retired ones -- retired rows are
        // invisible bookkeeping and must only resurrect explicitly.
        status: In(['pending', 'approved', 'rejected']),
      },
      decision === 'approved'
        ? { status: 'approved', appliedAt: now }
        : { status: 'rejected', rejectedAt: now },
    );
  }

  /**
   * Resets every matching row's decision back to pending (never deletes —
   * SWAP-02's "retire, never delete" spirit extended to the shim: instead
   * of the old table's hard delete, this flips status back to pending).
   * No-ops when no matching row exists (idempotent).
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

    const repo = manager ? manager.getRepository(SwapSuggestionEntity) : this.swapRepo;
    await repo.update(
      { trackedDeckId, substituteIdentifier: cardIdentifier, status: In(['approved', 'rejected']) },
      { status: 'pending', appliedAt: null, rejectedAt: null, rejectionReason: null, rejectionNote: null },
    );
    this.logger.log('Decision reset (shim)', { userId, trackedDeckId, cardIdentifier });
  }

  /**
   * Bulk-resets all rejected rows for a deck back to pending (preserves
   * approved rows). Returns the number of rows reset.
   *
   * Powers the "Clear rejections" banner action.
   */
  async clearRejections(userId: string, trackedDeckId: number): Promise<number> {
    await this.assertOwnsDeck(userId, trackedDeckId);

    const result = await this.swapRepo.update(
      { trackedDeckId, status: 'rejected' },
      { status: 'pending', rejectedAt: null, rejectionReason: null, rejectionNote: null },
    );

    const affected = result.affected ?? 0;
    this.logger.log('Rejections cleared (shim)', { userId, trackedDeckId, affected });
    return affected;
  }

  /**
   * Bulk-writes up to 200 review operations (upserts + resets) in a single
   * transaction. Pre-validates ownership and then runs all validated ops
   * atomically (all-or-nothing) — the shim preserves this atomicity
   * guarantee specifically (design §7), even though the *new* five-endpoint
   * bulk model downgrades to per-endpoint calls once Half B ships. After
   * commit, recomputes readiness once per affected deck.
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
        failures.push({
          trackedDeckId: String(op.trackedDeckId),
          cardIdentifier: op.cardIdentifier,
          error: 'NOT_ACCESSIBLE',
        });
        continue;
      }

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
      return { succeeded: 0, failed: failures };
    }

    // -----------------------------------------------------------------
    // Phase 2: Transaction phase (all-or-nothing)
    // -----------------------------------------------------------------

    let txAbortError: IBulkUpsertResult['transactionError'];

    try {
      await this.dataSource.transaction(async (manager: EntityManager) => {
        for (let i = 0; i < validatedOps.length; i++) {
          const op = validatedOps[i]!;

          try {
            if (op.kind === 'reset') {
              await manager.getRepository(SwapSuggestionEntity).update(
                {
                  trackedDeckId: op.trackedDeckId,
                  substituteIdentifier: op.cardIdentifier,
                  status: In(['approved', 'rejected']),
                },
                {
                  status: 'pending',
                  appliedAt: null,
                  rejectedAt: null,
                  rejectionReason: null,
                  rejectionNote: null,
                },
              );
            } else {
              await this.applyBroadDecision(
                op.trackedDeckId,
                op.cardIdentifier,
                op.decision,
                manager,
              );
            }
          } catch (innerError) {
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
        const { excludedIdentifiers, approvedIdentifiers } =
          await this.swapSuggestionQueryService.loadReadinessInputs(deckId);
        await this.substitutionService.computeAndStoreReadiness(
          deckId,
          userId,
          excludedIdentifiers,
          approvedIdentifiers,
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
