/**
 * DB-backed test for AddCardReplacementSide1778533610000 (persona-rethink door 2: a pick moves copies
 * from a side). Runs in its own schema so it never touches the synchronize-managed public schema.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { AddCardReplacementSide1778533610000 } from '../1778533610000-AddCardReplacementSide';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'card_replacement_side_migration_test';

describe('AddCardReplacementSide1778533610000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function createLegacyTable(): Promise<void> {
    // Qualified, because the search path also holds `public`, whose real card_replacement must never be touched.
    await queryRunner.query(`DROP TABLE IF EXISTS "${SCHEMA}"."card_replacement"`);
    await queryRunner.query(
      `CREATE TABLE "${SCHEMA}"."card_replacement" (id serial PRIMARY KEY, slot varchar NOT NULL, quantity int NOT NULL)`,
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

  it('adds side with deck as the default and refuses any other value', async () => {
    await queryRunner.query(`INSERT INTO "card_replacement" (slot, quantity) VALUES ('mainboard', 2)`);

    await new AddCardReplacementSide1778533610000().up(queryRunner);

    const columns: Array<{ data_type: string; is_nullable: string; column_default: string | null }> = await queryRunner.query(
      `SELECT data_type, is_nullable, column_default FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'card_replacement' AND column_name = 'side'`,
      [SCHEMA],
    );
    expect(columns).toHaveLength(1);
    expect(columns[0]).toMatchObject({ data_type: 'character varying', is_nullable: 'NO' });
    expect(columns[0]!.column_default).toContain("'deck'");
    const before: Array<{ side: string }> = await queryRunner.query(`SELECT side FROM "card_replacement"`);
    expect(before).toEqual([{ side: 'deck' }]);
    await queryRunner.query(`INSERT INTO "card_replacement" (slot, quantity, side) VALUES ('mainboard', 1, 'inventory')`);
    await expect(
      queryRunner.query(`INSERT INTO "card_replacement" (slot, quantity, side) VALUES ('mainboard', 1, 'sideboard')`),
    ).rejects.toThrow(/CHK_card_replacement_side_valid/);
  });

  it('runs twice and goes back down', async () => {
    const migration = new AddCardReplacementSide1778533610000();
    await migration.up(queryRunner);

    await migration.up(queryRunner);
    await migration.down(queryRunner);

    const columns = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'card_replacement' AND column_name = 'side'`,
      [SCHEMA],
    );
    expect(columns).toEqual([]);
  });
});
