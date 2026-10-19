import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CardPriceGroupSyncEntity } from '../database/entities/card-price-group-sync.entity';
import { ICardPrinting, printingsOfCard } from '../lists/printing-key';
import { mapSetToGroup } from './group-mapping';
import { ITcgcsvClient, TCGCSV_CLIENT } from './tcgcsv-client';
import { ITcgcsvGroup, ITcgcsvPriceRow } from './tcgcsv-parse';
import { sameUtcDay, shouldReadGroup } from './sync-rules';

const UPSERT_CHUNK_SIZE = 2000;
const SET_CODE_LENGTH = 3;

export interface ISyncReport {
  readonly groupsRead: number;
  readonly groupsSkipped: number;
  readonly setsUnmapped: readonly string[];
}

const EMPTY_REPORT: ISyncReport = { groupsRead: 0, groupsSkipped: 0, setsUnmapped: [] };

interface INeededSet {
  readonly name: string;
  readonly code: string;
}

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
      return await this.pass(now);
    } catch (error) {
      this.logger.error({ event: 'prices.sync.failed', error: error instanceof Error ? error.message : 'unknown' });
      return EMPTY_REPORT;
    } finally {
      this.running = false;
    }
  }

  private async pass(now: Date): Promise<ISyncReport> {
    const needed = await this.neededSets();
    if (needed.length === 0) return EMPTY_REPORT;

    const groups = await this.groupList(now);
    const groupIds = new Set<number>();
    const unmapped: string[] = [];
    for (const set of needed) {
      const groupId = mapSetToGroup(set, groups);
      if (groupId === null) unmapped.push(set.name);
      else groupIds.add(groupId);
    }
    if (unmapped.length > 0) this.logger.warn({ event: 'prices.sync.sets_unmapped', sets: unmapped });
    if (groupIds.size === 0) return { ...EMPTY_REPORT, setsUnmapped: unmapped };

    const syncRows = await this.dataSource.getRepository(CardPriceGroupSyncEntity).find();
    const lastFetched = new Map(syncRows.map((row) => [row.groupId, row.fetchedAt]));
    const stale = [...groupIds].sort((a, b) => a - b).filter((groupId) => {
      const fetchedAt = lastFetched.get(groupId) ?? null;
      return fetchedAt === null || !sameUtcDay(fetchedAt, now);
    });
    if (stale.length === 0) return { groupsRead: 0, groupsSkipped: groupIds.size, setsUnmapped: unmapped };

    const lastUpdated = await this.client.fetchLastUpdated();
    let groupsRead = 0;
    for (const groupId of stale) {
      if (!shouldReadGroup(lastFetched.get(groupId) ?? null, lastUpdated, now)) continue;
      if (await this.readGroup(groupId, now)) groupsRead += 1;
    }
    return { groupsRead, groupsSkipped: groupIds.size - groupsRead, setsUnmapped: unmapped };
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

  /** The sets that hold a printing of a card on any sell list: the line's own printing, or every printing of its card. */
  private async neededSets(): Promise<INeededSet[]> {
    const rows = (await this.dataSource.query(
      `SELECT DISTINCT x."cardIdentifier", x."printing"
         FROM "card_list_line" x JOIN "card_list" l ON l."id" = x."listId"
        WHERE l."kind" = 'sell'`,
    )) as { cardIdentifier: string; printing: string | null }[];

    const sets = new Map<string, INeededSet>();
    for (const row of rows) {
      const printings: readonly ICardPrinting[] = printingsOfCard(row.cardIdentifier) ?? [];
      for (const printing of printings) {
        if (row.printing !== null && printing.key !== row.printing) continue;
        if (printing.set === null || sets.has(printing.set)) continue;
        sets.set(printing.set, { name: printing.set, code: printing.identifier.slice(0, SET_CODE_LENGTH) });
      }
    }
    return [...sets.values()];
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
