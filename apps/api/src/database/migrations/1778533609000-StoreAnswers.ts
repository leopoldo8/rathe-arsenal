import { MigrationInterface, QueryRunner } from 'typeorm';

const PENDING_INDEX = 'IDX_variant_fetch_job_pending_card';

export class StoreAnswers1778533609000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "store_stock" ADD COLUMN IF NOT EXISTS "listedInStockAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "store" ADD COLUMN IF NOT EXISTS "lastAvailabilityPassAt" timestamptz`);
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "firecrawl_usage" ("month" char(7) PRIMARY KEY, "credits" int NOT NULL)`,
    );

    if (await queryRunner.hasColumn('variant_fetch_job', 'deckId')) {
      await queryRunner.query(`DELETE FROM "variant_fetch_job"`);
    }
    await queryRunner.query(`ALTER TABLE "variant_fetch_job" DROP COLUMN IF EXISTS "userId"`);
    await queryRunner.query(`ALTER TABLE "variant_fetch_job" DROP COLUMN IF EXISTS "deckId"`);
    await queryRunner.query(`ALTER TABLE "variant_fetch_job" ADD COLUMN IF NOT EXISTS "cardIdentifier" varchar(150) NOT NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "${PENDING_INDEX}" ON "variant_fetch_job" ("cardIdentifier") WHERE status = 'pending'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "${PENDING_INDEX}"`);
    await queryRunner.query(`DELETE FROM "variant_fetch_job"`);
    await queryRunner.query(`ALTER TABLE "variant_fetch_job" DROP COLUMN IF EXISTS "cardIdentifier"`);
    await queryRunner.query(`ALTER TABLE "variant_fetch_job" ADD COLUMN IF NOT EXISTS "userId" uuid NOT NULL`);
    await queryRunner.query(`ALTER TABLE "variant_fetch_job" ADD COLUMN IF NOT EXISTS "deckId" int NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vfj_user_status" ON "variant_fetch_job" ("userId", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vfj_deck_status" ON "variant_fetch_job" ("deckId", "status")`);

    await queryRunner.query(`DROP TABLE IF EXISTS "firecrawl_usage"`);
    await queryRunner.query(`ALTER TABLE "store" DROP COLUMN IF EXISTS "lastAvailabilityPassAt"`);
    await queryRunner.query(`ALTER TABLE "store_stock" DROP COLUMN IF EXISTS "listedInStockAt"`);
  }
}
