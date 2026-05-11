import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * U1 (T+1000) — Adds nullable `heroIdentifier` varchar column to `tracked_deck`.
 *
 * Nullable to tolerate existing rows whose legacy `hero` display-name cannot be
 * resolved to a catalog identifier at backfill time (R24a). The T+5000 migration
 * performs the backfill; any rows that remain NULL after backfill surface as
 * legality.category='illegal' with the reason "Hero not recognized — please
 * re-select in Edit mode", which is a graceful degradation rather than a hard
 * outage (see T+5000 migration header for the full rationale).
 *
 * Going forward, new Fabrary imports set this from `hero.cardIdentifier` directly
 * (see DecksImportService modification in U1).
 *
 * Part of the 6-migration sequence for Deck Management v2 (Plan §U1).
 */
export class AddTrackedDeckHeroIdentifierColumn1778533577000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tracked_deck"
      ADD COLUMN "heroIdentifier" varchar(128)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tracked_deck" DROP COLUMN "heroIdentifier"`);
  }
}
