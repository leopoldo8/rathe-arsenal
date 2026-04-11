import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IEffectiveReadinessResult } from '@rathe-arsenal/engine';
import { RejectedSubstituteEntity } from '../../database/entities/rejected-substitute.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../../auth/authz.service';
import { SubstitutionService } from '../../substitution/substitution.service';

/**
 * Response shape for all three re-solve endpoints. Wraps the engine's
 * {@link IEffectiveReadinessResult} and adds:
 *   - `rejectionCount` so the frontend can render the modified-view
 *      banner immediately without a second round-trip.
 *   - `curveWarnings` list identifying cards whose substitutions were
 *      silently dropped because the pitch curve would have broken.
 */
export interface IReSolveResult {
  readonly rawPercent: number;
  readonly effectivePercent: number;
  readonly path: IEffectiveReadinessResult['path'];
  readonly fidelityPercent: number;
  readonly breakdown: IEffectiveReadinessResult['breakdown'];
  readonly substitutions: IEffectiveReadinessResult['substitutions'];
  readonly rejectionCount: number;
  readonly curveWarnings: readonly string[];
}

@Injectable()
export class ReSolveService {
  private readonly logger = new Logger(ReSolveService.name);

  constructor(
    @InjectRepository(RejectedSubstituteEntity)
    private readonly rejections: Repository<RejectedSubstituteEntity>,
    private readonly authzService: AuthzService,
    private readonly substitutionService: SubstitutionService,
  ) {}

  /**
   * Upsert a rejection row for `cardIdentifier`, recompute readiness
   * using **all** current rejections for the deck as the exclusion
   * set, and persist a fresh snapshot. Idempotent on the rejection
   * table but always returns a fresh engine result.
   */
  async rejectSubstitute(
    userId: string,
    trackedDeckId: number,
    cardIdentifier: string,
  ): Promise<IReSolveResult> {
    await this.authzService.assertOwnsTrackedDeck(userId, trackedDeckId);

    // Idempotent upsert: the unique index on
    // (trackedDeckId, cardIdentifier) is authoritative. The happy path
    // uses a single find-then-insert round-trip; the race-safety net
    // catches QueryFailedError (Postgres 23505 duplicate key) when two
    // concurrent requests for the same rejection slip through the
    // find gap. The second writer no-ops because the row already
    // exists.
    const existing = await this.rejections.findOne({
      where: { trackedDeckId, cardIdentifier },
    });

    if (!existing) {
      try {
        const row = this.rejections.create({ trackedDeckId, cardIdentifier });
        await this.rejections.save(row);
      } catch (err) {
        if (!this.isDuplicateKeyError(err)) throw err;
        this.logger.debug('Concurrent rejection insert raced on unique index', {
          trackedDeckId,
          cardIdentifier,
        });
      }
    }

    const exclusions = await this.loadExclusions(trackedDeckId);

    const snapshot = await this.substitutionService.computeAndStoreReadiness(
      trackedDeckId,
      userId,
      exclusions,
    );

    const curveWarnings = await this.deriveCurveWarningsFromSnapshot(
      trackedDeckId,
      userId,
      exclusions,
      snapshot,
    );

    this.logger.log('Substitute rejected', {
      trackedDeckId,
      cardIdentifier,
      exclusionCount: exclusions.size,
      curveWarningCount: curveWarnings.length,
    });

    return this.toResultFromSnapshot(snapshot, exclusions.size, curveWarnings);
  }

  /**
   * Delete all persisted rejections for the deck and recompute the
   * "original" (no-exclusion) snapshot.
   */
  async resetRejections(
    userId: string,
    trackedDeckId: number,
  ): Promise<IReSolveResult> {
    await this.authzService.assertOwnsTrackedDeck(userId, trackedDeckId);

    await this.rejections.delete({ trackedDeckId });

    const snapshot = await this.substitutionService.computeAndStoreReadiness(
      trackedDeckId,
      userId,
      new Set(),
    );

    this.logger.log('Rejections reset', { trackedDeckId });

    return this.toResultFromSnapshot(snapshot, 0, []);
  }

