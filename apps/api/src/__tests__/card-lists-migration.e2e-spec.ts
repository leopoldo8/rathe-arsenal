/**
 * Runs the CardLists migration on a throwaway schema: up creates both tables with their checks and
 * cascades, up again is harmless (a synchronized database may already hold them), and down removes them.
 * Needs a real PostgreSQL DB (DATABASE_URL); nothing outside the throwaway schema is touched.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { CardLists1778533600000 } from '../database/migrations/1778533600000-CardLists';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const SCHEMA = `card_lists_migration_${Date.now().toString(36)}`;

describe('CardLists migration (E2E)', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;

  async function tableExists(table: string): Promise<boolean> {
    const rows = await runner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [SCHEMA, table],
    );
    return rows.length === 1;
  }

  async function rejects(sql: string, params: unknown[] = []): Promise<void> {
    await runner.query('SAVEPOINT attempt');
    await expect(runner.query(sql, params)).rejects.toThrow();
    await runner.query('ROLLBACK TO SAVEPOINT attempt');
  }

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal',
    });
    await dataSource.initialize();
    runner = dataSource.createQueryRunner();
    await runner.query(`CREATE SCHEMA "${SCHEMA}"`);
    await runner.query(`SET search_path TO "${SCHEMA}"`);
    await runner.query(`CREATE TABLE "user" ("id" uuid PRIMARY KEY)`);
    await runner.query(`INSERT INTO "user" ("id") VALUES ($1)`, [USER_ID]);
  });

  afterAll(async () => {
    await runner?.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await runner?.release();
    await dataSource?.destroy();
  });

  it('creates both tables, enforces the checks and cascades deletes', async () => {
    await new CardLists1778533600000().up(runner);

    expect(await tableExists('card_list')).toBe(true);
    expect(await tableExists('card_list_line')).toBe(true);

    const [list] = await runner.query(
      `INSERT INTO "card_list" ("userId", "kind", "name", "priceMultiplier") VALUES ($1, 'sell', 'L', 7.00) RETURNING "id"`,
      [USER_ID],
    );
    await runner.query(`INSERT INTO "card_list_line" ("listId", "cardIdentifier", "quantity") VALUES ($1, 'a', 20)`, [list.id]);

    await runner.query('BEGIN');
    await rejects(`INSERT INTO "card_list" ("userId", "kind", "name") VALUES ($1, 'trade', 'L')`, [USER_ID]);
    await rejects(`INSERT INTO "card_list" ("userId", "kind", "name", "totalPriceCents") VALUES ($1, 'sell', 'L', -1)`, [USER_ID]);
    await rejects(`INSERT INTO "card_list" ("userId", "kind", "name", "priceMultiplier") VALUES ($1, 'sell', 'L', 50.01)`, [USER_ID]);
    await rejects(`INSERT INTO "card_list" ("userId", "kind", "name", "priceMultiplier") VALUES ($1, 'sell', 'L', 0)`, [USER_ID]);
    await rejects(`INSERT INTO "card_list_line" ("listId", "cardIdentifier", "quantity") VALUES ($1, 'a', 0)`, [list.id]);
    await rejects(`INSERT INTO "card_list_line" ("listId", "cardIdentifier", "quantity") VALUES ($1, 'a', 21)`, [list.id]);
    await rejects(`INSERT INTO "card_list_line" ("listId", "cardIdentifier", "quantity", "condition") VALUES ($1, 'a', 1, 'MINT')`, [list.id]);
    await rejects(`INSERT INTO "card_list_line" ("listId", "cardIdentifier", "quantity", "priceCents") VALUES ($1, 'a', 1, -1)`, [list.id]);
    await runner.query('ROLLBACK');

    await runner.query(`DELETE FROM "user" WHERE "id" = $1`, [USER_ID]);
    expect(await runner.query(`SELECT 1 FROM "card_list"`)).toHaveLength(0);
    expect(await runner.query(`SELECT 1 FROM "card_list_line"`)).toHaveLength(0);
  });

  it('runs again without failing when the tables already exist', async () => {
    await expect(new CardLists1778533600000().up(runner)).resolves.toBeUndefined();
  });

  it('drops both tables when reverted', async () => {
    await new CardLists1778533600000().down(runner);
    expect(await tableExists('card_list')).toBe(false);
    expect(await tableExists('card_list_line')).toBe(false);
  });
});
