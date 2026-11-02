import { DataSource, QueryRunner } from 'typeorm';
import { AddCardRecommendations1778533591000 } from '../1778533591000-AddCardRecommendations';
import { WidenRecommendationRankRange1778533614000 } from '../1778533614000-WidenRecommendationRankRange';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal_recs';
const SCHEMA = 'widen_recommendation_rank_range_migration_test';

describe('WidenRecommendationRankRange1778533614000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  const insertRecommendation = (runId: string, rank: number): Promise<unknown> =>
    queryRunner.query(
      `INSERT INTO recommendation ("runId", "cardIdentifier", rank, strength, reason) VALUES ($1, $2, $3, 'consider', 'r')`,
      [runId, `card-${rank}`, rank],
    );

  async function insertRun(): Promise<string> {
    const [{ id }] = await queryRunner.query(
      `INSERT INTO recommendation_run ("trackedDeckId", "trigger", "status", "runAfter") VALUES (1, 'auto', 'done', now()) RETURNING id`,
    );
    return id as string;
  }

  async function ranksOf(runId: string): Promise<number[]> {
    const rows: Array<{ rank: number }> = await queryRunner.query(`SELECT rank FROM recommendation WHERE "runId" = $1 ORDER BY rank`, [runId]);
    return rows.map((row) => row.rank);
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
    await new AddCardRecommendations1778533591000().up(queryRunner);
  });

  afterAll(async () => {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.release();
    await dataSource.destroy();
  });

  it('up keeps runs stored with 10 ranks and allows ranks 1 to 25; down trims back to 10', async () => {
    const oldRun = await insertRun();
    for (let rank = 1; rank <= 10; rank += 1) await insertRecommendation(oldRun, rank);

    await new WidenRecommendationRankRange1778533614000().up(queryRunner);

    expect(await ranksOf(oldRun)).toEqual(Array.from({ length: 10 }, (_, index) => index + 1));
    const newRun = await insertRun();
    for (let rank = 1; rank <= 25; rank += 1) await insertRecommendation(newRun, rank);
    await expect(insertRecommendation(newRun, 0)).rejects.toThrow(/CHK_recommendation_rank_range/);
    await expect(insertRecommendation(newRun, 26)).rejects.toThrow(/CHK_recommendation_rank_range/);

    await new WidenRecommendationRankRange1778533614000().down(queryRunner);

    expect(await ranksOf(oldRun)).toHaveLength(10);
    expect(await ranksOf(newRun)).toEqual(Array.from({ length: 10 }, (_, index) => index + 1));
    await expect(insertRecommendation(newRun, 11)).rejects.toThrow(/CHK_recommendation_rank_range/);
  });
});
