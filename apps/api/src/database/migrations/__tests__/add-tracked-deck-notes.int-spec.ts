/**
 * DB-backed test for AddTrackedDeckNotes1778533587000 (EDIT-02).
 *
 * Runs in its own schema so it never touches the synchronize-managed public
 * schema. One QueryRunner holds a single connection so `SET search_path`
 * applies to every statement.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { AddTrackedDeckNotes1778533587000 } from '../1778533587000-AddTrackedDeckNotes';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'tracked_deck_notes_migration_test';

describe('AddTrackedDeckNotes1778533587000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function notesColumn(): Promise<{ data_type: string; is_nullable: string }[]> {
    return queryRunner.query(
      `SELECT data_type, is_nullable FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'tracked_deck' AND column_name = 'notes'`,
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
    await queryRunner.query(`CREATE TABLE "tracked_deck" (id serial PRIMARY KEY, name varchar NOT NULL)`);
    await queryRunner.query(`INSERT INTO "tracked_deck" (name) VALUES ('existing deck')`);
  });

  afterAll(async () => {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.release();
    await dataSource.destroy();
  });

  it('up() adds a nullable text column and leaves existing rows NULL', async () => {
    await new AddTrackedDeckNotes1778533587000().up(queryRunner);

    expect(await notesColumn()).toEqual([{ data_type: 'text', is_nullable: 'YES' }]);
    const rows = await queryRunner.query(`SELECT notes FROM "tracked_deck"`);
    expect(rows).toEqual([{ notes: null }]);
  });

  it('down() removes the column and keeps the rows', async () => {
    await new AddTrackedDeckNotes1778533587000().down(queryRunner);

    expect(await notesColumn()).toEqual([]);
    const rows = await queryRunner.query(`SELECT name FROM "tracked_deck"`);
    expect(rows).toEqual([{ name: 'existing deck' }]);
  });
});
