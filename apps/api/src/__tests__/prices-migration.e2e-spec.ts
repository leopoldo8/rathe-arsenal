/**
 * Runs the CardPrices migration on a throwaway schema: up creates both tables, up again is harmless,
 * the primary key is (productId, subType), and down removes them. Needs a real PostgreSQL DB (DATABASE_URL).
 */
import { DataSource, QueryRunner } from 'typeorm';
import { CardPrices1778533601000 } from '../database/migrations/1778533601000-CardPrices';

const SCHEMA = `card_prices_migration_${Date.now().toString(36)}`;

describe('CardPrices migration (E2E)', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;

  async function tableExists(table: string): Promise<boolean> {
    const rows = await runner.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`, [SCHEMA, table]);
    return rows.length === 1;
  }

  beforeAll(async () => {
    dataSource = new DataSource({ type: 'postgres', url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal' });
    await dataSource.initialize();
    runner = dataSource.createQueryRunner();
    await runner.query(`CREATE SCHEMA "${SCHEMA}"`);
    await runner.query(`SET search_path TO "${SCHEMA}"`);
  });

  afterAll(async () => {
    await runner?.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await runner?.release();
    await dataSource?.destroy();
  });

  it('creates both tables and keys prices by product and sub type', async () => {
    await new CardPrices1778533601000().up(runner);
    expect(await tableExists('card_price')).toBe(true);
    expect(await tableExists('card_price_group_sync')).toBe(true);

    await runner.query(`INSERT INTO "card_price" VALUES ('1', 'Normal', 100, 120, now()), ('1', 'Rainbow Foil', NULL, NULL, now())`);
    await expect(runner.query(`INSERT INTO "card_price" VALUES ('1', 'Normal', 1, 1, now())`)).rejects.toThrow();
  });

  it('runs again without failing when the tables already exist', async () => {
    await expect(new CardPrices1778533601000().up(runner)).resolves.toBeUndefined();
  });

  it('drops both tables when reverted', async () => {
    await new CardPrices1778533601000().down(runner);
    expect(await tableExists('card_price')).toBe(false);
    expect(await tableExists('card_price_group_sync')).toBe(false);
  });
});
