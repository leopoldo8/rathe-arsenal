import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { RecommendationEntity } from '../database/entities/recommendation.entity';
import {
  RecommendationRunEntity,
  TRecommendationFailureCode,
  TRecommendationRunTrigger,
} from '../database/entities/recommendation-run.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { IKeptRecommendation } from './validate-answer';

export const AUTO_RUN_DELAY_MS = 5 * 60 * 1000;
export const RECOMMENDATION_ORPHAN_MS = 10 * 60 * 1000;

export interface IRunResult {
  readonly deckFingerprint: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly kept: readonly IKeptRecommendation[];
}

function firstRow<T>(result: unknown): T | null {
  // `query()` answers an UPDATE ... RETURNING with `[rows, rowCount]` and an INSERT with the rows alone.
  const rows = Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as T[]) : (result as T[]);
  return rows?.[0] ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === '23505';
}

@Injectable()
export class RecommendationQueueService {
  private readonly logger = new Logger(RecommendationQueueService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Called inside every deck-list write's transaction; a retired deck gets no automatic run. */
  async enqueueAuto(manager: EntityManager, trackedDeckId: number): Promise<void> {
    const deck = await manager.findOne(TrackedDeckEntity, { where: { id: trackedDeckId }, select: ['id', 'status'] });
    if (!deck || deck.status === 'retired') return;
    await this.upsertPending(manager, trackedDeckId, 'auto');
    this.logger.log({ event: 'recommendations.enqueued', trackedDeckId, trigger: 'auto' });
  }

  /** Generate: the running run when there is one, otherwise the deck's pending run made manual and due now. */
  async requestManual(trackedDeckId: number): Promise<RecommendationRunEntity> {
    const running = await this.dataSource
      .getRepository(RecommendationRunEntity)
      .findOne({ where: { trackedDeckId, status: 'running' } });
    if (running) return running;
    const run = await this.upsertPending(this.dataSource.manager, trackedDeckId, 'manual');
    this.logger.log({ event: 'recommendations.enqueued', trackedDeckId, trigger: 'manual' });
    return run;
  }

  private async upsertPending(
    manager: EntityManager,
    trackedDeckId: number,
    trigger: TRecommendationRunTrigger,
  ): Promise<RecommendationRunEntity> {
    const delayMs = trigger === 'auto' ? AUTO_RUN_DELAY_MS : 0;
    const result = await manager.query(
      `INSERT INTO recommendation_run ("trackedDeckId", "trigger", "status", "runAfter")
       VALUES ($1, $2, 'pending', clock_timestamp() + ($3 || ' milliseconds')::interval)
       ON CONFLICT ("trackedDeckId") WHERE "status" = 'pending' DO UPDATE SET
         "trigger" = CASE WHEN EXCLUDED."trigger" = 'manual' THEN 'manual' ELSE recommendation_run."trigger" END,
         "runAfter" = CASE
           WHEN EXCLUDED."trigger" = 'manual' OR recommendation_run."trigger" = 'auto' THEN EXCLUDED."runAfter"
           ELSE recommendation_run."runAfter"
         END
       RETURNING *`,
      [trackedDeckId, trigger, String(delayMs)],
    );
    const row = firstRow<RecommendationRunEntity>(result);
    if (!row) throw new Error(`recommendation run upsert returned no row for deck ${trackedDeckId}`);
    return row;
  }

  async claimNext(): Promise<RecommendationRunEntity | null> {
    const result = await this.dataSource.query(
      `UPDATE recommendation_run
          SET "status" = 'running', "claimedAt" = clock_timestamp(),
              "startedAt" = COALESCE("startedAt", clock_timestamp()), "attempts" = "attempts" + 1
        WHERE id = (
          SELECT r.id FROM recommendation_run r
           WHERE r."status" = 'pending' AND r."runAfter" <= clock_timestamp()
             AND NOT EXISTS (
               SELECT 1 FROM recommendation_run x WHERE x."trackedDeckId" = r."trackedDeckId" AND x."status" = 'running'
             )
           ORDER BY r."runAfter", r."createdAt"
           FOR UPDATE SKIP LOCKED
           LIMIT 1
        )
        RETURNING *`,
    );
    return firstRow<RecommendationRunEntity>(result);
  }

  async reclaimOrphans(): Promise<void> {
    const orphaned = `"status" = 'running' AND "claimedAt" < clock_timestamp() - ($1 || ' milliseconds')::interval`;
    const hasPending = `EXISTS (SELECT 1 FROM recommendation_run p WHERE p."trackedDeckId" = recommendation_run."trackedDeckId" AND p."status" = 'pending')`;
    await this.dataSource.query(
      `UPDATE recommendation_run SET "status" = 'failed', "error" = 'WORKER_LOST', "finishedAt" = clock_timestamp()
        WHERE ${orphaned} AND ${hasPending}`,
      [String(RECOMMENDATION_ORPHAN_MS)],
    );
    await this.dataSource.query(
      `UPDATE recommendation_run SET "status" = 'pending', "claimedAt" = NULL WHERE ${orphaned}`,
      [String(RECOMMENDATION_ORPHAN_MS)],
    );
  }

  async finishDone(run: RecommendationRunEntity, result: IRunResult): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      if (result.kept.length > 0) {
        await manager.insert(
          RecommendationEntity,
          result.kept.map((entry) => ({ runId: run.id, ...entry })),
        );
      }
      await manager.update(
        RecommendationRunEntity,
        { id: run.id, status: 'running' },
        {
          status: 'done',
          finishedAt: new Date(),
          deckFingerprint: result.deckFingerprint,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          error: null,
        },
      );
    });
  }

  async finishFailed(runId: string, code: TRecommendationFailureCode): Promise<void> {
    await this.dataSource.query(
      `UPDATE recommendation_run SET "status" = 'failed', "error" = $2, "finishedAt" = clock_timestamp() WHERE id = $1`,
      [runId, code],
    );
  }

  /** Back to pending at `runAfter`; when the deck already holds a newer pending run, this one is superseded by it. */
  async retryAt(run: RecommendationRunEntity, runAfter: Date): Promise<'retried' | 'superseded'> {
    try {
      const result = await this.dataSource.query(
        `UPDATE recommendation_run SET "status" = 'pending', "runAfter" = $2, "claimedAt" = NULL
          WHERE id = $1 AND NOT EXISTS (
            SELECT 1 FROM recommendation_run p WHERE p."trackedDeckId" = $3 AND p."status" = 'pending'
          )
          RETURNING id`,
        [run.id, runAfter, run.trackedDeckId],
      );
      if (firstRow(result)) return 'retried';
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE recommendation_run SET "runAfter" = GREATEST("runAfter", $2)
          WHERE "trackedDeckId" = $1 AND "status" = 'pending'`,
        [run.trackedDeckId, runAfter],
      );
      await manager.query(
        `UPDATE recommendation_run SET "status" = 'failed', "error" = 'SUPERSEDED', "finishedAt" = clock_timestamp()
          WHERE id = $1`,
        [run.id],
      );
    });
    return 'superseded';
  }
}
