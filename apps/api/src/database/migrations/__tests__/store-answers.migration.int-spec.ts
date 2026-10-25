/**
 * DB-backed test for StoreAnswers1778533609000 (persona-rethink door 10: one honest store answer
 * per card under a monthly budget). Runs in its own schema so it never touches the
 * synchronize-managed public schema. One QueryRunner holds a single connection for the DDL; the
 * concurrent increments go through the pool, whose connections get the same search path from the
 * `options` connection parameter.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { StoreAnswers1778533609000 } from '../1778533609000-StoreAnswers';
import { RECORD_CREDITS_SQL } from '../../../stores/credit-usage.sql';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'store_answers_migration_test';

describe('StoreAnswers1778533609000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function createLegacyTables(): Promise<void> {
    // Every DROP is qualified: with `public` second in the search path, an unqualified one would
    // find the real table there and delete the data of the shared database.
    for (const table of ['variant_fetch_job', 'store_stock', 'store', 'firecrawl_usage']) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${SCHEMA}"."${table}"`);
    }
    await queryRunner.query(`CREATE TABLE "${SCHEMA}"."store" (id serial PRIMARY KEY, slug varchar NOT NULL)`);
    await queryRunner.query(
      `CREATE TABLE "${SCHEMA}"."store_stock" (id serial PRIMARY KEY, "storeId" int NOT NULL, "cardIdentifier" varchar NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE TABLE "${SCHEMA}"."variant_fetch_job" (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         "userId" uuid NOT NULL,
         "deckId" int NOT NULL,
         "storeId" int NOT NULL,
         status varchar(20) NOT NULL DEFAULT 'pending',
         cards jsonb NOT NULL DEFAULT '[]',
         total int NOT NULL DEFAULT 0,
         completed int NOT NULL DEFAULT 0,
         failed int NOT NULL DEFAULT 0,
         "enqueuedAt" timestamptz NOT NULL DEFAULT now(),
         "startedAt" timestamptz,
         "finishedAt" timestamptz,
         "claimedAt" timestamptz,
         "claimedBy" varchar(100),
         error text
       )`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_vfj_user_status" ON "${SCHEMA}"."variant_fetch_job" ("userId", status)`);
    await queryRunner.query(`CREATE INDEX "IDX_vfj_deck_status" ON "${SCHEMA}"."variant_fetch_job" ("deckId", status)`);
  }

  async function insertJob(cardIdentifier: string, status: string): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "variant_fetch_job" ("storeId", "cardIdentifier", status) VALUES (1, $1, $2)`,
      [cardIdentifier, status],
    );
  }

  async function columnsOf(table: string): Promise<string[]> {
    const rows: Array<{ column_name: string }> = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
      [SCHEMA, table],
    );
    return rows.map((row) => row.column_name);
  }

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      schema: SCHEMA,
      synchronize: false,
      extra: { options: `-c search_path=${SCHEMA},public` },
    });
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

  it('allows one pending lookup per card', async () => {
    await queryRunner.query(
      `INSERT INTO "variant_fetch_job" ("userId", "deckId", "storeId", status) VALUES (gen_random_uuid(), 7, 1, 'pending'), (gen_random_uuid(), 7, 1, 'done')`,
    );

    await new StoreAnswers1778533609000().up(queryRunner);

    const columns = await columnsOf('variant_fetch_job');
    expect(columns).toContain('cardIdentifier');
    expect(columns).not.toContain('deckId');
    await insertJob('pack-hunt-red', 'pending');
    await expect(insertJob('pack-hunt-red', 'pending')).rejects.toThrow(/IDX_variant_fetch_job_pending_card|unique/);
    await insertJob('pack-hunt-red', 'done');
    await insertJob('pack-hunt-red', 'done');
    await insertJob('snatch-red', 'pending');
    const [{ count }] = (await queryRunner.query(`SELECT count(*)::int AS count FROM "variant_fetch_job"`)) as [{ count: number }];
    expect(count).toBe(4);

    await queryRunner.query(`DELETE FROM "variant_fetch_job"`);
    await new StoreAnswers1778533609000().down(queryRunner);

    const restored = await columnsOf('variant_fetch_job');
    expect(restored).toContain('deckId');
    expect(restored).not.toContain('cardIdentifier');
  });

  it('adds the nullable availability timestamps', async () => {
    await queryRunner.query(`INSERT INTO "store" (slug) VALUES ('cupula-dt')`);
    await queryRunner.query(`INSERT INTO "store_stock" ("storeId", "cardIdentifier") VALUES (1, 'pack-hunt-red'), (1, 'snatch-red')`);

    await new StoreAnswers1778533609000().up(queryRunner);

    const columns: Array<{ table_name: string; column_name: string; data_type: string; is_nullable: string }> =
      await queryRunner.query(
        `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
         WHERE table_schema = $1 AND column_name IN ('listedInStockAt', 'lastAvailabilityPassAt')
         ORDER BY table_name`,
        [SCHEMA],
      );
    expect(columns).toEqual([
      { table_name: 'store', column_name: 'lastAvailabilityPassAt', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      { table_name: 'store_stock', column_name: 'listedInStockAt', data_type: 'timestamp with time zone', is_nullable: 'YES' },
    ]);
    const stock: Array<{ listedInStockAt: Date | null }> = await queryRunner.query(`SELECT "listedInStockAt" FROM "store_stock"`);
    expect(stock).toHaveLength(2);
    expect(stock.every((row) => row.listedInStockAt === null)).toBe(true);
    const store: Array<{ lastAvailabilityPassAt: Date | null }> = await queryRunner.query(`SELECT "lastAvailabilityPassAt" FROM "store"`);
    expect(store).toEqual([{ lastAvailabilityPassAt: null }]);
  });

  it('counts credits per month atomically', async () => {
    await new StoreAnswers1778533609000().up(queryRunner);

    const columns: Array<{ column_name: string; data_type: string; character_maximum_length: number | null; is_nullable: string }> =
      await queryRunner.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'firecrawl_usage' ORDER BY column_name`,
        [SCHEMA],
      );
    expect(columns).toEqual([
      { column_name: 'credits', data_type: 'integer', character_maximum_length: null, is_nullable: 'NO' },
      { column_name: 'month', data_type: 'character', character_maximum_length: 7, is_nullable: 'NO' },
    ]);
    const keys: Array<{ attname: string }> = await queryRunner.query(
      `SELECT a.attname FROM pg_index i
       JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (i.indkey)
       WHERE n.nspname = $1 AND t.relname = 'firecrawl_usage' AND i.indisprimary`,
      [SCHEMA],
    );
    expect(keys).toEqual([{ attname: 'month' }]);

    await Promise.all(Array.from({ length: 20 }, () => dataSource.query(RECORD_CREDITS_SQL, ['2026-10', 5])));

    const rows: Array<{ month: string; credits: number }> = await queryRunner.query(`SELECT month, credits FROM "firecrawl_usage"`);
    expect(rows).toEqual([{ month: '2026-10', credits: 100 }]);
  });

  it('runs again over a database that synchronize already extended', async () => {
    await new StoreAnswers1778533609000().up(queryRunner);
    await insertJob('pack-hunt-red', 'pending');

    await new StoreAnswers1778533609000().up(queryRunner);

    await expect(insertJob('pack-hunt-red', 'pending')).rejects.toThrow();
  });
});
