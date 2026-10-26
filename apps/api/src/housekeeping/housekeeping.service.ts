import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** A deleted account and a deleted deck are kept this long, then removed for good (doors 4 and 5). */
export const DELETED_RETENTION_MS = 30 * DAY_MS;

/**
 * A sign-in code row is kept at least this long after it was asked for, whatever its state: the
 * limit of five codes per address and hour counts the rows, so a purge that took them sooner
 * would give the address its tries back (door 15).
 */
export const SIGN_IN_CODE_KEEP_MS = HOUR_MS;

/** Key of the advisory lock one tick holds, so a second worker's tick finds the work taken. */
export const HOUSEKEEPING_LOCK_KEY = 7_201_038;

export interface IHousekeepingCounts {
  readonly users: number;
  readonly decks: number;
  readonly signInCodes: number;
  readonly sessions: number;
}

export interface IHousekeepingResult {
  /** False when another worker held the lock and this tick deleted nothing. */
  readonly ran: boolean;
  readonly deleted: IHousekeepingCounts;
}

const NOTHING_DELETED: IHousekeepingCounts = { users: 0, decks: 0, signInCodes: 0, sessions: 0 };

/** `DELETE ... RETURNING` answers the rows, or `[rows, count]` depending on the driver path. */
function returnedRows(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  return (Array.isArray(raw[0]) ? raw[0] : raw) as Array<Record<string, unknown>>;
}

@Injectable()
export class HousekeepingService {
  private readonly logger = new Logger(HousekeepingService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * One pass: accounts and decks deleted 30 days ago, the sign-in codes that are used up or past their
   * expiry (and an hour old), and the sessions that ended. One transaction under an advisory lock, so
   * two workers running it at once delete each row once and the second one deletes nothing.
   */
  async tick(now: Date = new Date()): Promise<IHousekeepingResult> {
    const result = await this.dataSource.transaction(async (manager): Promise<IHousekeepingResult> => {
      const [lock] = (await manager.query('SELECT pg_try_advisory_xact_lock($1) AS locked', [
        HOUSEKEEPING_LOCK_KEY,
      ])) as Array<{ locked: boolean }>;
      if (lock?.locked !== true) return { ran: false, deleted: NOTHING_DELETED };
      return { ran: true, deleted: await this.deleteExpired(manager, now) };
    });
    this.logger.log({ event: 'housekeeping.tick', ran: result.ran, deleted: result.deleted });
    return result;
  }

  private async deleteExpired(manager: EntityManager, now: Date): Promise<IHousekeepingCounts> {
    const retentionCutoff = new Date(now.getTime() - DELETED_RETENTION_MS);
    const codeCutoff = new Date(now.getTime() - SIGN_IN_CODE_KEEP_MS);

    // Every table that belongs to a user cascades from the user row (imports, pending lines, copies, lists,
    // decks and their lines, sessions, share links, chats); only the sign-in codes are keyed by address.
    const users = returnedRows(
      await manager.query(`DELETE FROM "user" WHERE "deletedAt" < $1 RETURNING id, email`, [retentionCutoff]),
    );
    const purgedAddresses = users.map((row) => row['email'] as string);
    const addressCodes = returnedRows(
      await manager.query(
        `DELETE FROM "sign_in_code" WHERE email = ANY($1::text[]) AND "createdAt" < $2 RETURNING id`,
        [purgedAddresses, codeCutoff],
      ),
    );

    const decks = returnedRows(
      await manager.query(`DELETE FROM "tracked_deck" WHERE "deletedAt" < $1 RETURNING id`, [retentionCutoff]),
    );
    // share_link has no foreign key to the deck, so its rows (and their images) would otherwise outlive it.
    await manager.query(`DELETE FROM "share_link" WHERE "targetKind" = 'deck' AND "targetId" = ANY($1::int[])`, [
      decks.map((row) => row['id'] as number),
    ]);

    const spentCodes = returnedRows(
      await manager.query(
        `DELETE FROM "sign_in_code" WHERE ("consumedAt" IS NOT NULL OR "expiresAt" < $1) AND "createdAt" < $2 RETURNING id`,
        [now, codeCutoff],
      ),
    );
    const sessions = returnedRows(
      await manager.query(`DELETE FROM "user_session" WHERE "revokedAt" IS NOT NULL RETURNING id`),
    );

    return {
      users: users.length,
      decks: decks.length,
      signInCodes: addressCodes.length + spentCodes.length,
      sessions: sessions.length,
    };
  }
}
