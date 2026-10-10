import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecommendationReasonPtBr1778533592000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "recommendation" ADD COLUMN IF NOT EXISTS "reasonPtBr" text NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "recommendation" DROP COLUMN IF EXISTS "reasonPtBr"`);
  }
}
