/**
 * DB-backed test for AddSpareRule1778533612000 (persona-rethink door 12). Runs in its own schema; every
 * DROP is schema-qualified because `public` is second in the search path and an unqualified DROP would
 * find the real table there.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { AddSpareRule1778533612000 } from '../database/migrations/1778533612000-AddSpareRule';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'spare_rule_migration_test';
const USER_ID = '00000000-0000-0000-0000-000000000002';

describe('AddSpareRule1778533612000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function accepted(statement: string, parameters: unknown[] = []): Promise<boolean> {
    await queryRunner.query('BEGIN');
    try {
      await queryRunner.query(statement, parameters);
      return true;
    } catch {
      return false;
    } finally {
      await queryRunner.query('ROLLBACK');
    }
  }

  async function columnsOfUser(): Promise<string[]> {
    const rows: Array<{ column_name: string }> = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'user' ORDER BY column_name`,
      [SCHEMA],
    );
    return rows.map((row) => row.column_name);
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
    await queryRunner.query(`DROP TABLE IF EXISTS "${SCHEMA}"."user" CASCADE`);
    await queryRunner.query(`CREATE TABLE "user" (id uuid PRIMARY KEY)`);
    await queryRunner.query(`INSERT INTO "user" (id) VALUES ($1)`, [USER_ID]);
  });

  it('adds the spare rule and the two closing lines with their checks', async () => {
    await new AddSpareRule1778533612000().up(queryRunner);

    const [existing] = (await queryRunner.query(
      `SELECT "spareRule", "sellClosingLine", "shareClosingLine" FROM "user" WHERE id = $1`,
      [USER_ID],
    )) as Array<Record<string, string | null>>;
    expect(existing).toEqual({ spareRule: null, sellClosingLine: null, shareClosingLine: null });

    const set = (column: string, value: string | null): Promise<boolean> =>
      accepted(`UPDATE "user" SET "${column}" = $1`, [value]);
    expect(await set('spareRule', 'within_format')).toBe(true);
    expect(await set('spareRule', 'any_deck')).toBe(true);
    expect(await set('spareRule', 'per_deck')).toBe(true);
    expect(await set('spareRule', null)).toBe(true);
    expect(await set('spareRule', 'other')).toBe(false);
    expect(await set('sellClosingLine', 'x'.repeat(140))).toBe(true);
    expect(await set('sellClosingLine', 'x'.repeat(141))).toBe(false);
    expect(await set('shareClosingLine', 'x'.repeat(141))).toBe(false);
  });

  it('runs twice without error and removes the three columns on down', async () => {
    const migration = new AddSpareRule1778533612000();
    await migration.up(queryRunner);
    await migration.up(queryRunner);
    expect(await columnsOfUser()).toEqual(['id', 'sellClosingLine', 'shareClosingLine', 'spareRule']);

    await migration.down(queryRunner);

    expect(await columnsOfUser()).toEqual(['id']);
  });
});
