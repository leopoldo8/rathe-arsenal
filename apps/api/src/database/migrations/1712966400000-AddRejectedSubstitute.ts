import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * U7 — adds the `rejected_substitute` table that persists user intent to
 * skip specific cards when the substitution engine re-solves a tracked
 * deck. Cascade FK on `trackedDeckId` ensures rejections are cleaned up
 * when a tracked deck is untracked.
 */
export class AddRejectedSubstitute1712966400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'rejected_substitute',
      'IDX_rejected_substitute_deck_card_unique',
    );
    await queryRunner.dropTable('rejected_substitute');
  }
}
