/**
 * DB-backed test for AddImportKindsAndPendingLines1778533608000 (persona-rethink doors 6 and 7: the
 * import kinds, the product key and the lines kept "Para resolver"). Runs in its own schema; every DROP
 * is schema-qualified because `public` is second in the search path and an unqualified DROP would find
 * the real table there.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { AddImportKindsAndPendingLines1778533608000 } from '../1778533608000-AddImportKindsAndPendingLines';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'import_kinds_pending_migration_test';
const USER_ID = '00000000-0000-0000-0000-000000000001';
const SOURCE_ID = '00000000-0000-0000-0000-0000000000a1';

describe('AddImportKindsAndPendingLines1778533608000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function createLegacyTables(): Promise<void> {
    for (const table of ['import_pending_line', 'csv_source', 'user']) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${SCHEMA}"."${table}" CASCADE`);
    }
    await queryRunner.query(`CREATE TABLE "user" (id uuid PRIMARY KEY)`);
    await queryRunner.query(
      `CREATE TABLE "csv_source" (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         "userId" uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
         kind varchar(16) NOT NULL,
         label text,
         CONSTRAINT "CHK_csv_source_kind_valid" CHECK (kind IN ('csv', 'manual'))
       )`,
    );
    await queryRunner.query(`INSERT INTO "user" (id) VALUES ($1)`, [USER_ID]);
    await queryRunner.query(`INSERT INTO "csv_source" (id, "userId", kind, label) VALUES ($1, $2, 'csv', 'colecao.csv')`, [
      SOURCE_ID,
      USER_ID,
    ]);
  }

  async function accepted(attempt: Promise<unknown>): Promise<boolean> {
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

  it('import_pending_line cascades from its import', async () => {
    await new AddImportKindsAndPendingLines1778533608000().up(queryRunner);
    await queryRunner.query(
      `INSERT INTO "import_pending_line" ("sourceId", "userId", "lineNumber", "originalText", reason, "suggestedCardIdentifier")
       VALUES ($1, $2, 23, 'Snatch,2,', 'asks_color', NULL), ($1, $2, 45, 'Enlightend Strike,3,Vermelho', 'suggestion', 'enlightened-strike-red')`,
      [SOURCE_ID, USER_ID],
    );

    await queryRunner.query(`DELETE FROM "csv_source" WHERE id = $1`, [SOURCE_ID]);

    const [{ count }] = await queryRunner.query(`SELECT count(*)::int AS count FROM "import_pending_line"`);
    expect(count).toBe(0);
  });

  it('import_pending_line has the columns of its shape and refuses a line without an import', async () => {
    await new AddImportKindsAndPendingLines1778533608000().up(queryRunner);

    const columns: Array<{ column_name: string; is_nullable: string }> = await queryRunner.query(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'import_pending_line'`,
      [SCHEMA],
    );
    const nullable = Object.fromEntries(columns.map((column) => [column.column_name, column.is_nullable]));

    expect(nullable).toMatchObject({
      sourceId: 'NO',
      userId: 'NO',
      lineNumber: 'NO',
      originalText: 'NO',
      reason: 'NO',
      suggestedCardIdentifier: 'YES',
    });
    const orphan = queryRunner.query(
      `INSERT INTO "import_pending_line" ("sourceId", "userId", "lineNumber", "originalText", reason)
       VALUES ('00000000-0000-0000-0000-0000000000ff', $1, 1, 'x', 'not_found')`,
      [USER_ID],
    );
    expect(await accepted(orphan)).toBe(false);
  });

  it('csv_source gains a nullable productKey', async () => {
    await new AddImportKindsAndPendingLines1778533608000().up(queryRunner);

    const [column] = await queryRunner.query(
      `SELECT data_type, is_nullable FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'csv_source' AND column_name = 'productKey'`,
      [SCHEMA],
    );
    expect(column).toEqual({ data_type: 'character varying', is_nullable: 'YES' });
    const [existing] = await queryRunner.query(`SELECT "productKey" FROM "csv_source" WHERE id = $1`, [SOURCE_ID]);
    expect(existing.productKey).toBeNull();
  });

  it('the kind check accepts the five import kinds and nothing else', async () => {
    await new AddImportKindsAndPendingLines1778533608000().up(queryRunner);
    const insertKind = (kind: string): Promise<unknown> =>
      queryRunner.query(`INSERT INTO "csv_source" ("userId", kind) VALUES ($1, $2)`, [USER_ID, kind]);

    const results = await Promise.all(
      ['csv', 'paste', 'product', 'fabrary', 'manual', 'other'].map(async (kind) => [kind, await accepted(insertKind(kind))] as const),
    );

    expect(Object.fromEntries(results)).toEqual({
      csv: true,
      paste: true,
      product: true,
      fabrary: true,
      manual: true,
      other: false,
    });
  });

  it('runs twice on the same schema without failing', async () => {
    await new AddImportKindsAndPendingLines1778533608000().up(queryRunner);

    await expect(new AddImportKindsAndPendingLines1778533608000().up(queryRunner)).resolves.toBeUndefined();
  });
});
