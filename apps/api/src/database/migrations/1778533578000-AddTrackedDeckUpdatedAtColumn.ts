import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * U1 (T+2000) — Adds `updatedAt` timestamptz column to `tracked_deck` and
 * backfills it to `trackedAt` for all existing rows so the column is non-null
 * from day one.
 *
 * This column is a D12 forward-compat addition for optimistic locking (the
 * UI for 409 merge conflicts ships when community > 100 users or an overwrite
 * incident is reported — see Plan §Deferred to Follow-Up Work).
 *
 * TypeORM's @UpdateDateColumn triggers automatically via the ORM. The migration
 * sets a server-side `DEFAULT now()` so the column stays accurate even for rows
 * updated outside the ORM (direct SQL, scripts).
 *
 * Mirrors the SubstituteDecisionEntity.updatedAt precedent (same column type
 * and default).
 *
 * Part of the 6-migration sequence for Deck Management v2 (Plan §U1).
 */
export class AddTrackedDeckUpdatedAtColumn1778533578000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add nullable first so we can backfill before applying NOT NULL.
    await queryRunner.query(`
      ALTER TABLE "tracked_deck"
      ADD COLUMN "updatedAt" timestamptz
    `);

    // 2. Backfill existing rows: use trackedAt as the seed value so the column
    //    is non-null from day one. Any rows without a trackedAt (should be none
    //    in practice — it's set by CreateDateColumn) fall back to now().
    await queryRunner.query(`
      UPDATE "tracked_deck"
      SET "updatedAt" = COALESCE("trackedAt", now())
      WHERE "updatedAt" IS NULL
    `);

    // 3. Now safe to add NOT NULL + DEFAULT for future inserts/updates.
    await queryRunner.query(`
      ALTER TABLE "tracked_deck"
      ALTER COLUMN "updatedAt" SET NOT NULL,
      ALTER COLUMN "updatedAt" SET DEFAULT now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tracked_deck" DROP COLUMN "updatedAt"`);
  }
}
