import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableCheck,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Creates `card_replacement` (AD-009, card-alternatives Landing doors 1-4):
 * the record of a pick, kept apart from `deck_card` because every composition
 * save rewrites those rows. No backfill: no deck has replacements before this
 * ships.
 *
 * `status` and `pickedFrom` are varchar plus CHECK rather than Postgres enum
 * types (doors 2 and 3), and identifier and slot widths match
 * `swap_suggestion` (door 4). Rows are never deleted by code; the foreign keys
 * cascade from `user` and `tracked_deck` (door 1).
 */

// A service running TypeORM `synchronize` can create the table ahead of this
// migration, without the CHECKs and named index. An empty copy is rebuilt; one
// holding rows is never dropped silently.
async function dropEmptySynchronizedTable(queryRunner: QueryRunner): Promise<void> {
  if (!(await queryRunner.hasTable('card_replacement'))) return;
  const [{ count }] = (await queryRunner.query(
    `SELECT count(*)::int AS count FROM "card_replacement"`,
  )) as [{ count: number }];
  if (count > 0) {
    throw new Error(
      `card_replacement already holds ${count} row(s); refusing to recreate it. Inspect it before migrating.`,
    );
  }
  await queryRunner.query(`DROP TABLE "card_replacement" CASCADE`);
}

export class AddCardReplacement1778533590000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await dropEmptySynchronizedTable(queryRunner);

    await queryRunner.createTable(
      new Table({
        name: 'card_replacement',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'userId', type: 'uuid', isNullable: false },
          { name: 'trackedDeckId', type: 'int', isNullable: false },
          { name: 'slot', type: 'varchar', length: '64', isNullable: false },
          { name: 'originalCardIdentifier', type: 'varchar', length: '128', isNullable: false },
          { name: 'replacementCardIdentifier', type: 'varchar', length: '128', isNullable: false },
          { name: 'quantity', type: 'int', isNullable: false },
          { name: 'pickedFrom', type: 'varchar', length: '32', isNullable: false },
          { name: 'status', type: 'varchar', length: '32', isNullable: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'resolvedAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createCheckConstraint(
      'card_replacement',
      new TableCheck({
        name: 'CHK_card_replacement_status_valid',
        columnNames: ['status'],
        expression: `status IN ('active', 'kept', 'reverted', 'removed')`,
      }),
    );
    await queryRunner.createCheckConstraint(
      'card_replacement',
      new TableCheck({
        name: 'CHK_card_replacement_picked_from_valid',
        columnNames: ['pickedFrom'],
        expression: `"pickedFrom" IN ('very_close', 'close', 'other_pitch', 'generic', 'search')`,
      }),
    );
    await queryRunner.createCheckConstraint(
      'card_replacement',
      new TableCheck({
        name: 'CHK_card_replacement_quantity_positive',
        columnNames: ['quantity'],
        expression: `quantity > 0`,
      }),
    );

    await queryRunner.createForeignKey(
      'card_replacement',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'card_replacement',
      new TableForeignKey({
        columnNames: ['trackedDeckId'],
        referencedTableName: 'tracked_deck',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'card_replacement',
      new TableIndex({
        name: 'IDX_card_replacement_deck_status',
        columnNames: ['trackedDeckId', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping the table takes its index, constraints and foreign keys with it.
    await queryRunner.query(`DROP TABLE IF EXISTS "card_replacement"`);
  }
}
