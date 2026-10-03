import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableCheck,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * AD-006/AD-007 (design/07-swaps.md §5, D8/SWAP-15) — replaces
 * `substitute_decision` with `swap_suggestion`, a persisted-row model with
 * a stable id, a slot column, a first-class `substituteIdentifier` column,
 * a `quantity` (per-group, not per-copy), and the full approve/reject/
 * revert/restore/outcome lifecycle. `substitute_decision` had no room for
 * any of this -- its `cardIdentifier` column *was* the substitute id, with
 * no original card and no slot, which is the root cause of the
 * cross-original suppression bug fixed in the same change set (§1, §4).
 *
 * Timestamp spacing note (mirrors `1776621085000`'s own header): this runs
 * at T+1000 = 1778533586000 relative to `1778533585000-AddUserRole`, the
 * most recent migration at the time this was written.
 *
 * ## D8 — legacy data is discarded, not reconstructed (SWAP-15)
 *
 * Neither `approved` nor `rejected` `substitute_decision` rows are carried
 * forward. The legacy table never recorded the original card or the slot --
 * only the substitute's identifier -- so any reconstruction beyond a guess
 * risks corrupting readiness, which the spec explicitly warns against.
 * Discarding is the only option that doesn't risk building new bugs on top
 * of the old table's missing data (see design/07-swaps.md §5 for the two
 * reconstruction approaches considered and rejected).
 *
 * ## down() cannot restore the discarded data -- this is a one-way door
 *
 * `down()` recreates the `substitute_decision` **table shape** for
 * rollback safety, but the rows deleted by `up()`'s `dropTable` are gone.
 * There is no source to reconstruct them from -- `up()` does not snapshot
 * them anywhere before dropping. Rolling back this migration always leaves
 * `substitute_decision` empty, never restored to its pre-migration state.
 * Acceptable given the closed-beta, staging-adjacent scale this design was
 * sized against, but it is a one-way door and must be treated as one: do
 * not run `down()` expecting the old decisions back.
 *
 * The mandatory backfill step for `swap_suggestion` itself --
 * `apps/api/src/swaps/backfill-swap-suggestions.ts`, run with
 * `pnpm --filter @rathe-arsenal/api backfill:swap-suggestions` (see
 * scripts/deploy-railway.md) -- is a required deploy step run immediately
 * after this migration, not part of `up()` (computing
 * readiness requires the full engine + catalog + inventory pipeline, which
 * cannot run inside a `QueryRunner`). Without it, `swap_suggestion` stays
 * empty until each deck happens to recompute on its own. See
 * design/07-swaps.md "Landing sequence" for the full rationale.
 */
