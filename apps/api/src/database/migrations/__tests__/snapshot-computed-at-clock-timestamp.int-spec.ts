import { DataSource, QueryRunner } from 'typeorm';
import { SnapshotComputedAtClockTimestamp1778533588000 } from '../1778533588000-SnapshotComputedAtClockTimestamp';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'snapshot_computed_at_migration_test';

describe('SnapshotComputedAtClockTimestamp1778533588000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function insertTwiceInOneTransaction(): Promise<Date[]> {
    await queryRunner.query('BEGIN');
    await queryRunner.query(`INSERT INTO "deck_readiness_snapshot" ("trackedDeckId") VALUES (1)`);
    await queryRunner.query('SELECT pg_sleep(0.05)');
    await queryRunner.query(`INSERT INTO "deck_readiness_snapshot" ("trackedDeckId") VALUES (1)`);
    const rows: { computedAt: Date }[] = await queryRunner.query(
      `SELECT "computedAt" FROM "deck_readiness_snapshot" ORDER BY id`,
    );
    await queryRunner.query('ROLLBACK');
    return rows.map((row) => row.computedAt);
  }

  beforeAll(async () => {
    dataSource = new DataSource({ type: 'postgres', url: DATABASE_URL, schema: SCHEMA, synchronize: false });
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.query(`CREATE SCHEMA "${SCHEMA}"`);
    await queryRunner.query(`SET search_path TO "${SCHEMA}", public`);
    await queryRunner.query(
      `CREATE TABLE "deck_readiness_snapshot" (id serial PRIMARY KEY, "trackedDeckId" int NOT NULL, "computedAt" timestamptz NOT NULL DEFAULT now())`,
    );
  });

  afterAll(async () => {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.release();
    await dataSource.destroy();
  });

  it('before up(), two snapshots written in one transaction share the transaction start time', async () => {
    const [first, second] = await insertTwiceInOneTransaction();

    expect(second?.getTime()).toBe(first?.getTime());
  });

  it('after up(), a later insert in the same transaction gets a later computedAt', async () => {
    await new SnapshotComputedAtClockTimestamp1778533588000().up(queryRunner);

    const [first, second] = await insertTwiceInOneTransaction();

    expect(second!.getTime()).toBeGreaterThan(first!.getTime());
  });

  it('down() restores the transaction-start default', async () => {
    await new SnapshotComputedAtClockTimestamp1778533588000().down(queryRunner);

    const [first, second] = await insertTwiceInOneTransaction();

    expect(second?.getTime()).toBe(first?.getTime());
  });
});
