import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  EVariantFetchJobStatus,
  IVariantJobCard,
  VariantFetchJobEntity,
} from '../database/entities/variant-fetch-job.entity';
import { StoreEntity } from '../database/entities/store.entity';
import { StoreStockEntity } from '../database/entities/store-stock.entity';
import { CreditBudgetService } from './credit-budget.service';
import { readStoreAnswersConfig } from './store-answers.config';
import { classifyStoreRow, ILookupFacts, NO_LOOKUP, rowFactsOf } from './store-state';

export const ORPHAN_RECLAIM_MS = 5 * 60 * 1000;

interface ILookupFactsRow {
  readonly cardIdentifier: string;
  readonly pending: boolean;
  readonly lastDoneAt: Date | null;
  readonly lastFailedAt: Date | null;
}

@Injectable()
export class VariantFetchQueueService {
  private readonly logger = new Logger(VariantFetchQueueService.name);

  constructor(
    @InjectRepository(VariantFetchJobEntity)
    private readonly jobRepo: Repository<VariantFetchJobEntity>,
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
    @InjectRepository(StoreStockEntity)
    private readonly stockRepo: Repository<StoreStockEntity>,
    private readonly budget: CreditBudgetService,
    private readonly config: ConfigService,
  ) {}

  async lookupFacts(cardIdentifiers: readonly string[]): Promise<Map<string, ILookupFacts>> {
    const facts = new Map<string, ILookupFacts>();
    if (cardIdentifiers.length === 0) return facts;
    const rows: ILookupFactsRow[] = await this.jobRepo.query(
      `SELECT "cardIdentifier",
              bool_or(status IN ('pending', 'running')) AS pending,
              max("finishedAt") FILTER (WHERE status = 'done') AS "lastDoneAt",
              max("finishedAt") FILTER (WHERE status = 'failed') AS "lastFailedAt"
         FROM variant_fetch_job WHERE "cardIdentifier" = ANY($1) GROUP BY "cardIdentifier"`,
      [[...cardIdentifiers]],
    );
    for (const row of rows) {
      facts.set(row.cardIdentifier, { pending: row.pending, lastDoneAt: row.lastDoneAt, lastFailedAt: row.lastFailedAt });
    }
    return facts;
  }

  async enqueueMissing(storeId: number, cardIdentifiers: readonly string[], now: Date = new Date()): Promise<string[]> {
    const wanted = [...new Set(cardIdentifiers)];
    if (wanted.length === 0) return [];
    const [store, stockRows, facts] = await Promise.all([
      this.storeRepo.findOne({ where: { id: storeId } }),
      this.stockRepo.find({ where: { storeId, cardIdentifier: In(wanted) } }),
      this.lookupFacts(wanted),
    ]);
    if (!store) return [];

    const { priceValidDays } = readStoreAnswersConfig(this.config);
    const due = stockRows
      .filter(
        (stock) =>
          classifyStoreRow({
            row: rowFactsOf(stock),
            lastAvailabilityPassAt: store.lastAvailabilityPassAt,
            lookup: facts.get(stock.cardIdentifier) ?? NO_LOOKUP,
            priceValidDays,
            budgetStopped: false,
            now,
          }).needsLookup,
      )
      .map((stock) => stock.cardIdentifier);
    if (due.length === 0 || !(await this.budget.allowAutomaticLookups(now))) return [];

    await this.jobRepo.query(
      `INSERT INTO variant_fetch_job ("storeId", "cardIdentifier", status, cards, total)
       SELECT $1, card, 'pending', jsonb_build_array(jsonb_build_object('cardIdentifier', card, 'status', 'pending')), 1
         FROM unnest($2::text[]) AS card
        WHERE NOT EXISTS (SELECT 1 FROM variant_fetch_job j WHERE j."cardIdentifier" = card AND j.status = 'running')
       ON CONFLICT ("cardIdentifier") WHERE status = 'pending' DO NOTHING`,
      [storeId, due],
    );
    return due;
  }

  async claimNext(workerId: string): Promise<VariantFetchJobEntity | null> {
    if (!(await this.automaticLookupsAllowed())) return null;
    const result = await this.jobRepo.query(
      `UPDATE variant_fetch_job SET status = $1, "claimedAt" = now(), "claimedBy" = $2, "startedAt" = COALESCE("startedAt", now())
       WHERE id = (
         SELECT id FROM variant_fetch_job WHERE status = $3
         ORDER BY "enqueuedAt" FOR UPDATE SKIP LOCKED LIMIT 1
       ) RETURNING *`,
      [EVariantFetchJobStatus.Running, workerId, EVariantFetchJobStatus.Pending],
    );
    // TypeORM's Repository.query() returns `[rows, rowCount]` for UPDATE/DELETE
    // statements — not a flat rows array. Unwrap the rows before indexing, or an
    // empty queue yields a truthy `[]` that downstream code mistakes for a job.
    const rows: VariantFetchJobEntity[] = Array.isArray(result?.[0]) ? result[0] : result;
    return rows?.[0] ?? null;
  }

  /**
   * Jobs queued before the budget ran out must stop too, and a failed credit
   * read counts as "stopped": an unknown spend never licenses a paid call.
   */
  private async automaticLookupsAllowed(): Promise<boolean> {
    try {
      return await this.budget.allowAutomaticLookups();
    } catch (error) {
      this.logger.error({ event: 'firecrawl.budget_unreadable', error: (error as Error).message });
      return false;
    }
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
}
