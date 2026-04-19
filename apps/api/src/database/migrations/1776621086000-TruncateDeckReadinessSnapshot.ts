import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * U11 — truncates `deck_readiness_snapshot` so that the enriched
 * `IBreakdownEntry` shape (pitch, cost, type) is re-populated on the next
 * read via the auto-recompute path in `DecksService.listForUser` and
 * `DecksService.getDetail`.
 *
 * Rationale: the `breakdown` column is `jsonb`; snapshots persisted before
 * U11 lack the `pitch`, `cost`, and `type` fields. Rather than migrating
 * potentially thousands of JSONB rows in-place, we discard and regenerate —
 * this is safe at pre-launch scale where no real user data exists.
 *
 * Timestamp = U9 timestamp (1776621085000) + 1000ms = 1776621086000.
 * Per §Key Technical Decisions, +1000ms spacing ensures deterministic
 * TypeORM migration execution order within the same commit.
 *
 * down() is a no-op: snapshot data is disposable (re-computed on demand)
 * and cannot be meaningfully restored after truncation.
 */
export class TruncateDeckReadinessSnapshot1776621086000 implements MigrationInterface {
  name = 'TruncateDeckReadinessSnapshot1776621086000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE "deck_readiness_snapshot"`);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Snapshots are disposable — re-computed automatically on next read.
    // No restoration needed; rolling back this migration does not restore data.
  }
}
