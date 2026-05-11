import { MigrationInterface, QueryRunner, TableCheck } from 'typeorm';

/**
 * U1 (T+0) — Adds `status` varchar column to `tracked_deck` with a named CHECK
 * constraint enforcing the 5-value set: idea | building | ready | active | retired.
 *
 * Default is 'building' so all existing Fabrary-imported rows land at 'building'
 * (R2 flat default — no effectivePercent-based bucketing).
 *
 * Part of the 6-migration sequence for Deck Management v2 (Plan §U1):
 *   T+0    AddTrackedDeckStatusColumn          (this file)
 *   T+1000 AddTrackedDeckHeroIdentifierColumn
 *   T+2000 AddTrackedDeckUpdatedAtColumn
 *   T+3000 AddDeckTagsAndJoinTables
 *   T+4000 MakeTrackedDeckFabraryUlidNullable
 *   T+5000 BackfillTrackedDeckHeroIdentifier
 *
 * Down() is independently reversible: drops the CHECK constraint then the column.
 */
export class AddTrackedDeckStatusColumn1778533576000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the column with a server-side default so the ALTER is instant
    //    (PG fills existing rows from the default without a table rewrite when
    //    the column is NOT NULL with a default).
    await queryRunner.query(`
      ALTER TABLE "tracked_deck"
      ADD COLUMN "status" varchar(16) NOT NULL DEFAULT 'building'
    `);

    // 2. Named CHECK constraint — 5-value closed set. varchar+CHECK is the
    //    project convention (vs. native Postgres enum) so adding a sixth state
    //    only requires replacing the constraint, not dropping+recreating an
    //    enum type. Mirrors the CHK_substitute_decision_decision_valid pattern.
    await queryRunner.createCheckConstraint(
      'tracked_deck',
      new TableCheck({
        name: 'CHK_tracked_deck_status_valid',
        columnNames: ['status'],
        expression: `"status" IN ('idea', 'building', 'ready', 'active', 'retired')`,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop constraint before column — PG requires this order.
    await queryRunner.dropCheckConstraint('tracked_deck', 'CHK_tracked_deck_status_valid');
    await queryRunner.query(`ALTER TABLE "tracked_deck" DROP COLUMN "status"`);
  }
}
