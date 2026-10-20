import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CardPriceGroupSyncEntity } from '../database/entities/card-price-group-sync.entity';
import { ITcgcsvClient, TCGCSV_CLIENT } from './tcgcsv-client';
import { ITcgcsvGroup, ITcgcsvPriceRow } from './tcgcsv-parse';
import { sameUtcDay, shouldReadGroup } from './sync-rules';

const UPSERT_CHUNK_SIZE = 2000;
export const MAX_CONSECUTIVE_GROUP_FAILURES = 3;
export const PRICE_SYNC_LOCK_KEY = 7_316_201;

export interface ISyncReport {
  readonly groupsRead: number;
  readonly groupsFailed: number;
  readonly groupsSkipped: number;
}

const EMPTY_REPORT: ISyncReport = { groupsRead: 0, groupsFailed: 0, groupsSkipped: 0 };

@Injectable()
export class PriceSyncService {
  private readonly logger = new Logger(PriceSyncService.name);
  private groupsCache: { readonly day: Date; readonly groups: readonly ITcgcsvGroup[] } | null = null;
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(TCGCSV_CLIENT) private readonly client: ITcgcsvClient,
  ) {}

  /** One pass. Never throws: a failure is logged, the previous rows stay, and the next pass retries. */
  async runOnce(now: Date = new Date()): Promise<ISyncReport> {
    if (this.running) return EMPTY_REPORT;
    this.running = true;
    try {
      return await this.withSyncLock(() => this.pass(now));
    } catch (error) {
      this.logger.error({ event: 'prices.sync.failed', error: error instanceof Error ? error.message : 'unknown' });
      return EMPTY_REPORT;
    } finally {
      this.running = false;
    }
  }

  /** A second process (a deploy overlapping the old container, or `prices:sync` by hand) skips instead of reading tcgcsv twice. */
  private async withSyncLock(work: () => Promise<ISyncReport>): Promise<ISyncReport> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      const rows = (await runner.query('SELECT pg_try_advisory_lock($1) AS "locked"', [PRICE_SYNC_LOCK_KEY])) as { locked: boolean }[];
      if (rows[0]?.locked !== true) return EMPTY_REPORT;
      try {
        return await work();
      } finally {
        await runner.query('SELECT pg_advisory_unlock($1)', [PRICE_SYNC_LOCK_KEY]);
      }
    } finally {
      await runner.release();
    }
  }

  private async pass(now: Date): Promise<ISyncReport> {
    const groups = await this.groupList(now);
    if (groups.length === 0) return EMPTY_REPORT;

    const syncRows = await this.dataSource.getRepository(CardPriceGroupSyncEntity).find();
    const lastFetched = new Map(syncRows.map((row) => [row.groupId, row.fetchedAt]));
    const stale = groups
      .map((group) => group.groupId)
      .sort((a, b) => a - b)
      .filter((groupId) => {
        const fetchedAt = lastFetched.get(groupId) ?? null;
        return fetchedAt === null || !sameUtcDay(fetchedAt, now);
      });
    if (stale.length === 0) return { ...EMPTY_REPORT, groupsSkipped: groups.length };

    const lastUpdated = await this.client.fetchLastUpdated();
    let groupsRead = 0;
    let groupsFailed = 0;
    let consecutiveFailures = 0;
    for (const groupId of stale) {
      if (!shouldReadGroup(lastFetched.get(groupId) ?? null, lastUpdated, now)) continue;
      if (await this.readGroup(groupId, now)) {
        groupsRead += 1;
        consecutiveFailures = 0;
        continue;
      }
      groupsFailed += 1;
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_GROUP_FAILURES) {
        this.logger.warn({ event: 'prices.sync.stopped_after_failures', failures: consecutiveFailures });
        break;
      }
    }
    const report = { groupsRead, groupsFailed, groupsSkipped: groups.length - groupsRead - groupsFailed };
    if (groupsRead + groupsFailed > 0) this.logger.log({ event: 'prices.sync.pass', ...report });
    return report;
  }

  private async readGroup(groupId: number, now: Date): Promise<boolean> {
    try {
      const rows = await this.client.fetchPrices(groupId);
      await this.storeGroup(groupId, rows, now);
      this.logger.log({ event: 'prices.sync.group_read', groupId, rows: rows.length });
      return true;
    } catch (error) {
      this.logger.error({ event: 'prices.sync.group_failed', groupId, error: error instanceof Error ? error.message : 'unknown' });
      return false;
    }
  }

  private async groupList(now: Date): Promise<readonly ITcgcsvGroup[]> {
    if (this.groupsCache && sameUtcDay(this.groupsCache.day, now)) return this.groupsCache.groups;
    const groups = await this.client.fetchGroups();
    this.groupsCache = { day: now, groups };
    return groups;
  }

  private async storeGroup(groupId: number, rows: readonly ITcgcsvPriceRow[], fetchedAt: Date): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      for (let start = 0; start < rows.length; start += UPSERT_CHUNK_SIZE) {
        const chunk = rows.slice(start, start + UPSERT_CHUNK_SIZE);
        await manager.query(
          `INSERT INTO "card_price" ("productId", "subType", "marketPriceCents", "midPriceCents", "fetchedAt")
           SELECT t.p, t.s, t.m, t.d, $5::timestamptz
             FROM unnest($1::varchar[], $2::varchar[], $3::int[], $4::int[]) AS t(p, s, m, d)
           ON CONFLICT ("productId", "subType") DO UPDATE SET
             "marketPriceCents" = EXCLUDED."marketPriceCents",
             "midPriceCents" = EXCLUDED."midPriceCents",
             "fetchedAt" = EXCLUDED."fetchedAt"`,
          [
            chunk.map((row) => row.productId),
            chunk.map((row) => row.subType),
            chunk.map((row) => row.marketPriceCents),
            chunk.map((row) => row.midPriceCents),
            fetchedAt,
          ],
        );
      }
      await manager.query(
        `INSERT INTO "card_price_group_sync" ("groupId", "fetchedAt") VALUES ($1, $2)
         ON CONFLICT ("groupId") DO UPDATE SET "fetchedAt" = EXCLUDED."fetchedAt"`,
        [groupId, fetchedAt],
      );
    });
  }
}
