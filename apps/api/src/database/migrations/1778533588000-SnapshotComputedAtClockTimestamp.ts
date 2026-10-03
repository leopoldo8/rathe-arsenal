import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `now()` is the transaction start time, so a recompute that waited on the
 * per-deck lock could stamp its snapshot earlier than the one it waited for,
 * and "latest snapshot" read the stale row. `clock_timestamp()` is the time
 * of the insert itself.
 */
export class SnapshotComputedAtClockTimestamp1778533588000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deck_readiness_snapshot" ALTER COLUMN "computedAt" SET DEFAULT clock_timestamp()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deck_readiness_snapshot" ALTER COLUMN "computedAt" SET DEFAULT now()`,
    );
  }
}
