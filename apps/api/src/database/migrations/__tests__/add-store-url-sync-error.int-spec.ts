import { DataSource, QueryRunner } from 'typeorm';
import { AddStoreUrlSyncError1778533589000 } from '../1778533589000-AddStoreUrlSyncError';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'store_url_sync_error_migration_test';

describe('AddStoreUrlSyncError1778533589000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function errorColumns(): Promise<{ column_name: string; data_type: string; is_nullable: string }[]> {
    return queryRunner.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'store' AND column_name LIKE 'lastUrlSyncError%'
       ORDER BY column_name`,
      [SCHEMA],
    );
  }

  beforeAll(async () => {
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
    await queryRunner.query(`SET search_path TO "${SCHEMA}", public`);
    await queryRunner.query(`CREATE TABLE "store" (id serial PRIMARY KEY, slug varchar NOT NULL)`);
    await queryRunner.query(`INSERT INTO "store" (slug) VALUES ('cupula-dt')`);
  });

  afterAll(async () => {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.release();
    await dataSource.destroy();
  });

  it('up() adds nullable error message and timestamp columns, leaving existing stores NULL', async () => {
    await new AddStoreUrlSyncError1778533589000().up(queryRunner);

    expect(await errorColumns()).toEqual([
      { column_name: 'lastUrlSyncError', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'lastUrlSyncErrorAt', data_type: 'timestamp with time zone', is_nullable: 'YES' },
    ]);
    const rows = await queryRunner.query(`SELECT "lastUrlSyncError", "lastUrlSyncErrorAt" FROM "store"`);
    expect(rows).toEqual([{ lastUrlSyncError: null, lastUrlSyncErrorAt: null }]);
  });

  it('down() removes both columns and keeps the stores', async () => {
    await new AddStoreUrlSyncError1778533589000().down(queryRunner);

    expect(await errorColumns()).toEqual([]);
    const rows = await queryRunner.query(`SELECT slug FROM "store"`);
    expect(rows).toEqual([{ slug: 'cupula-dt' }]);
  });
});
