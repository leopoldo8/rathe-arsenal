import { DataSource, QueryRunner } from 'typeorm';
import { AddCardRecommendations1778533591000 } from '../1778533591000-AddCardRecommendations';
import { AddRecommendationReasonPtBr1778533592000 } from '../1778533592000-AddRecommendationReasonPtBr';
import { RECOMMENDATION_COLUMNS, readRecommendationColumns } from './recommendation-columns';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal_recs';
const SCHEMA = 'card_recommendations_migration_test';

describe('AddCardRecommendations1778533591000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function rejects(sql: string, params: unknown[] = []): Promise<void> {
    await expect(queryRunner.query(sql, params)).rejects.toThrow();
  }

  beforeAll(async () => {
    dataSource = new DataSource({ type: 'postgres', url: DATABASE_URL, schema: SCHEMA, synchronize: false });
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.query(`CREATE SCHEMA "${SCHEMA}"`);
    await queryRunner.query(`SET search_path TO "${SCHEMA}", public`);
    await queryRunner.query(`CREATE TABLE "tracked_deck" (id serial PRIMARY KEY)`);
    await queryRunner.query(`INSERT INTO "tracked_deck" (id) VALUES (1)`);
    await queryRunner.query(
      `CREATE TABLE "card_replacement" (id serial PRIMARY KEY, "pickedFrom" varchar(32) NOT NULL,
        CONSTRAINT "CHK_card_replacement_picked_from_valid"
        CHECK ("pickedFrom" IN ('very_close', 'close', 'other_pitch', 'generic', 'search')))`,
    );
  });

  afterAll(async () => {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.release();
    await dataSource.destroy();
  });

  it('up creates and down drops the recommendation tables', async () => {
    await new AddCardRecommendations1778533591000().up(queryRunner);
    await new AddRecommendationReasonPtBr1778533592000().up(queryRunner);

    for (const table of ['recommendation_run', 'recommendation', 'recommendation_dismissal']) {
      expect({ table, exists: await queryRunner.hasTable(table) }).toEqual({ table, exists: true });
    }
    expect(await readRecommendationColumns(queryRunner, SCHEMA)).toEqual(RECOMMENDATION_COLUMNS);
    const indexes: Array<{ indexname: string; indexdef: string }> = await queryRunner.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname LIKE 'IDX_recommendation%' ORDER BY indexname`,
      [SCHEMA],
    );
    const byName = Object.fromEntries(indexes.map((row) => [row.indexname, row.indexdef]));
    expect(Object.keys(byName)).toEqual([
      'IDX_recommendation_dismissal_deck_card',
      'IDX_recommendation_run_deck_status',
      'IDX_recommendation_run_one_pending',
      'IDX_recommendation_run_one_running',
      'IDX_recommendation_run_rank',
      'IDX_recommendation_run_status_run_after',
    ]);
    expect(byName['IDX_recommendation_run_one_pending']).toMatch(/UNIQUE .*\("trackedDeckId"\) WHERE \(\(?status\)?::text = 'pending'/);
    expect(byName['IDX_recommendation_run_one_running']).toMatch(/UNIQUE .*\("trackedDeckId"\) WHERE \(\(?status\)?::text = 'running'/);
    expect(byName['IDX_recommendation_run_rank']).toMatch(/UNIQUE .*\("runId", rank\)/);
    expect(byName['IDX_recommendation_dismissal_deck_card']).toMatch(/UNIQUE .*\("trackedDeckId", "cardIdentifier"\)/);

    const insertRun = `INSERT INTO recommendation_run ("trackedDeckId", "trigger", "status", "runAfter") VALUES (1, $1, $2, now()) RETURNING id`;
    await rejects(insertRun, ['soon', 'pending']);
    await rejects(insertRun, ['auto', 'queued']);
    const [{ id: runId }] = await queryRunner.query(insertRun, ['auto', 'done']);
    const insertRecommendation = `INSERT INTO recommendation ("runId", "cardIdentifier", rank, strength, reason) VALUES ($1, 'c', $2, $3, 'r')`;
    await rejects(insertRecommendation, [runId, 0, 'consider']);
    await rejects(insertRecommendation, [runId, 11, 'consider']);
    await rejects(insertRecommendation, [runId, 1, 'great']);
    await queryRunner.query(`INSERT INTO "card_replacement" ("pickedFrom") VALUES ('recommendation')`);
    await rejects(`INSERT INTO "card_replacement" ("pickedFrom") VALUES ('synergy')`);

    await queryRunner.query(`DELETE FROM "card_replacement"`);
    await new AddRecommendationReasonPtBr1778533592000().down(queryRunner);
    expect(await readRecommendationColumns(queryRunner, SCHEMA)).toEqual(
      expect.objectContaining({ recommendation: expect.not.objectContaining({ reasonPtBr: expect.anything() }) }),
    );
    await new AddCardRecommendations1778533591000().down(queryRunner);

    for (const table of ['recommendation_run', 'recommendation', 'recommendation_dismissal']) {
      expect({ table, exists: await queryRunner.hasTable(table) }).toEqual({ table, exists: false });
    }
    await rejects(`INSERT INTO "card_replacement" ("pickedFrom") VALUES ('recommendation')`);
    await queryRunner.query(`INSERT INTO "card_replacement" ("pickedFrom") VALUES ('search')`);
  });
});
