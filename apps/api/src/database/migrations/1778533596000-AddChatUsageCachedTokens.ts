import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatUsageCachedTokens1778533596000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chat_usage" ADD COLUMN "cachedInputTokens" int NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chat_usage" DROP COLUMN "cachedInputTokens"`);
  }
}
