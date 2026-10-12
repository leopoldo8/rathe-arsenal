import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TournamentDeckCardEntity } from '../database/entities/tournament-deck-card.entity';
import { TournamentDeckEntity, TTournamentDeckSource } from '../database/entities/tournament-deck.entity';
import { IDeckImportDto } from '../fabrary/dtos/deck-import.dto';
import { FabraryService } from '../fabrary/fabrary.service';
import { FabraryIndexClient, IIndexDeck, listPlayerNamedDecks, listTournamentDecks, pairKey } from './fabrary-index';
import { parseTournamentName, ulidTime } from './tournament-name';

export const TOURNAMENT_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const TOURNAMENT_SYNC_RETRY_MS = 60 * 60 * 1000;
export const DECK_FETCH_PACE_MS = 300;
const NAME_MAX = 255;

export interface ISyncClock {
  readonly now: () => Date;
  readonly sleep: (ms: number) => Promise<void>;
}

export const REAL_CLOCK: ISyncClock = {
  now: () => new Date(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export interface ITournamentSyncSummary {
  readonly listed: number;
  readonly playerNamed: number;
  readonly fetched: number;
  readonly failed: number;
  readonly kept: number;
}

function cardRows(deck: IDeckImportDto): Map<string, { quantity: number; sideboardQuantity: number }> {
  const rows = new Map<string, { quantity: number; sideboardQuantity: number }>();
  const row = (cardIdentifier: string) => {
    const existing = rows.get(cardIdentifier) ?? { quantity: 0, sideboardQuantity: 0 };
    rows.set(cardIdentifier, existing);
    return existing;
  };
  for (const entry of [...deck.mainboard, ...deck.equipment, ...deck.weapons]) row(entry.cardIdentifier).quantity += entry.quantity;
  for (const entry of deck.inventory) row(entry.cardIdentifier).sideboardQuantity += entry.quantity;
  return rows;
}

@Injectable()
export class TournamentSyncService {
  private readonly logger = new Logger(TournamentSyncService.name);
  private retryNotBefore = 0;
  // Stored rows only say when a sync started; a restart mid-sync would otherwise leave the rest for a day.
  private completedSinceBoot = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly index: FabraryIndexClient,
    private readonly fabrary: FabraryService,
  ) {}

  async isDue(now: Date): Promise<boolean> {
    if (now.getTime() < this.retryNotBefore) return false;
    if (!this.completedSinceBoot) return true;
    const [{ latest }] = (await this.dataSource.query(`SELECT max("syncedAt") AS latest FROM tournament_deck`)) as [
      { latest: Date | null },
    ];
    return latest === null || now.getTime() - new Date(latest).getTime() > TOURNAMENT_SYNC_INTERVAL_MS;
  }

  async sync(clock: ISyncClock = REAL_CLOCK): Promise<ITournamentSyncSummary | null> {
    const startedAt = clock.now();
    let listing;
    let playerNamed;
    try {
      listing = await listTournamentDecks(this.index.query);
      playerNamed = await listPlayerNamedDecks(this.index.query, new Set(listing.decks.map(pairKey)));
    } catch (error) {
      this.retryNotBefore = startedAt.getTime() + TOURNAMENT_SYNC_RETRY_MS;
      this.logger.error({ event: 'tournament.sync.failed', error: (error as Error).message });
      return null;
    }
    for (const listingLabel of listing.truncated) {
      this.logger.warn({ event: 'tournament.sync.truncated', ...listingLabel });
    }

    const listed: Array<{ deck: IIndexDeck; source: TTournamentDeckSource }> = [
      ...listing.decks.map((deck) => ({ deck, source: 'tournament' as const })),
      ...playerNamed.map((deck) => ({ deck, source: 'player-named' as const })),
    ];
    const known = new Set(
      (
        (await this.dataSource.query(`SELECT "fabraryUlid" FROM tournament_deck WHERE "fabraryUlid" = ANY($1)`, [
          listed.map(({ deck }) => deck.deckId),
        ])) as Array<{ fabraryUlid: string }>
      ).map((row) => row.fabraryUlid),
    );
    await this.dataSource.query(`UPDATE tournament_deck SET "syncedAt" = $2 WHERE "fabraryUlid" = ANY($1)`, [
      [...known],
      startedAt,
    ]);

    let fetched = 0;
    let failed = 0;
    for (const { deck, source } of listed.filter(({ deck }) => !known.has(deck.deckId))) {
      if (fetched + failed > 0) await clock.sleep(DECK_FETCH_PACE_MS);
      try {
        await this.store({ listed: deck, source }, await this.fabrary.fetchDeck(deck.deckId), startedAt);
        fetched += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn({ event: 'tournament.sync.deck_failed', fabraryUlid: deck.deckId, error: (error as Error).message });
      }
    }

    // An empty table whose every fetch failed is still due by stored state; the hour keeps it from relisting every pass.
    this.retryNotBefore = startedAt.getTime() + TOURNAMENT_SYNC_RETRY_MS;
    this.completedSinceBoot = true;
    const summary = { listed: listing.decks.length, playerNamed: playerNamed.length, fetched, failed, kept: known.size };
    this.logger.log({
      event: 'tournament.sync.done',
      ...summary,
      durationMs: clock.now().getTime() - startedAt.getTime(),
    });
    return summary;
  }

  private async store({ listed, source }: { listed: IIndexDeck; source: TTournamentDeckSource }, fetched: IDeckImportDto, syncedAt: Date): Promise<void> {
    const name = listed.name.slice(0, NAME_MAX);
    const { eventName, placement } = parseTournamentName(listed.name);
    await this.dataSource.transaction(async (manager) => {
      const deck = await manager.save(
        manager.create(TournamentDeckEntity, {
          fabraryUlid: listed.deckId,
          name,
          eventName: eventName?.slice(0, NAME_MAX) ?? null,
          placement,
          heroIdentifier: listed.heroIdentifier,
          format: listed.format,
          deckCreatedAt: ulidTime(listed.deckId),
          syncedAt,
          source,
        }),
      );
      const rows = [...cardRows(fetched).entries()].map(([cardIdentifier, copies]) => ({
        tournamentDeckId: deck.id,
        cardIdentifier,
        ...copies,
      }));
      if (rows.length > 0) await manager.insert(TournamentDeckCardEntity, rows);
    });
  }
}
