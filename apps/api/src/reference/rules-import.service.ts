import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { FetchGuardService } from '../common/fetch-guard/fetch-guard.service';
import { RulesEntryEntity } from '../database/entities/rules-entry.entity';
import { parseRulesIndex } from './rules-parse';

export const RULES_INDEX_HOST = 'rules.fabtcg.com';
export const RULES_INDEX_URL = `https://${RULES_INDEX_HOST}/en/search/search_index.json`;
export const RULES_REFRESH_MS = 24 * 60 * 60 * 1000;
export const RULES_SEARCH_LIMIT = 8;
export const RULE_TEXT_MAX = 1500;
const INSERT_BATCH = 500;

export type TRulesFetch = () => Promise<Uint8Array>;

export interface IRuleHit {
  readonly ruleNumber: string;
  readonly sectionTitle: string;
  readonly text: string;
  readonly url: string;
}

export interface IRulesSearchResult {
  readonly found: boolean;
  readonly entries: readonly IRuleHit[];
}

@Injectable()
export class RulesImportService {
  private readonly logger = new Logger(RulesImportService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly fetchGuard: FetchGuardService,
  ) {}

  readonly fetchIndex: TRulesFetch = async () => {
    const response = await this.fetchGuard.guardedFetch(RULES_INDEX_URL, {
      allowHosts: [RULES_INDEX_HOST],
      maxBytes: 10 * 1024 * 1024,
      timeoutMs: 30_000,
    });
    if (response.status !== 200) throw new Error(`rules index answered HTTP ${response.status}`);
    return response.body;
  };

  async isDue(now: Date): Promise<boolean> {
    const [{ latest }] = (await this.dataSource.query(`SELECT max("fetchedAt") AS latest FROM rules_entry`)) as [
      { latest: Date | null },
    ];
    return latest === null || now.getTime() - new Date(latest).getTime() > RULES_REFRESH_MS;
  }

  /** Resolves to whether the stored entries were replaced. */
  async importIndex(fetchIndex: TRulesFetch = this.fetchIndex, now: Date = new Date()): Promise<boolean> {
    let entries;
    let sourceHash;
    try {
      const body = await fetchIndex();
      sourceHash = createHash('sha256').update(body).digest('hex');
      entries = parseRulesIndex(JSON.parse(Buffer.from(body).toString('utf8')));
    } catch (error) {
      this.logger.error({ event: 'rules.sync.failed', error: (error as Error).message });
      return false;
    }
    if (entries.length === 0) {
      this.logger.error({ event: 'rules.sync.failed', error: 'the index holds no comprehensive rules entry' });
      return false;
    }

    const [stored] = (await this.dataSource.query(`SELECT "sourceHash" FROM rules_entry LIMIT 1`)) as Array<{
      sourceHash: string;
    }>;
    if (stored?.sourceHash === sourceHash) {
      await this.dataSource.query(`UPDATE rules_entry SET "fetchedAt" = $1`, [now]);
      return false;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM rules_entry`);
      for (let start = 0; start < entries.length; start += INSERT_BATCH) {
        await manager.insert(
          RulesEntryEntity,
          entries.slice(start, start + INSERT_BATCH).map((entry) => ({ ...entry, sourceHash, fetchedAt: now })),
        );
      }
    });
    this.logger.log({ event: 'rules.sync.done', entries: entries.length, sourceHash });
    return true;
  }

  async search(query: string, limit: number = RULES_SEARCH_LIMIT): Promise<IRulesSearchResult> {
    const text = query.trim();
    if (!text) return { found: false, entries: [] };
    const document = `"ruleNumber" || ' ' || "sectionTitle" || ' ' || "text"`;
    const rows = (await this.dataSource.query(
      `SELECT "ruleNumber", "sectionTitle", "text", url FROM rules_entry
        WHERE lower("ruleNumber") = lower($1)
           OR ($1 ~ '^[0-9]+(\.[0-9]+)*$' AND "ruleNumber" LIKE $1 || '.%')
           OR to_tsvector('simple', ${document}) @@ phraseto_tsquery('simple', $1)
           OR to_tsvector('english', ${document}) @@ plainto_tsquery('english', $1)
        ORDER BY lower("ruleNumber") = lower($1) DESC,
                 "ruleNumber" LIKE $1 || '.%' DESC,
                 to_tsvector('simple', ${document}) @@ phraseto_tsquery('simple', $1) DESC,
                 ts_rank(to_tsvector('english', ${document}), plainto_tsquery('english', $1)) DESC,
                 "ruleNumber"
        LIMIT $2`,
      [text, Math.min(limit, RULES_SEARCH_LIMIT)],
    )) as IRuleHit[];
    return {
      found: rows.length > 0,
      entries: rows.map((row) => ({ ...row, text: row.text.slice(0, RULE_TEXT_MAX) })),
    };
  }
}
