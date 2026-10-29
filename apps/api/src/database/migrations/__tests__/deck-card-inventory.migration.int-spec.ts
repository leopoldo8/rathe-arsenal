/**
 * DB-backed test for AddDeckCardInventory1778533605000 (persona-rethink door 3: the inventory
 * quantity of a deck line). Runs in its own schema so it never touches the synchronize-managed
 * public schema; one QueryRunner holds a single connection so `SET search_path` applies to every
 * statement.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { AddDeckCardInventory1778533605000 } from '../1778533605000-AddDeckCardInventory';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'deck_card_inventory_migration_test';

describe('AddDeckCardInventory1778533605000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function insertRow(quantity: number, inventoryQuantity: number): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "deck_card" ("trackedDeckId", "cardIdentifier", quantity, slot, "inventoryQuantity")
       VALUES (1, 'pack-hunt-red', $1, 'mainboard', $2)`,
      [quantity, inventoryQuantity],
    );
  }

  async function rowCount(): Promise<number> {
    const [{ count }] = (await queryRunner.query(`SELECT count(*)::int AS count FROM "deck_card"`)) as [
      { count: number },
    ];
    return count;
  }

  async function createLegacyTable(): Promise<void> {
    // Qualified: with `public` second in the search path, an unqualified DROP would find the real
    // table there on the first call and delete the data of the shared database.
    await queryRunner.query(`DROP TABLE IF EXISTS "${SCHEMA}"."deck_card"`);
    await queryRunner.query(
      `CREATE TABLE "deck_card" (
         id serial PRIMARY KEY,
         "trackedDeckId" int NOT NULL,
         "cardIdentifier" varchar NOT NULL,
         quantity int NOT NULL,
         slot varchar NOT NULL
       )`,
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

  it('adds inventoryQuantity with its check', async () => {
    await queryRunner.query(
      `INSERT INTO "deck_card" ("trackedDeckId", "cardIdentifier", quantity, slot) VALUES (1, 'snatch-red', 3, 'mainboard'), (1, 'rhinar', 1, 'hero')`,
    );

    await new AddDeckCardInventory1778533605000().up(queryRunner);

    const columns: Array<{ data_type: string; is_nullable: string; column_default: string | null }> =
      await queryRunner.query(
        `SELECT data_type, is_nullable, column_default FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'deck_card' AND column_name = 'inventoryQuantity'`,
        [SCHEMA],
      );
    expect(columns).toHaveLength(1);
    expect(columns[0]!.data_type).toBe('integer');
    expect(columns[0]!.is_nullable).toBe('NO');
    expect(columns[0]!.column_default).toBe('0');

    const existing: Array<{ inventoryQuantity: number }> = await queryRunner.query(
      `SELECT "inventoryQuantity" FROM "deck_card" ORDER BY id`,
    );
    expect(existing.map((row) => row.inventoryQuantity)).toEqual([0, 0]);

    const checks: Array<{ definition: string }> = await queryRunner.query(
      `SELECT pg_get_constraintdef(c.oid) AS definition
       FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = $1 AND t.relname = 'deck_card' AND c.contype = 'c'`,
      [SCHEMA],
    );
    expect(checks).toHaveLength(1);
    const definition = checks[0]!.definition.replace(/[()\s]/g, '');
    expect(definition).toContain('quantity>=0');
    expect(definition).toContain('"inventoryQuantity">=0');
    expect(definition).toContain('quantity+"inventoryQuantity">0');
  });

  it('the deck_card check accepts and rejects', async () => {
    await new AddDeckCardInventory1778533605000().up(queryRunner);

    const rows: ReadonlyArray<{ quantity: number; inventory: number; accepted: boolean }> = [
      { quantity: -1, inventory: 0, accepted: false },
      { quantity: 0, inventory: -1, accepted: false },
      { quantity: 0, inventory: 0, accepted: false },
      { quantity: 0, inventory: 1, accepted: true },
      { quantity: 1, inventory: 0, accepted: true },
      { quantity: 3, inventory: 2, accepted: true },
    ];

    for (const { quantity, inventory, accepted } of rows) {
      const before = await rowCount();
      const attempt = insertRow(quantity, inventory);
      if (accepted) {
        await attempt;
        expect({ quantity, inventory, rows: await rowCount() }).toEqual({ quantity, inventory, rows: before + 1 });
      } else {
        await expect(attempt).rejects.toThrow();
        expect({ quantity, inventory, rows: await rowCount() }).toEqual({ quantity, inventory, rows: before });
      }
    }
  });

  it('runs again over a table that synchronize already extended', async () => {
    await new AddDeckCardInventory1778533605000().up(queryRunner);
    await insertRow(0, 2);

    await new AddDeckCardInventory1778533605000().up(queryRunner);

    expect(await rowCount()).toBe(1);
    await expect(insertRow(0, 0)).rejects.toThrow();
  });

  it('removes the column and the check on the way down', async () => {
    await new AddDeckCardInventory1778533605000().up(queryRunner);

    await new AddDeckCardInventory1778533605000().down(queryRunner);

    const columns: Array<{ column_name: string }> = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'deck_card'`,
      [SCHEMA],
    );
    expect(columns.map((column) => column.column_name)).not.toContain('inventoryQuantity');
  });
});
