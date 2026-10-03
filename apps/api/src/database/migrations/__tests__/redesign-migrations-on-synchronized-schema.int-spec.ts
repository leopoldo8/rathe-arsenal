import { DataSource, QueryRunner } from 'typeorm';
import { ReplaceSubstituteDecisionWithSwapSuggestion1778533586000 } from '../1778533586000-ReplaceSubstituteDecisionWithSwapSuggestion';
import { AddTrackedDeckNotes1778533587000 } from '../1778533587000-AddTrackedDeckNotes';
import { SnapshotComputedAtClockTimestamp1778533588000 } from '../1778533588000-SnapshotComputedAtClockTimestamp';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'redesign_migrations_synced_test';

// Staging's database was also written by a service running with TypeORM
// `synchronize`, which renames indexes and creates new entity tables ahead of
// the migrations. These migrations must apply cleanly on top of that state.
describe('redesign migrations on a schema synchronize already touched', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function constraintNames(table: string): Promise<string[]> {
    const rows: { conname: string }[] = await queryRunner.query(
      `SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = $1 AND t.relname = $2`,
      [SCHEMA, table],
    );
    return rows.map((row) => row.conname).sort();
  }

  async function seedSynchronizedState(): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.query(`CREATE SCHEMA "${SCHEMA}"`);
    await queryRunner.query(`SET search_path TO "${SCHEMA}", public`);
    await queryRunner.query(`CREATE TABLE "user" (id uuid PRIMARY KEY)`);
    await queryRunner.query(`CREATE TABLE "tracked_deck" (id serial PRIMARY KEY, name varchar NOT NULL DEFAULT 'd', "notes" text)`);
    await queryRunner.query(
      `CREATE TABLE "deck_readiness_snapshot" (id serial PRIMARY KEY, "computedAt" timestamptz NOT NULL DEFAULT clock_timestamp())`,
    );
    await queryRunner.query(`
      CREATE TABLE "substitute_decision" (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL, "trackedDeckId" int NOT NULL,
        "cardIdentifier" varchar(128) NOT NULL, decision varchar(32) NOT NULL
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_4073d0e2422b6aefbcb8ab2a32" ON "substitute_decision" ("trackedDeckId", decision)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4ff9a2c9dc7643068df0010513" ON "substitute_decision" ("userId", "trackedDeckId", "cardIdentifier")`,
    );
    await queryRunner.query(`CREATE TABLE "swap_suggestion" (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status varchar(32) NOT NULL)`);
  }

  beforeAll(async () => {
    dataSource = new DataSource({ type: 'postgres', url: DATABASE_URL, schema: SCHEMA, synchronize: false });
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
  });

  afterAll(async () => {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.release();
    await dataSource.destroy();
  });

  it('replaces substitute_decision even when its indexes carry synchronize-generated names', async () => {
    await seedSynchronizedState();

    await new ReplaceSubstituteDecisionWithSwapSuggestion1778533586000().up(queryRunner);

    expect(await queryRunner.hasTable(`${SCHEMA}.substitute_decision`)).toBe(false);
  });

  it('rebuilds an empty synchronize-created swap_suggestion with the migration-owned constraints', async () => {
    expect(await constraintNames('swap_suggestion')).toEqual(
      expect.arrayContaining([
        'CHK_swap_suggestion_outcome_valid',
        'CHK_swap_suggestion_rejection_reason_valid',
        'CHK_swap_suggestion_status_valid',
      ]),
    );
    const columns: { column_name: string }[] = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'swap_suggestion'`,
      [SCHEMA],
    );
    expect(columns.map((c) => c.column_name)).toEqual(expect.arrayContaining(['substituteIdentifier', 'slot', 'quantity']));
  });

  it('refuses to drop a pre-existing swap_suggestion that already holds rows', async () => {
    await seedSynchronizedState();
    await queryRunner.query(`INSERT INTO "swap_suggestion" (status) VALUES ('pending')`);

    await expect(new ReplaceSubstituteDecisionWithSwapSuggestion1778533586000().up(queryRunner)).rejects.toThrow(
      /swap_suggestion already holds 1 row/,
    );
  });

  it('adds the notes column only when synchronize has not already added it', async () => {
    await seedSynchronizedState();

    await new AddTrackedDeckNotes1778533587000().up(queryRunner);
    await new AddTrackedDeckNotes1778533587000().up(queryRunner);

    const columns: { column_name: string }[] = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'tracked_deck' AND column_name = 'notes'`,
      [SCHEMA],
    );
    expect(columns).toHaveLength(1);
  });

  it('sets the clock_timestamp default even when it is already set', async () => {
    await expect(new SnapshotComputedAtClockTimestamp1778533588000().up(queryRunner)).resolves.toBeUndefined();
  });
});
