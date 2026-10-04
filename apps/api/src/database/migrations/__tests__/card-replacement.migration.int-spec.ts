/**
 * DB-backed test for AddCardReplacement1778533590000 (card-alternatives
 * Landing doors 1-4). Runs in its own schema so it never touches the
 * synchronize-managed public schema; one QueryRunner holds a single connection
 * so `SET search_path` applies to every statement.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { AddCardReplacement1778533590000 } from '../1778533590000-AddCardReplacement';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'card_replacement_migration_test';
const USER_ID = '22222222-2222-2222-2222-222222222222';

describe('AddCardReplacement1778533590000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function insertReplacement(overrides: Record<string, unknown> = {}): Promise<void> {
    const row = {
      userId: USER_ID,
      trackedDeckId: 1,
      slot: 'mainboard',
      originalCardIdentifier: 'emissary-of-tides-red',
      replacementCardIdentifier: 'coax-a-commotion-red',
      quantity: 2,
      pickedFrom: 'very_close',
      status: 'active',
      ...overrides,
    };
    await queryRunner.query(
      `INSERT INTO "card_replacement"
         ("userId", "trackedDeckId", slot, "originalCardIdentifier", "replacementCardIdentifier", quantity, "pickedFrom", status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        row.userId,
        row.trackedDeckId,
        row.slot,
        row.originalCardIdentifier,
        row.replacementCardIdentifier,
        row.quantity,
        row.pickedFrom,
        row.status,
      ],
    );
  }

  async function replacementCount(): Promise<number> {
    const [{ count }] = (await queryRunner.query(`SELECT count(*)::int AS count FROM "card_replacement"`)) as [
      { count: number },
    ];
    return count;
  }

  beforeAll(async () => {
    dataSource = new DataSource({ type: 'postgres', url: DATABASE_URL, schema: SCHEMA, synchronize: false });
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.query(`CREATE SCHEMA "${SCHEMA}"`);
    await queryRunner.query(`SET search_path TO "${SCHEMA}", public`);
    await queryRunner.query(`CREATE TABLE "user" (id uuid PRIMARY KEY)`);
    await queryRunner.query(`CREATE TABLE "tracked_deck" (id serial PRIMARY KEY)`);
    await queryRunner.query(`INSERT INTO "user" (id) VALUES ($1)`, [USER_ID]);
    await queryRunner.query(`INSERT INTO "tracked_deck" (id) VALUES (1)`);
  });

  afterAll(async () => {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.release();
    await dataSource.destroy();
  });

  it("enforces the table's constraints", async () => {
    await new AddCardReplacement1778533590000().up(queryRunner);

    expect(await queryRunner.hasTable('card_replacement')).toBe(true);

    const rejected: ReadonlyArray<[string, Record<string, unknown>]> = [
      ['status open', { status: 'open' }],
      ['pickedFrom other', { pickedFrom: 'other' }],
      ['quantity 0', { quantity: 0 }],
      ['a 129-character originalCardIdentifier', { originalCardIdentifier: 'x'.repeat(129) }],
      ['a 65-character slot', { slot: 's'.repeat(65) }],
    ];
    for (const [label, overrides] of rejected) {
      await expect(insertReplacement(overrides)).rejects.toThrow();
      expect({ label, rows: await replacementCount() }).toEqual({ label, rows: 0 });
    }

    await insertReplacement({ originalCardIdentifier: 'x'.repeat(128), slot: 's'.repeat(64) });
    expect(await replacementCount()).toBe(1);

    await queryRunner.query(`DELETE FROM "tracked_deck" WHERE id = 1`);
    expect(await replacementCount()).toBe(0);
  });

  it('cascades when the user is deleted', async () => {
    await queryRunner.query(`INSERT INTO "tracked_deck" (id) VALUES (2)`);
    await insertReplacement({ trackedDeckId: 2 });
    expect(await replacementCount()).toBe(1);

    await queryRunner.query(`DELETE FROM "user" WHERE id = $1`, [USER_ID]);

    expect(await replacementCount()).toBe(0);
  });

  it('rebuilds an empty table that synchronize created first, and refuses one holding rows', async () => {
    await queryRunner.query(`DROP TABLE "card_replacement"`);
    await queryRunner.query(`CREATE TABLE "card_replacement" (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status varchar(32) NOT NULL)`);

    await new AddCardReplacement1778533590000().up(queryRunner);
    await expect(insertReplacement({ status: 'open' })).rejects.toThrow();

    await queryRunner.query(`INSERT INTO "user" (id) VALUES ($1)`, [USER_ID]);
    await queryRunner.query(`INSERT INTO "tracked_deck" (id) VALUES (3)`);
    await insertReplacement({ trackedDeckId: 3 });
    await expect(new AddCardReplacement1778533590000().up(queryRunner)).rejects.toThrow(/holds 1 row/);
  });

  it('down() drops the table', async () => {
    await new AddCardReplacement1778533590000().down(queryRunner);

    expect(await queryRunner.hasTable('card_replacement')).toBe(false);
  });
});
