import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  EVariantFetchJobStatus,
  IVariantJobCard,
  VariantFetchJobEntity,
} from '../database/entities/variant-fetch-job.entity';
import { IFetchCard } from './types/fetch-card';

export const RATE_LIMIT_MS = 1500;
export const ORPHAN_RECLAIM_MS = 5 * 60 * 1000;

@Injectable()
export class VariantFetchQueueService {
  constructor(
    @InjectRepository(VariantFetchJobEntity)
    private readonly jobRepo: Repository<VariantFetchJobEntity>,
  ) {}

  async enqueue(
    userId: string,
    deckId: number,
    storeId: number,
    cards: readonly IFetchCard[],
  ): Promise<VariantFetchJobEntity> {
    const existing = await this.jobRepo.findOne({
      where: { deckId, status: In([EVariantFetchJobStatus.Pending, EVariantFetchJobStatus.Running]) },
    });
    if (existing) return existing;

    const cardRows: IVariantJobCard[] = cards.map((c) => ({ cardIdentifier: c.cardIdentifier, status: 'pending' as const }));
    const job = this.jobRepo.create({
      userId, deckId, storeId,
      status: EVariantFetchJobStatus.Pending,
      cards: cardRows,
      total: cardRows.length,
      completed: 0,
      failed: 0,
    });
    return this.jobRepo.save(job);
  }

  async claimNext(workerId: string): Promise<VariantFetchJobEntity | null> {
    const rows: VariantFetchJobEntity[] = await this.jobRepo.query(
      `UPDATE variant_fetch_job SET status = $1, "claimedAt" = now(), "claimedBy" = $2, "startedAt" = COALESCE("startedAt", now())
       WHERE id = (
         SELECT id FROM variant_fetch_job WHERE status = $3
         ORDER BY "enqueuedAt" FOR UPDATE SKIP LOCKED LIMIT 1
       ) RETURNING *`,
      [EVariantFetchJobStatus.Running, workerId, EVariantFetchJobStatus.Pending],
    );
    return rows[0] ?? null;
  }

  async reclaimOrphans(): Promise<void> {
    await this.jobRepo.query(
      `UPDATE variant_fetch_job SET status = $1, "claimedAt" = NULL, "claimedBy" = NULL
       WHERE status = $2 AND "claimedAt" < now() - ($3 || ' milliseconds')::interval`,
      [EVariantFetchJobStatus.Pending, EVariantFetchJobStatus.Running, String(ORPHAN_RECLAIM_MS)],
    );
  }

  async markCardResult(jobId: string, cardIdentifier: string, ok: boolean): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return;
    const cards: IVariantJobCard[] = job.cards.map((c) =>
      c.cardIdentifier === cardIdentifier ? { ...c, status: (ok ? 'done' : 'failed') as IVariantJobCard['status'] } : c,
    );
    await this.jobRepo.update(
      { id: jobId },
      { cards, completed: ok ? job.completed + 1 : job.completed, failed: ok ? job.failed : job.failed + 1 },
    );
  }

  async finish(jobId: string, error: string | null): Promise<void> {
    await this.jobRepo.update(
      { id: jobId },
      { status: error ? EVariantFetchJobStatus.Failed : EVariantFetchJobStatus.Done, finishedAt: new Date(), error },
    );
  }

  async listForUser(userId: string): Promise<VariantFetchJobEntity[]> {
    // QueryBuilder (not raw query) so counters hydrate as numbers — a raw
    // pg query returns int columns as strings, which would corrupt the DTO
    // mapping and computeEtaSeconds.
    return this.jobRepo
      .createQueryBuilder('j')
      .where('j."userId" = :userId', { userId })
      .andWhere(
        `(j.status IN (:...active) OR j."finishedAt" > now() - interval '2 minutes')`,
        { active: [EVariantFetchJobStatus.Pending, EVariantFetchJobStatus.Running] },
      )
      .orderBy('j."enqueuedAt"', 'DESC')
      .getMany();
  }

  computeEtaSeconds(jobs: readonly VariantFetchJobEntity[]): number {
    const remaining = jobs.reduce((sum, j) => sum + Math.max(0, j.total - j.completed - j.failed), 0);
    return Math.ceil((remaining * RATE_LIMIT_MS) / 1000);
  }
}
