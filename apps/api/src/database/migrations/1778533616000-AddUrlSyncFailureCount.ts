import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUrlSyncFailureCount1778533616000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "store" ADD COLUMN IF NOT EXISTS "urlSyncFailureCount" int NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "store" DROP COLUMN IF EXISTS "urlSyncFailureCount"`);
  }
}
