import { MigrationInterface, QueryRunner } from 'typeorm';

// share_event.targetId has no foreign key: events must outlive the deck or list they measured.
export class AddDeckSharing1778533597000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tracked_deck" ADD COLUMN "shareToken" varchar(32)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_tracked_deck_shareToken" ON "tracked_deck" ("shareToken")`,
    );

    await queryRunner.query(
      `ALTER TABLE "tracked_deck" ADD COLUMN "shareShowsContact" boolean NOT NULL DEFAULT true`,
    );

    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "displayName" varchar(40)`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "whatsappNumber" varchar(16)`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "referredByUserId" uuid`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "referredVia" varchar(8)`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_user_referredByUserId" FOREIGN KEY ("referredByUserId") REFERENCES "user"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "CHK_user_referred_via_valid" CHECK ("referredVia" IN ('deck', 'want', 'sell'))`,
    );

    await queryRunner.query(`
      CREATE TABLE "share_event" (
        "id" bigserial PRIMARY KEY,
        "kind" varchar(16) NOT NULL,
        "targetKind" varchar(8) NOT NULL,
        "targetId" int NOT NULL,
        "ownerUserId" uuid NOT NULL,
        "actorUserId" uuid,
        "occurredAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_share_event_kind_valid" CHECK ("kind" IN ('created', 'opened', 'signed_up')),
        CONSTRAINT "CHK_share_event_target_kind_valid" CHECK ("targetKind" IN ('deck', 'list')),
        CONSTRAINT "FK_share_event_ownerUserId" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_share_event_actorUserId" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_share_event_kind_occurredAt" ON "share_event" ("kind", "occurredAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "share_event"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "CHK_user_referred_via_valid"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_user_referredByUserId"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "referredVia"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "referredByUserId"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "whatsappNumber"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "displayName"`);
    await queryRunner.query(`ALTER TABLE "tracked_deck" DROP COLUMN "shareShowsContact"`);
    await queryRunner.query(`DROP INDEX "IDX_tracked_deck_shareToken"`);
    await queryRunner.query(`ALTER TABLE "tracked_deck" DROP COLUMN "shareToken"`);
  }
}
