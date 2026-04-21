import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Truncate `deck_readiness_snapshot` so the `IBreakdownEntry` shape
 * gains `imageUrl` on the next read.
 *
 * Snapshots persisted before this commit were computed against a
 * breakdown entry that had `pitch`, `cost`, and `type` but not
 * `imageUrl`. The frontend falls back to the stylized <CardArt>
 * placeholder whenever `imageUrl` is missing, so existing decks keep
 * working — but the user never sees a real card face until the
 * snapshot is recomputed.
 *
 * Same treatment as the U11 truncate: the `breakdown` column is
 * `jsonb`, snapshots are disposable (they're a cache of a pure
 * compute against deck + inventory + catalog), and migrating JSONB
 * rows in-place for an additive field costs more than regenerating
 * at pre-launch scale.
 *
 * `DecksService.listForUser` and `DecksService.getDetail` both
 * auto-recompute missing snapshots on the next read, so no manual
 * action is required after running this migration.
 *
 * down() is intentionally a no-op: snapshots are re-computed on
 * demand, not restored.
 */
export class TruncateDeckReadinessSnapshotForImageUrl1776785666000
  implements MigrationInterface
{
  name = 'TruncateDeckReadinessSnapshotForImageUrl1776785666000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE "deck_readiness_snapshot"`);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: snapshots are disposable, auto-recomputed on next read.
  }
}
