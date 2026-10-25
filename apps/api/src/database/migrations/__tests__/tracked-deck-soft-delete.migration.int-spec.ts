/**
 * DB-backed test for AddTrackedDeckDeletedAt1778533606000 (persona-rethink door 4: soft delete of
 * decks). Runs in its own schema so it never touches the synchronize-managed public schema; one
 * QueryRunner holds a single connection so `SET search_path` applies to every statement.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { AddTrackedDeckDeletedAt1778533606000 } from '../1778533606000-AddTrackedDeckDeletedAt';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'tracked_deck_soft_delete_migration_test';

describe('AddTrackedDeckDeletedAt1778533606000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function createLegacyTable(): Promise<void> {
    // Qualified, because the search path also holds `public`, whose real tracked_deck must never be touched.
    await queryRunner.query(`DROP TABLE IF EXISTS "${SCHEMA}"."tracked_deck"`);
    await queryRunner.query(
      `CREATE TABLE "${SCHEMA}"."tracked_deck" (id serial PRIMARY KEY, "userId" uuid NOT NULL, name varchar NOT NULL)`,
    );
  }

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
    await createLegacyTable();
  });

  it('adds a nullable deletedAt', async () => {
    await queryRunner.query(
      `INSERT INTO "tracked_deck" ("userId", name) VALUES (gen_random_uuid(), 'one'), (gen_random_uuid(), 'two')`,
    );

    await new AddTrackedDeckDeletedAt1778533606000().up(queryRunner);

    const columns: Array<{ data_type: string; is_nullable: string }> = await queryRunner.query(
      `SELECT data_type, is_nullable FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'tracked_deck' AND column_name = 'deletedAt'`,
      [SCHEMA],
    );
    expect(columns).toEqual([{ data_type: 'timestamp with time zone', is_nullable: 'YES' }]);
    const rows: Array<{ deletedAt: Date | null }> = await queryRunner.query(`SELECT "deletedAt" FROM "tracked_deck"`);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.deletedAt === null)).toBe(true);
  });

  it('runs twice and goes back down', async () => {
    const migration = new AddTrackedDeckDeletedAt1778533606000();
    await migration.up(queryRunner);

    await migration.up(queryRunner);
    await migration.down(queryRunner);

    const columns = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'tracked_deck' AND column_name = 'deletedAt'`,
      [SCHEMA],
    );
    expect(columns).toEqual([]);
  });
});
