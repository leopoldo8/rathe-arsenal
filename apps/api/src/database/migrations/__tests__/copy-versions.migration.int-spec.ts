/**
 * DB-backed test for AddCopyVersions1778533607000 (persona-rethink door 1: the version of a copy).
 * Runs in its own schema so it never touches the synchronize-managed public schema; every DROP is
 * schema-qualified because `public` is second in the search path and an unqualified DROP would find
 * the real table there.
 */
import { Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AddCopyVersions1778533607000 } from '../1778533607000-AddCopyVersions';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'copy_versions_migration_test';
const USER_ID = '00000000-0000-0000-0000-000000000001';
const SOURCE_ID = '00000000-0000-0000-0000-0000000000a1';
const SECOND_SOURCE_ID = '00000000-0000-0000-0000-0000000000a2';
const VERSION_COLUMNS = ['printingCode', 'edition', 'finish', 'condition'];

describe('AddCopyVersions1778533607000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function createLegacyTables(): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "${SCHEMA}"."collection_card"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "${SCHEMA}"."card_list_line"`);
    await queryRunner.query(
      `CREATE TABLE "collection_card" (
         id serial PRIMARY KEY,
         "userId" uuid NOT NULL,
         "cardIdentifier" varchar NOT NULL,
         "sourceId" uuid NOT NULL,
         quantity int NOT NULL,
         "lastUpdated" timestamptz NOT NULL DEFAULT now()
       )`,
    );
    // The name synchronize gave the three-column index in the owner's database.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c905a94cf5ba60238c0cccaa76" ON "collection_card" ("userId", "cardIdentifier", "sourceId")`,
    );
    await queryRunner.query(
      `CREATE TABLE "card_list_line" (
         id serial PRIMARY KEY,
         "listId" int NOT NULL,
         "cardIdentifier" varchar NOT NULL,
         quantity int NOT NULL,
         printing varchar,
         condition varchar(4),
         "priceCents" int,
         "soldAt" timestamptz,
         "createdAt" timestamptz NOT NULL DEFAULT now(),
         CONSTRAINT "CHK_card_list_line_condition_valid" CHECK ("condition" IN ('NM', 'LP', 'MP', 'HP', 'DMG'))
       )`,
    );
  }

  async function insertCopy(
    cardIdentifier: string,
    columns: Record<string, string> = {},
    sourceId: string = SOURCE_ID,
  ): Promise<void> {
    const names = ['userId', 'cardIdentifier', 'sourceId', 'quantity', ...Object.keys(columns)];
    const values = [USER_ID, cardIdentifier, sourceId, 1, ...Object.values(columns)];
    await queryRunner.query(
      `INSERT INTO "collection_card" (${names.map((name) => `"${name}"`).join(', ')})
       VALUES (${values.map((_value, index) => `$${index + 1}`).join(', ')})`,
      values,
    );
  }

  async function insertLine(columns: Record<string, string | null> = {}): Promise<number> {
    const names = ['listId', 'cardIdentifier', 'quantity', ...Object.keys(columns)];
    const values = [1, 'snatch-red', 1, ...Object.values(columns)];
    const [row] = (await queryRunner.query(
      `INSERT INTO "card_list_line" (${names.map((name) => `"${name}"`).join(', ')})
       VALUES (${values.map((_value, index) => `$${index + 1}`).join(', ')}) RETURNING id`,
      values,
    )) as [{ id: number }];
    return row.id;
  }

  async function accepted(attempt: Promise<unknown>): Promise<boolean> {
    // A failed statement aborts the transaction state of nothing here: no transaction is open.
    return attempt.then(
      () => true,
      () => false,
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
    await createLegacyTables();
  });

  it('adds the four version columns with the empty default on both tables', async () => {
    await insertCopy('snatch-red');
    await insertLine();

    await new AddCopyVersions1778533607000().up(queryRunner);

    for (const table of ['collection_card', 'card_list_line']) {
      const columns: Array<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }> =
        await queryRunner.query(
          `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = $2 AND column_name = ANY($3)`,
          [SCHEMA, table, VERSION_COLUMNS],
        );
      expect(columns.map((column) => column.column_name).sort()).toEqual([...VERSION_COLUMNS].sort());
      for (const column of columns) {
        expect({ table, column: column.column_name, type: column.data_type, nullable: column.is_nullable }).toEqual({
          table,
          column: column.column_name,
          type: 'character varying',
          nullable: 'NO',
        });
        expect(column.column_default).toBe("''::character varying");
      }
    }
    const [copy] = await queryRunner.query(
      `SELECT "printingCode", edition, finish, condition FROM "collection_card"`,
    );
    const [line] = await queryRunner.query(
      `SELECT "printingCode", edition, finish, condition FROM "card_list_line"`,
    );
    expect(copy).toEqual({ printingCode: '', edition: '', finish: '', condition: '' });
    expect(line).toEqual({ printingCode: '', edition: '', finish: '', condition: '' });
  });

  it('the version check constraints accept exactly their vocabulary', async () => {
    await new AddCopyVersions1778533607000().up(queryRunner);
    const cases: ReadonlyArray<readonly [string, string, boolean]> = [
      ...['none', 'rainbow', 'cold', 'gold', ''].map((value) => ['finish', value, true] as const),
      ['finish', 'foil', false],
      ...['', 'first', 'unlimited', 'alpha'].map((value) => ['edition', value, true] as const),
      ['edition', 'second', false],
      ...['', 'NM', 'LP', 'MP', 'HP', 'DMG'].map((value) => ['condition', value, true] as const),
      ['condition', 'nm', false],
    ];

    for (const [column, value, expected] of cases) {
      const onCopy = await accepted(insertCopy(`card-${column}-${value || 'empty'}`, { [column]: value }));
      const onLine = await accepted(insertLine({ [column]: value }));
      expect({ table: 'collection_card', column, value, accepted: onCopy }).toEqual({
        table: 'collection_card',
        column,
        value,
        accepted: expected,
      });
      expect({ table: 'card_list_line', column, value, accepted: onLine }).toEqual({
        table: 'card_list_line',
        column,
        value,
        accepted: expected,
      });
    }
  });

  it('collection_card is unique on the seven columns', async () => {
    await insertCopy('snatch-red');
    await new AddCopyVersions1778533607000().up(queryRunner);

    const unique: Array<{ columns: string[] }> = await queryRunner.query(
      `SELECT array_agg(a.attname::text ORDER BY k.ord) AS columns
       FROM pg_index i
       JOIN pg_class t ON t.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
       WHERE n.nspname = $1 AND t.relname = 'collection_card' AND i.indisunique AND NOT i.indisprimary
       GROUP BY i.indexrelid`,
      [SCHEMA],
    );
    expect(unique).toHaveLength(1);
    expect(unique[0]!.columns).toEqual([
      'userId',
      'cardIdentifier',
      'sourceId',
      'printingCode',
      'edition',
      'finish',
      'condition',
    ]);

    await insertCopy('snatch-red', { finish: 'none' });
    expect(await accepted(insertCopy('snatch-red'))).toBe(false);
    expect(await accepted(insertCopy('snatch-red', { finish: 'none' }))).toBe(false);
    expect(await accepted(insertCopy('snatch-red', { finish: 'none' }, SECOND_SOURCE_ID))).toBe(true);
  });

  it('runs again over a schema that synchronize already extended', async () => {
    await new AddCopyVersions1778533607000().up(queryRunner);
    await insertCopy('snatch-red', { finish: 'rainbow' });

    await new AddCopyVersions1778533607000().up(queryRunner);

    const [{ count }] = await queryRunner.query(`SELECT count(*)::int AS count FROM "collection_card"`);
    expect(count).toBe(1);
  });

  it('splits the sell-line printing key and keeps an unreadable collector code', async () => {
    const spelledOut = await insertLine({ printing: 'WTR167.unlimited.rainbow', condition: 'LP' });
    const coded = await insertLine({ printing: 'WTR167.AE.RF' });
    const codeOnly = await insertLine({ printing: '1HP371' });
    const unreadable = await insertLine({ printing: 'ASR013.zz.qq' });
    const none = await insertLine({ printing: null });
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await new AddCopyVersions1778533607000().up(queryRunner);

    const rows: Array<{ id: number; printingCode: string; edition: string; finish: string; condition: string }> =
      await queryRunner.query(`SELECT id, "printingCode", edition, finish, condition FROM "card_list_line" ORDER BY id`);
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(spelledOut)).toEqual({ id: spelledOut, printingCode: 'WTR167', edition: 'unlimited', finish: 'rainbow', condition: 'LP' });
    expect(byId.get(coded)).toEqual({ id: coded, printingCode: 'WTR167', edition: 'alpha', finish: 'rainbow', condition: '' });
    expect(byId.get(codeOnly)).toEqual({ id: codeOnly, printingCode: '1HP371', edition: '', finish: '', condition: '' });
    expect(byId.get(unreadable)).toEqual({ id: unreadable, printingCode: 'ASR013', edition: '', finish: '', condition: '' });
    expect(byId.get(none)).toEqual({ id: none, printingCode: '', edition: '', finish: '', condition: '' });
    const logged = warn.mock.calls.map((call) => String(call[0]));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain(`line ${unreadable}`);
    warn.mockRestore();
  });
});
