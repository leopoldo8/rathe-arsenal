import { MigrationInterface, QueryRunner } from 'typeorm';

// share_image.targetId has no foreign key: the deck delete path and the purge script remove the rows.
export class AddShareImage1778533598000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "share_image" (
        "id" serial PRIMARY KEY,
        "targetKind" varchar(8) NOT NULL,
        "targetId" int NOT NULL,
        "contentHash" varchar(64) NOT NULL,
        "cardIdentifiers" text[] NOT NULL,
        "jpeg" bytea NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_share_image_target" ON "share_image" ("targetKind", "targetId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_share_image_cardIdentifiers" ON "share_image" USING GIN ("cardIdentifiers")`,
    );

    await queryRunner.query(`
      CREATE TABLE "card_art_block" (
        "cardIdentifier" varchar PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "card_art_block"`);
    await queryRunner.query(`DROP INDEX "IDX_share_image_cardIdentifiers"`);
    await queryRunner.query(`DROP INDEX "IDX_share_image_target"`);
    await queryRunner.query(`DROP TABLE "share_image"`);
  }
}
