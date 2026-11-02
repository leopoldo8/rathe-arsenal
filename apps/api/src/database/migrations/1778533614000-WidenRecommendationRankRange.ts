import { MigrationInterface, QueryRunner } from 'typeorm';

// A run now stores every card the model ranks (25), not only the first 10. Runs stored with
// 10 ranks still satisfy the wider range, so no row is rewritten.
export class WidenRecommendationRankRange1778533614000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "recommendation" DROP CONSTRAINT IF EXISTS "CHK_recommendation_rank_range"`);
    await queryRunner.query(`ALTER TABLE "recommendation" ADD CONSTRAINT "CHK_recommendation_rank_range" CHECK ("rank" BETWEEN 1 AND 25)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "recommendation" WHERE "rank" > 10`);
    await queryRunner.query(`ALTER TABLE "recommendation" DROP CONSTRAINT IF EXISTS "CHK_recommendation_rank_range"`);
    await queryRunner.query(`ALTER TABLE "recommendation" ADD CONSTRAINT "CHK_recommendation_rank_range" CHECK ("rank" BETWEEN 1 AND 10)`);
  }
}
