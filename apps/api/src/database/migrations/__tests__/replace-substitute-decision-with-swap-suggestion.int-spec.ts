/**
 * DB-backed migration test for
 * ReplaceSubstituteDecisionWithSwapSuggestion1778533586000 (D8/SWAP-15).
 *
 * Runs against a real Postgres (DATABASE_URL), isolated in its own schema
 * so it never touches the app's synchronize-managed public schema. Seeds a
 * minimal substitute_decision table (plus the user/tracked_deck tables the
 * new foreign keys reference), runs up(), asserts substitute_decision no
 * longer exists and swap_suggestion exists and is empty (D8 -- discard,
 * not reconstruct; the backfill script is a separate, subsequent step).
 * Runs down() and asserts it recreates the substitute_decision table shape
 * with zero rows -- the assertion is specifically that down() does not
 * error and does not fabricate data, not that it restores the
 * pre-migration state, since restoration is impossible by design.
 *
 * Uses a single dedicated QueryRunner connection for the whole test --
 * `dataSource.query()` against a pooled connection can land on a different
 * physical connection each call, so a `SET search_path` on one call would
 * not reliably apply to the next. A single QueryRunner holds one
 * connection for its entire lifecycle.
 *
 * Not part of the required `pnpm --filter @rathe-arsenal/api test` gate
 * (jest's default testRegex excludes `.int-spec.ts`) -- run explicitly via
 * `pnpm --filter @rathe-arsenal/api test:int`.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { ReplaceSubstituteDecisionWithSwapSuggestion1778533586000 } from '../1778533586000-ReplaceSubstituteDecisionWithSwapSuggestion';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'swap_suggestion_migration_test';

describe('ReplaceSubstituteDecisionWithSwapSuggestion1778533586000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  beforeAll(async () => {
    // `schema` drives TypeORM's own metadata-based operations (the
    // migration's dropIndex/createTable/etc. calls); the explicit
    // `SET search_path` below covers the raw `.query()` calls this file
    // issues directly on the same connection. Both are needed -- TypeORM
    // does not derive the former from the latter.
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      schema: SCHEMA,
      synchronize: false,
    });
    await dataSource.initialize();

    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.query(`CREATE SCHEMA "${SCHEMA}"`);
    // Include `public` in the path too -- `uuid_generate_v4()` (used by
    // TypeORM's uuid-generated primary keys) is installed there by the
    // app's own migrations, and an unqualified function call still needs
    // it resolvable even though table DDL is schema-qualified separately.
    await queryRunner.query(`SET search_path TO "${SCHEMA}", public`);

    // Minimal referenced-table stubs -- only the columns the new foreign
    // keys need.
    await queryRunner.query(`CREATE TABLE "user" (id uuid PRIMARY KEY)`);
    await queryRunner.query(`CREATE TABLE "tracked_deck" (id serial PRIMARY KEY)`);

    // The exact shape 1776621085000 creates -- the precondition up() assumes.
    await queryRunner.query(`
      CREATE TABLE "substitute_decision" (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "trackedDeckId" int NOT NULL,
        "cardIdentifier" varchar(128) NOT NULL,
        decision varchar(32) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_substitute_decision_user_deck_card_unique" ON "substitute_decision" ("userId", "trackedDeckId", "cardIdentifier")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_substitute_decision_deck_decision" ON "substitute_decision" ("trackedDeckId", decision)`,
    );

    const userId = '11111111-1111-1111-1111-111111111111';
    await queryRunner.query(`INSERT INTO "user" (id) VALUES ($1)`, [userId]);
    await queryRunner.query(`INSERT INTO "tracked_deck" (id) VALUES (1)`);
    await queryRunner.query(
      `INSERT INTO "substitute_decision" ("userId", "trackedDeckId", "cardIdentifier", decision) VALUES ($1, 1, 'some-substitute', 'approved')`,
      [userId],
    );
  });

  afterAll(async () => {
    if (queryRunner) {
      await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
      await queryRunner.release();
    }
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('up() drops substitute_decision (with its seeded row) and creates an empty swap_suggestion', async () => {
    const migration = new ReplaceSubstituteDecisionWithSwapSuggestion1778533586000();
    await migration.up(queryRunner);

    const hasOldTable = await queryRunner.hasTable('substitute_decision');
    expect(hasOldTable).toBe(false);

    const hasNewTable = await queryRunner.hasTable('swap_suggestion');
    expect(hasNewTable).toBe(true);

    const rows = await queryRunner.query(`SELECT * FROM "swap_suggestion"`);
    expect(rows).toHaveLength(0);
  });

  it('down() recreates substitute_decision with zero rows, without erroring or fabricating data', async () => {
    const migration = new ReplaceSubstituteDecisionWithSwapSuggestion1778533586000();
    await expect(migration.down(queryRunner)).resolves.not.toThrow();

    const hasOldTableAgain = await queryRunner.hasTable('substitute_decision');
    expect(hasOldTableAgain).toBe(true);

    const rows = await queryRunner.query(`SELECT * FROM "substitute_decision"`);
    // The row seeded in beforeAll was destroyed by up()'s dropTable -- down()
    // cannot and does not restore it (D8, this migration's header comment).
    expect(rows).toHaveLength(0);
  });
});
