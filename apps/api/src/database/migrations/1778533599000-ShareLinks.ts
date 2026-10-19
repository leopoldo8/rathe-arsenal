import { MigrationInterface, QueryRunner } from 'typeorm';

// Replaces tracked_deck.shareToken/shareShowsContact with one share_link row per (target, intent).
// Existing deck tokens are copied with intent 'deck', so links already handed out keep working.
// share_link.targetId has no foreign key (a link targets a deck or a list); the delete paths remove the rows.
export class ShareLinks1778533599000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "share_link" (
        "id" serial PRIMARY KEY,
        "token" varchar(32) NOT NULL,
        "targetKind" varchar(8) NOT NULL,
        "targetId" int NOT NULL,
        "intent" varchar(16) NOT NULL,
        "ownerUserId" uuid NOT NULL,
        "showsContact" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_share_link_target_kind_valid" CHECK ("targetKind" IN ('deck', 'list')),
        CONSTRAINT "CHK_share_link_intent_valid" CHECK ("intent" IN ('deck', 'missing', 'want', 'sell')),
        CONSTRAINT "FK_share_link_ownerUserId" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_share_link_token" ON "share_link" ("token")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_share_link_target_intent" ON "share_link" ("targetKind", "targetId", "intent")`,
    );

    await queryRunner.query(`
      INSERT INTO "share_link" ("token", "targetKind", "targetId", "intent", "ownerUserId", "showsContact")
      SELECT "shareToken", 'deck', "id", 'deck', "userId", "shareShowsContact"
        FROM "tracked_deck"
       WHERE "shareToken" IS NOT NULL
    `);
    await queryRunner.query(`DROP INDEX "IDX_tracked_deck_shareToken"`);
    await queryRunner.query(`ALTER TABLE "tracked_deck" DROP COLUMN "shareToken"`);
    await queryRunner.query(`ALTER TABLE "tracked_deck" DROP COLUMN "shareShowsContact"`);

    // Stored images regenerate on the next request, so they are dropped instead of re-keyed.
    await queryRunner.query(`DELETE FROM "share_image"`);
    await queryRunner.query(`DROP INDEX "IDX_share_image_target"`);
    await queryRunner.query(`ALTER TABLE "share_image" DROP COLUMN "targetKind"`);
    await queryRunner.query(`ALTER TABLE "share_image" DROP COLUMN "targetId"`);
    await queryRunner.query(`ALTER TABLE "share_image" ADD COLUMN "shareLinkId" int NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "share_image" ADD CONSTRAINT "FK_share_image_shareLinkId" FOREIGN KEY ("shareLinkId") REFERENCES "share_link"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_share_image_shareLinkId" ON "share_image" ("shareLinkId")`,
    );

    await queryRunner.query(`ALTER TABLE "share_event" ADD COLUMN "intent" varchar(16)`);
    await queryRunner.query(
      `ALTER TABLE "share_event" ADD CONSTRAINT "CHK_share_event_intent_valid" CHECK ("intent" IS NULL OR "intent" IN ('deck', 'missing', 'want', 'sell'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "share_event" DROP CONSTRAINT "CHK_share_event_intent_valid"`);
    await queryRunner.query(`ALTER TABLE "share_event" DROP COLUMN "intent"`);

    await queryRunner.query(`DELETE FROM "share_image"`);
    await queryRunner.query(`DROP INDEX "IDX_share_image_shareLinkId"`);
    await queryRunner.query(`ALTER TABLE "share_image" DROP CONSTRAINT "FK_share_image_shareLinkId"`);
    await queryRunner.query(`ALTER TABLE "share_image" DROP COLUMN "shareLinkId"`);
    await queryRunner.query(`ALTER TABLE "share_image" ADD COLUMN "targetKind" varchar(8) NOT NULL`);
    await queryRunner.query(`ALTER TABLE "share_image" ADD COLUMN "targetId" int NOT NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_share_image_target" ON "share_image" ("targetKind", "targetId")`,
    );

    await queryRunner.query(`ALTER TABLE "tracked_deck" ADD COLUMN "shareToken" varchar(32)`);
    await queryRunner.query(
      `ALTER TABLE "tracked_deck" ADD COLUMN "shareShowsContact" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(`
      UPDATE "tracked_deck" SET "shareToken" = l."token", "shareShowsContact" = l."showsContact"
        FROM "share_link" l
       WHERE l."targetKind" = 'deck' AND l."intent" = 'deck' AND l."targetId" = "tracked_deck"."id"
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_tracked_deck_shareToken" ON "tracked_deck" ("shareToken")`,
    );
    await queryRunner.query(`DROP TABLE "share_link"`);
  }
}
