import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableCheck,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * U5 — creates the `review_aggregate` table.
 *
 * This table is a per-(userId, deckId) read-model that caches the
 * outcome of the latest readiness computation so that the cross-deck
 * Reviews surface can serve list responses without re-aggregating the
 * snapshot JSONB each time.
 *
 * - `status` lifecycle: 'computing' → 'ready' after first compute;
 *   invalidated to 'stale' when a new snapshot is persisted.
 * - `verdict` maps engine TPath:
 *     'A' → 'ready_to_play'
 *     'B' → 'close'
 *     'C' → 'not_ready'
 * - `counters` JSONB: `{ have, missing, partial }` — counts from the
 *   snapshot's `breakdown.exact`, `breakdown.missing`, and
 *   `breakdown.substituted`.
 * - `bracket` stores the raw TPath ('A' | 'B' | 'C').
 * - Unique constraint on (userId, deckId) is the upsert backstop.
 */
export class AddReviewAggregate1776785667000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'review_aggregate',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'deckId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '16',
            isNullable: false,
          },
          {
            name: 'lastComputedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'verdict',
            type: 'varchar',
            length: '24',
            isNullable: true,
          },
          {
            name: 'counters',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'bracket',
            type: 'varchar',
            length: '4',
            isNullable: true,
          },
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

    // CHECK: status must be one of the three lifecycle values.
    await queryRunner.createCheckConstraint(
      'review_aggregate',
      new TableCheck({
        name: 'CHK_review_aggregate_status_valid',
        columnNames: ['status'],
        expression: `status IN ('ready', 'computing', 'stale')`,
      }),
    );

    // CHECK: verdict is nullable but when set must be a known value.
    await queryRunner.createCheckConstraint(
      'review_aggregate',
      new TableCheck({
        name: 'CHK_review_aggregate_verdict_valid',
        columnNames: ['verdict'],
        expression: `verdict IS NULL OR verdict IN ('ready_to_play', 'close', 'not_ready')`,
      }),
    );

    // CHECK: bracket is nullable but when set must be a valid TPath.
    await queryRunner.createCheckConstraint(
      'review_aggregate',
      new TableCheck({
        name: 'CHK_review_aggregate_bracket_valid',
        columnNames: ['bracket'],
        expression: `bracket IS NULL OR bracket IN ('A', 'B', 'C')`,
      }),
    );

    // FK: userId → user.id CASCADE DELETE.
    await queryRunner.createForeignKey(
      'review_aggregate',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // FK: deckId → tracked_deck.id CASCADE DELETE.
    await queryRunner.createForeignKey(
      'review_aggregate',
      new TableForeignKey({
        columnNames: ['deckId'],
        referencedTableName: 'tracked_deck',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Unique index: one aggregate row per (user, deck) pair.
    await queryRunner.createIndex(
      'review_aggregate',
      new TableIndex({
        name: 'IDX_review_aggregate_user_deck_unique',
        columnNames: ['userId', 'deckId'],
        isUnique: true,
      }),
    );

    // Lookup index for fetching all aggregates for a user efficiently.
    await queryRunner.createIndex(
      'review_aggregate',
      new TableIndex({
        name: 'IDX_review_aggregate_user',
        columnNames: ['userId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'review_aggregate',
      'IDX_review_aggregate_user',
    );
    await queryRunner.dropIndex(
      'review_aggregate',
      'IDX_review_aggregate_user_deck_unique',
    );
    await queryRunner.dropTable('review_aggregate');
  }
}