  /**
   * Dry-run re-solve: compute readiness with the caller-supplied
   * exclusion set without writing to `rejected_substitute` or
   * `deck_readiness_snapshot`.
   */
  async reSolveDryRun(
    userId: string,
    trackedDeckId: number,
    excludedCardIdentifiers: readonly string[],
  ): Promise<IReSolveResult> {
    await this.authzService.assertOwnsTrackedDeck(userId, trackedDeckId);

    const exclusions = new Set<string>(excludedCardIdentifiers);

    const result =
      await this.substitutionService.computeReadinessWithExclusions(
        trackedDeckId,
        userId,
        exclusions,
      );

    // Dry run never mutates the persisted rejection count.
    const persistedCount = await this.rejections.count({
      where: { trackedDeckId },
    });

    const curveWarnings = await this.deriveCurveWarnings(
      trackedDeckId,
      userId,
      exclusions,
      result,
    );

    return {
      rawPercent: result.rawPercent,
      effectivePercent: result.effectivePercent,
      path: result.path,
      fidelityPercent: result.fidelityPercent,
      breakdown: result.breakdown,
      substitutions: result.substitutions,
      rejectionCount: persistedCount,
      curveWarnings,
    };
  }

  private async loadExclusions(trackedDeckId: number): Promise<Set<string>> {
    const rows = await this.rejections.find({ where: { trackedDeckId } });
    return new Set(rows.map((r) => r.cardIdentifier));
  }

  private toResultFromSnapshot(
    snapshot: DeckReadinessSnapshotEntity,
    rejectionCount: number,
    curveWarnings: readonly string[],
  ): IReSolveResult {
    const breakdown =
      snapshot.breakdown as unknown as IEffectiveReadinessResult['breakdown'];
    const totalCards = this.computeTotalCardsFromBreakdown(breakdown);
    const derived = this.substitutionService.deriveSnapshotFields(
      snapshot,
      totalCards,
    );

    return {
      rawPercent: snapshot.rawPercent,
      effectivePercent: snapshot.effectivePercent,
      path: derived.path,
      fidelityPercent: derived.fidelityPercent,
      breakdown,
      substitutions:
        snapshot.substitutions as unknown as IEffectiveReadinessResult['substitutions'],
      rejectionCount,
      curveWarnings,
    };
  }

  private computeTotalCardsFromBreakdown(
    breakdown: IEffectiveReadinessResult['breakdown'],
  ): number {
    let total = 0;
    for (const e of breakdown.exact) total += e.quantity;
    for (const s of breakdown.substituted) total += s.original.quantity;
    for (const m of breakdown.missing) total += m.quantity;
    return total;
  }

  /**
   * Build a curve-warning list by comparing the exclusion-set result
   * against a no-exclusion baseline. A card is flagged when more
   * copies of it are missing with exclusions than without — a proxy
   * for "the rejection caused the pitch curve to reject the
   * fallback substitute".
   */
  private async deriveCurveWarnings(
    trackedDeckId: number,
    userId: string,
    exclusions: ReadonlySet<string>,
    result: IEffectiveReadinessResult,
  ): Promise<readonly string[]> {
    if (exclusions.size === 0) return [];

    const baseline =
      await this.substitutionService.computeReadinessWithExclusions(
        trackedDeckId,
        userId,
        new Set(),
      );

    return this.compareMissing(baseline.breakdown.missing, result.breakdown.missing);
  }

  private async deriveCurveWarningsFromSnapshot(
    trackedDeckId: number,
    userId: string,
    exclusions: ReadonlySet<string>,
    snapshot: DeckReadinessSnapshotEntity,
  ): Promise<readonly string[]> {
    if (exclusions.size === 0) return [];

    const baseline =
      await this.substitutionService.computeReadinessWithExclusions(
        trackedDeckId,
        userId,
        new Set(),
      );

    const breakdown =
      snapshot.breakdown as unknown as IEffectiveReadinessResult['breakdown'];

    return this.compareMissing(baseline.breakdown.missing, breakdown.missing);
  }

  /**
   * Returns true when the error is a Postgres unique-constraint
   * violation (SQLSTATE 23505) surfacing through TypeORM's
   * QueryFailedError. This catches the race between find() and save()
   * on the (trackedDeckId, cardIdentifier) unique index.
   */
  private isDuplicateKeyError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const maybe = err as { code?: unknown; driverError?: { code?: unknown } };
    return maybe.code === '23505' || maybe.driverError?.code === '23505';
  }

  private compareMissing(
    baselineMissing: IEffectiveReadinessResult['breakdown']['missing'],
    currentMissing: IEffectiveReadinessResult['breakdown']['missing'],
  ): readonly string[] {
    const baselineByCard = new Map<string, number>();
    for (const m of baselineMissing) {
      baselineByCard.set(m.cardIdentifier, m.quantity);
    }

    const warnings: string[] = [];
    for (const m of currentMissing) {
      const baselineCount = baselineByCard.get(m.cardIdentifier) ?? 0;
      if (m.quantity > baselineCount) {
        warnings.push(m.cardIdentifier);
      }
    }
    return warnings;
  }
}
