import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FabraryService } from '../fabrary/fabrary.service';
import { IPublicDeck, publicUsageSignal } from '../recommendations/public-deck-usage';
import { IUsageSignal } from '../recommendations/usage-signal';
import { FabraryIndexClient } from './fabrary-index';
import { IPublicDeckStore, refreshPublicDecks } from './public-decks';

/** Public decks are re-read from Fabrary at most once a week per hero and format. */
export const PUBLIC_DECKS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** After a failed refresh the stored decks are used as they are for an hour before Fabrary is asked again. */
export const PUBLIC_DECKS_RETRY_MS = 60 * 60 * 1000;

interface IStoredCardRow {
  readonly fabraryUlid: string;
  readonly authorKey: string;
  readonly deckUpdatedAt: Date;
  readonly cardIdentifier: string | null;
  readonly quantity: number | null;
}

/** `public_deck`, `public_deck_card` and `public_deck_refresh` through parameterized SQL. */
export class PublicDeckSqlStore implements IPublicDeckStore {
  constructor(private readonly dataSource: DataSource) {}

  async storedVersions(heroIdentifier: string, format: string): Promise<ReadonlyMap<string, Date>> {
    const rows = (await this.dataSource.query(
      `SELECT "fabraryUlid", "deckUpdatedAt" FROM public_deck WHERE "heroIdentifier" = $1 AND format = $2`,
      [heroIdentifier, format],
    )) as Array<{ fabraryUlid: string; deckUpdatedAt: Date }>;
    return new Map(rows.map((row) => [row.fabraryUlid, new Date(row.deckUpdatedAt)]));
  }

  async save(heroIdentifier: string, format: string, deck: IPublicDeck): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const [{ id }] = (await manager.query(
        `INSERT INTO public_deck ("fabraryUlid", "heroIdentifier", format, "authorKey", "deckUpdatedAt", "fetchedAt")
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT ("fabraryUlid") DO UPDATE SET "heroIdentifier" = EXCLUDED."heroIdentifier", format = EXCLUDED.format,
           "authorKey" = EXCLUDED."authorKey", "deckUpdatedAt" = EXCLUDED."deckUpdatedAt", "fetchedAt" = EXCLUDED."fetchedAt"
         RETURNING id`,
        [deck.fabraryUlid, heroIdentifier, format, deck.authorKey, deck.updatedAt],
      )) as [{ id: string }];
      await manager.query(`DELETE FROM public_deck_card WHERE "publicDeckId" = $1`, [id]);
      const cards = [...deck.cards.entries()];
      if (cards.length === 0) return;
      await manager.query(
        `INSERT INTO public_deck_card ("publicDeckId", "cardIdentifier", quantity)
         SELECT $1, card, quantity FROM unnest($2::varchar[], $3::int[]) AS t(card, quantity)`,
        [id, cards.map(([cardIdentifier]) => cardIdentifier), cards.map(([, quantity]) => quantity)],
      );
    });
  }

  async keepOnly(heroIdentifier: string, format: string, fabraryUlids: readonly string[]): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM public_deck WHERE "heroIdentifier" = $1 AND format = $2 AND NOT ("fabraryUlid" = ANY($3::varchar[]))`,
      [heroIdentifier, format, [...fabraryUlids]],
    );
  }

  async markRefreshed(heroIdentifier: string, format: string, at: Date, decks: number): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO public_deck_refresh ("heroIdentifier", format, "refreshedAt", decks) VALUES ($1, $2, $3, $4)
       ON CONFLICT ("heroIdentifier", format) DO UPDATE SET "refreshedAt" = EXCLUDED."refreshedAt", decks = EXCLUDED.decks`,
      [heroIdentifier, format, at, decks],
    );
  }

  async lastRefresh(heroIdentifier: string, format: string): Promise<Date | null> {
    const [row] = (await this.dataSource.query(
      `SELECT "refreshedAt" FROM public_deck_refresh WHERE "heroIdentifier" = $1 AND format = $2`,
      [heroIdentifier, format],
    )) as Array<{ refreshedAt: Date }>;
    return row ? new Date(row.refreshedAt) : null;
  }

  async load(heroIdentifier: string, format: string): Promise<IPublicDeck[]> {
    const rows = (await this.dataSource.query(
      `SELECT d."fabraryUlid", d."authorKey", d."deckUpdatedAt", c."cardIdentifier", c.quantity
         FROM public_deck d LEFT JOIN public_deck_card c ON c."publicDeckId" = d.id
        WHERE d."heroIdentifier" = $1 AND d.format = $2`,
      [heroIdentifier, format],
    )) as IStoredCardRow[];
    const decks = new Map<string, { authorKey: string; updatedAt: Date; cards: Map<string, number> }>();
    for (const row of rows) {
      const deck = decks.get(row.fabraryUlid) ?? { authorKey: row.authorKey, updatedAt: new Date(row.deckUpdatedAt), cards: new Map<string, number>() };
      if (row.cardIdentifier !== null && row.quantity !== null) deck.cards.set(row.cardIdentifier, row.quantity);
      decks.set(row.fabraryUlid, deck);
    }
    return [...decks.entries()].map(([fabraryUlid, deck]) => ({ fabraryUlid, ...deck }));
  }
}

/**
 * The usage signal from public Fabrary decks, for heroes and formats with too few tournament decks (AD-029). The decks
 * are cached in the database and re-read from Fabrary only when the cache is older than `PUBLIC_DECKS_TTL_MS`, so a
 * recommendation run costs no Fabrary call on most runs.
 */
@Injectable()
export class PublicDecksService {
  private readonly logger = new Logger(PublicDecksService.name);
  private readonly store: PublicDeckSqlStore;
  private readonly retryNotBefore = new Map<string, number>();
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly index: FabraryIndexClient,
    private readonly fabrary: FabraryService,
  ) {
    this.store = new PublicDeckSqlStore(dataSource);
  }

  /** Null below the minimum number of decks. A failed refresh falls back to the decks already stored. */
  async usage(heroIdentifier: string, format: string, now: Date = new Date()): Promise<IUsageSignal | null> {
    await this.refreshIfStale(heroIdentifier, format, now);
    return publicUsageSignal(await this.store.load(heroIdentifier, format), { now });
  }

  private async refreshIfStale(heroIdentifier: string, format: string, now: Date): Promise<void> {
    const key = `${format}|${heroIdentifier}`;
    if (now.getTime() < (this.retryNotBefore.get(key) ?? 0)) return;
    const last = await this.store.lastRefresh(heroIdentifier, format);
    if (last && now.getTime() - last.getTime() < PUBLIC_DECKS_TTL_MS) return;
    const running = this.inFlight.get(key) ?? this.refresh(key, heroIdentifier, format, now);
    this.inFlight.set(key, running);
    try {
      await running;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async refresh(key: string, heroIdentifier: string, format: string, now: Date): Promise<void> {
    try {
      const summary = await refreshPublicDecks(
        { query: this.index.query, fetchDeck: (fabraryUlid) => this.fabrary.fetchDeck(fabraryUlid) },
        this.store,
        { heroIdentifier, format, now },
      );
      this.logger.log({ event: 'public_decks.refresh.done', heroIdentifier, format, ...summary });
    } catch (error) {
      this.retryNotBefore.set(key, now.getTime() + PUBLIC_DECKS_RETRY_MS);
      this.logger.warn({ event: 'public_decks.refresh.failed', heroIdentifier, format, error: (error as Error).message });
    }
  }
}
