/**
 * DB-backed test for WidenShareChecks1778533611000 (persona-rethink door 11: the `quote` intent and the
 * `offer`, `quote_sent` and `buy` events; door 12: the closing line). Runs in its own schema; every DROP
 * is schema-qualified because `public` is second in the search path and an unqualified DROP would find
 * the real table there.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { WidenShareChecks1778533611000 } from '../1778533611000-WidenShareChecks';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'quote_intent_migration_test';
const USER_ID = '00000000-0000-0000-0000-000000000001';

describe('WidenShareChecks1778533611000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function createLegacyTables(): Promise<void> {
    for (const table of ['share_link', 'share_event', 'user']) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${SCHEMA}"."${table}" CASCADE`);
    }
    await queryRunner.query(
      `CREATE TABLE "user" (
         id uuid PRIMARY KEY,
         "referredVia" varchar(8),
         CONSTRAINT "CHK_user_referred_via_valid" CHECK ("referredVia" IN ('deck', 'want', 'sell'))
       )`,
    );
    await queryRunner.query(
      `CREATE TABLE "share_link" (
         id serial PRIMARY KEY,
         intent varchar(16) NOT NULL,
         CONSTRAINT "CHK_share_link_intent_valid" CHECK (intent IN ('deck', 'missing', 'want', 'sell'))
       )`,
    );
    await queryRunner.query(
      `CREATE TABLE "share_event" (
         id serial PRIMARY KEY,
         kind varchar(16) NOT NULL,
         intent varchar(16),
         CONSTRAINT "CHK_share_event_kind_valid" CHECK (kind IN ('created', 'opened', 'signed_up')),
         CONSTRAINT "CHK_share_event_intent_valid" CHECK (intent IS NULL OR intent IN ('deck', 'missing', 'want', 'sell'))
       )`,
    );
    await queryRunner.query(`INSERT INTO "user" (id) VALUES ($1)`, [USER_ID]);
  }

  /** Tries one statement inside a transaction that is always rolled back, so probes never leave rows behind. */
  async function accepted(statement: string): Promise<boolean> {
    await queryRunner.query('BEGIN');
    try {
      await queryRunner.query(statement);
      return true;
    } catch {
      return false;
    } finally {
      await queryRunner.query('ROLLBACK');
    }
  }

  const probes = {
    linkQuote: `INSERT INTO "share_link" (intent) VALUES ('quote')`,
    linkBogus: `INSERT INTO "share_link" (intent) VALUES ('bogus')`,
    eventIntentQuote: `INSERT INTO "share_event" (kind, intent) VALUES ('created', 'quote')`,
    eventIntentBogus: `INSERT INTO "share_event" (kind, intent) VALUES ('created', 'bogus')`,
    eventOffer: `INSERT INTO "share_event" (kind) VALUES ('offer')`,
    eventQuoteSent: `INSERT INTO "share_event" (kind) VALUES ('quote_sent')`,
    eventBuy: `INSERT INTO "share_event" (kind) VALUES ('buy')`,
    eventBogus: `INSERT INTO "share_event" (kind) VALUES ('bogus')`,
    referredQuote: `UPDATE "user" SET "referredVia" = 'quote'`,
    referredBogus: `UPDATE "user" SET "referredVia" = 'bogus'`,
  } as const;

  beforeAll(async () => {
    dataSource = new DataSource({ type: 'postgres', url: DATABASE_URL, schema: SCHEMA, synchronize: false });
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.query(`CREATE SCHEMA "${SCHEMA}"`);
    await queryRunner.query(`SET search_path TO "${SCHEMA}", public`);
  });

  afterAll(async () => {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.release();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await createLegacyTables();
  });

  it('widens the four checks in one migration', async () => {
    const before = {
      linkQuote: await accepted(probes.linkQuote),
      eventOffer: await accepted(probes.eventOffer),
      referredQuote: await accepted(probes.referredQuote),
    };
    expect(before).toEqual({ linkQuote: false, eventOffer: false, referredQuote: false });

    await new WidenShareChecks1778533611000().up(queryRunner);

    const after: Record<string, boolean> = {};
    for (const [name, statement] of Object.entries(probes)) after[name] = await accepted(statement);
    expect(after).toEqual({
      linkQuote: true,
      linkBogus: false,
      eventIntentQuote: true,
      eventIntentBogus: false,
      eventOffer: true,
      eventQuoteSent: true,
      eventBuy: true,
      eventBogus: false,
      referredQuote: true,
      referredBogus: false,
    });
  });

  it('adds the closing line column and restores the previous lists on down()', async () => {
    const migration = new WidenShareChecks1778533611000();
    await migration.up(queryRunner);
    await migration.up(queryRunner);
    const column: Array<{ character_maximum_length: number; is_nullable: string }> = await queryRunner.query(
      `SELECT character_maximum_length, is_nullable FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'user' AND column_name = 'shareClosingLine'`,
      [SCHEMA],
    );
    expect(column).toEqual([{ character_maximum_length: 140, is_nullable: 'YES' }]);

    await migration.down(queryRunner);

    expect(await accepted(probes.linkQuote)).toBe(false);
    expect(await accepted(probes.eventQuoteSent)).toBe(false);
    expect(await accepted(probes.referredQuote)).toBe(false);
    expect(await accepted(`INSERT INTO "share_link" (intent) VALUES ('missing')`)).toBe(true);
    expect(await accepted(`INSERT INTO "share_event" (kind) VALUES ('opened')`)).toBe(true);
    const gone = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'user' AND column_name = 'shareClosingLine'`,
      [SCHEMA],
    );
    expect(gone).toEqual([]);
  });
});