export class ReplaceSubstituteDecisionWithSwapSuggestion1778533586000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop substitute_decision entirely -- D8: discard, don't migrate.
    await queryRunner.dropIndex(
      'substitute_decision',
      'IDX_substitute_decision_deck_decision',
    );
    await queryRunner.dropIndex(
      'substitute_decision',
      'IDX_substitute_decision_user_deck_card_unique',
    );
    await queryRunner.dropTable('substitute_decision');

    // 2. Create swap_suggestion.
    await queryRunner.createTable(
      new Table({
        name: 'swap_suggestion',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'userId', type: 'uuid', isNullable: false },
          { name: 'trackedDeckId', type: 'int', isNullable: false },
          { name: 'cardIdentifier', type: 'varchar', length: '128', isNullable: false },
          { name: 'slot', type: 'varchar', length: '64', isNullable: false },
          { name: 'substituteIdentifier', type: 'varchar', length: '128', isNullable: false },
          { name: 'quantity', type: 'int', isNullable: false },
          { name: 'tier', type: 'smallint', isNullable: false },
          { name: 'confidence', type: 'float', isNullable: false },
          { name: 'rationale', type: 'text', isNullable: false },
          { name: 'status', type: 'varchar', length: '32', isNullable: false },
          { name: 'appliedAt', type: 'timestamptz', isNullable: true },
          { name: 'rejectedAt', type: 'timestamptz', isNullable: true },
          { name: 'rejectionReason', type: 'varchar', length: '32', isNullable: true },
          { name: 'rejectionNote', type: 'varchar', length: '500', isNullable: true },
          { name: 'outcome', type: 'varchar', length: '32', isNullable: true },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // 3. CHECK constraints -- built via createCheckConstraint, never raw
    //    ALTER TABLE, per 1776621085000's precedent. Quoting camelCase
    //    column names since this repo's columns are camelCase throughout.
    await queryRunner.createCheckConstraint(
      'swap_suggestion',
      new TableCheck({
        name: 'CHK_swap_suggestion_status_valid',
        columnNames: ['status'],
        expression: `status IN ('pending', 'approved', 'rejected', 'retired')`,
      }),
    );

    await queryRunner.createCheckConstraint(
      'swap_suggestion',
      new TableCheck({
        name: 'CHK_swap_suggestion_rejection_reason_valid',
        columnNames: ['rejectionReason'],
        expression: `"rejectionReason" IS NULL OR "rejectionReason" IN ('not_equivalent', 'dont_own', 'changes_plan', 'prefer_original', 'other')`,
      }),
    );

    await queryRunner.createCheckConstraint(
      'swap_suggestion',
      new TableCheck({
        name: 'CHK_swap_suggestion_outcome_valid',
        columnNames: ['outcome'],
        expression: `outcome IS NULL OR outcome IN ('worked', 'did_not_work')`,
      }),
    );

    // 4. Foreign keys, cascade delete on both, same pattern as substitute_decision.
    await queryRunner.createForeignKey(
      'swap_suggestion',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'swap_suggestion',
      new TableForeignKey({
        columnNames: ['trackedDeckId'],
        referencedTableName: 'tracked_deck',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 5. Unique natural key -- the reconciliation lookup and the DB-level
    //    backstop against duplicate groups.
    await queryRunner.createIndex(
      'swap_suggestion',
      new TableIndex({
        name: 'IDX_swap_suggestion_natural_key',
        columnNames: ['trackedDeckId', 'cardIdentifier', 'slot', 'substituteIdentifier'],
        isUnique: true,
      }),
    );

    // 6. Lookup index -- powers tab counts and the exclusion/approval-set query.
    await queryRunner.createIndex(
      'swap_suggestion',
      new TableIndex({
        name: 'IDX_swap_suggestion_deck_status',
        columnNames: ['trackedDeckId', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop swap_suggestion and recreate substitute_decision's table shape.
    // See the class header: this does NOT restore the rows up() deleted --
    // there is nothing to restore from. The recreated table is empty.
    await queryRunner.dropIndex('swap_suggestion', 'IDX_swap_suggestion_deck_status');
    await queryRunner.dropIndex('swap_suggestion', 'IDX_swap_suggestion_natural_key');
    await queryRunner.dropTable('swap_suggestion');

    await queryRunner.createTable(
      new Table({
        name: 'substitute_decision',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'userId', type: 'uuid', isNullable: false },
          { name: 'trackedDeckId', type: 'int', isNullable: false },
          { name: 'cardIdentifier', type: 'varchar', length: '128', isNullable: false },
          { name: 'decision', type: 'varchar', length: '32', isNullable: false },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createCheckConstraint(
      'substitute_decision',
      new TableCheck({
        name: 'CHK_substitute_decision_decision_valid',
        columnNames: ['decision'],
        expression: `decision IN ('approved', 'rejected')`,
      }),
    );

    await queryRunner.createForeignKey(
      'substitute_decision',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'substitute_decision',
      new TableForeignKey({
        columnNames: ['trackedDeckId'],
        referencedTableName: 'tracked_deck',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'substitute_decision',
      new TableIndex({
        name: 'IDX_substitute_decision_user_deck_card_unique',
        columnNames: ['userId', 'trackedDeckId', 'cardIdentifier'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'substitute_decision',
      new TableIndex({
        name: 'IDX_substitute_decision_deck_decision',
        columnNames: ['trackedDeckId', 'decision'],
      }),
    );
  }
}
