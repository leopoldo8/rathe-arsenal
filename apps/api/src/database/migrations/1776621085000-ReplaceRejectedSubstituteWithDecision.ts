import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableCheck,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * U9 — replaces `rejected_substitute` (single-state) with `substitute_decision`
 * (3-state approve/reject/pending). Decision is stored as varchar with a CHECK
 * constraint instead of a native Postgres enum so that adding a third state
 * (e.g. `modified`) in Phase 2 is a simple constraint replacement rather than
 * a drop-and-recreate of the enum type.
 *
 * Timestamp spacing note (Plan A §Key Technical Decisions): Unit 11's
 * TruncateDeckReadinessSnapshot runs at T+1000 = 1776621086000 and Unit 12's
 * AddUserSettings at T+2000 = 1776621087000.
 */
export class ReplaceRejectedSubstituteWithDecision1776621085000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the old unique index and table for rejected_substitute.
    //    The unique index is named in the original AddRejectedSubstitute migration.
    await queryRunner.dropIndex(
      'rejected_substitute',
      'IDX_rejected_substitute_deck_card_unique',
    );
    await queryRunner.dropTable('rejected_substitute');

    // 2. Create substitute_decision with uuid PK, userId + trackedDeckId FKs,
    //    cardIdentifier, and a varchar decision column with CHECK constraint.
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
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'trackedDeckId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'cardIdentifier',
            type: 'varchar',
            length: '128',
            isNullable: false,
          },
          {
            name: 'decision',
            type: 'varchar',
            length: '32',
            isNullable: false,
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

    // 3. CHECK constraint: decision must be 'approved' or 'rejected'.
    //    Rejects any value such as 'modified' or 'pending' — extensibility
    //    requires a constraint replacement migration, not a code-only change.
    await queryRunner.createCheckConstraint(
      'substitute_decision',
      new TableCheck({
        name: 'CHK_substitute_decision_decision_valid',
        columnNames: ['decision'],
        expression: `decision IN ('approved', 'rejected')`,
      }),
    );

    // 4. Foreign keys: userId -> user.id cascade delete;
    //    trackedDeckId -> tracked_deck.id cascade delete.
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

    // 5. Unique index: one decision per (user, deck, card) triple.
    await queryRunner.createIndex(
      'substitute_decision',
      new TableIndex({
        name: 'IDX_substitute_decision_user_deck_card_unique',
        columnNames: ['userId', 'trackedDeckId', 'cardIdentifier'],
        isUnique: true,
      }),
    );

    // 6. Lookup index for fast deck-level rejection filtering.
    await queryRunner.createIndex(
      'substitute_decision',
      new TableIndex({
        name: 'IDX_substitute_decision_deck_decision',
        columnNames: ['trackedDeckId', 'decision'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new table and recreate the old one.
    await queryRunner.dropIndex(
      'substitute_decision',
      'IDX_substitute_decision_deck_decision',
    );
    await queryRunner.dropIndex(
      'substitute_decision',
      'IDX_substitute_decision_user_deck_card_unique',
    );
    await queryRunner.dropTable('substitute_decision');

    // Recreate rejected_substitute (original schema from AddRejectedSubstitute).
    await queryRunner.createTable(
      new Table({
        name: 'rejected_substitute',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'trackedDeckId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'cardIdentifier',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'rejectedAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['trackedDeckId'],
            referencedTableName: 'tracked_deck',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'rejected_substitute',
      new TableIndex({
        name: 'IDX_rejected_substitute_deck_card_unique',
        columnNames: ['trackedDeckId', 'cardIdentifier'],
        isUnique: true,
      }),
    );
  }
}
