import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * U1 (T+4000) — Swaps `tracked_deck.fabraryUlid` from NOT NULL unique to nullable
 * with a partial unique index (WHERE fabraryUlid IS NOT NULL).
 *
 * Rationale (D8): scratch decks created via `POST /decks` have no Fabrary URL,
 * so they need fabraryUlid = NULL. A standard unique index would treat multiple
 * NULL values as equal and block the second scratch deck insert. A partial unique
 * index only enforces uniqueness for non-NULL values, so two scratch decks per
 * user are fine.
 *
 * Steps:
 *   1. Drop the existing full unique index on (userId, fabraryUlid).
 *   2. Alter the column to allow NULLs.
 *   3. Create a new partial unique index WHERE fabraryUlid IS NOT NULL.
 *
 * The column type (varchar) is unchanged. No data is modified.
 *
 * TypeORM @Index decorator on TrackedDeckEntity mirrors this via:
 *   @Index(['userId', 'fabraryUlid'], { unique: true, where: '"fabraryUlid" IS NOT NULL' })
 * so that schema:log reports zero drift.
 *
 * Part of the 6-migration sequence for Deck Management v2 (Plan §U1).
 */
export class MakeTrackedDeckFabraryUlidNullable1778533580000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the old full unique index. The index was created by TypeORM's
    //    @Index(['userId', 'fabraryUlid'], { unique: true }) decorator, which
    //    generates a name based on table + column names.
    //    We use DROP INDEX IF EXISTS to be defensive against renamed index names.
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tracked_deck_userId_fabraryUlid"
    `);

    // Also try the TypeORM auto-generated name format just in case.
    await queryRunner.query(`
      DO $$
      DECLARE idx_name text;
      BEGIN
        SELECT indexname INTO idx_name
        FROM pg_indexes
        WHERE tablename = 'tracked_deck'
          AND indexname NOT LIKE '%pkey%'
          AND indexname NOT LIKE 'IDX_tracked_deck_userId_fabraryUlid_partial%'
          AND indexdef LIKE '%"userId"%'
          AND indexdef LIKE '%"fabraryUlid"%'
          AND indexdef NOT LIKE '%WHERE%'
        LIMIT 1;
        IF idx_name IS NOT NULL THEN
          EXECUTE 'DROP INDEX IF EXISTS "' || idx_name || '"';
        END IF;
      END $$;
    `);

    // 2. Allow NULLs in the column. Existing non-null values are untouched.
    await queryRunner.query(`
      ALTER TABLE "tracked_deck"
      ALTER COLUMN "fabraryUlid" DROP NOT NULL
    `);

    // 3. Create the partial unique index — only non-NULL fabraryUlid values
    //    must be unique per user. Two scratch decks (fabraryUlid = NULL) are
    //    allowed without violating the constraint.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_tracked_deck_userId_fabraryUlid_partial"
        ON "tracked_deck" ("userId", "fabraryUlid")
        WHERE "fabraryUlid" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the partial index.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tracked_deck_userId_fabraryUlid_partial"`);

    // 2. Make the column NOT NULL again. This will fail if any row has NULL —
    //    ensure scratch decks are deleted before rolling back in production.
    await queryRunner.query(`
      ALTER TABLE "tracked_deck"
      ALTER COLUMN "fabraryUlid" SET NOT NULL
    `);

    // 3. Recreate the original full unique index.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_tracked_deck_userId_fabraryUlid"
        ON "tracked_deck" ("userId", "fabraryUlid")
    `);
  }
}
