import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * U1 (T+3000) — Creates `deck_tag` and `tracked_deck_tag` tables for user-defined
 * free-form deck categorization (R3a, R5, R12a).
 *
 * deck_tag:
 *   - Serial PK (int)
 *   - userId (uuid) → user.id CASCADE DELETE
 *   - name (varchar 24) NOT NULL — max enforced at DTO layer
 *   - createdAt (timestamptz)
 *   - Unique index on (userId, LOWER(name)) for case-insensitive uniqueness
 *
 * tracked_deck_tag (join table):
 *   - trackedDeckId → tracked_deck.id CASCADE DELETE
 *   - tagId → deck_tag.id CASCADE DELETE
 *   - attachedAt (timestamptz) — ordering/recency surface
 *   - Primary key on (trackedDeckId, tagId) — natural composite PK prevents
 *     duplicate join rows and replaces the separate unique index
 *
 * Part of the 6-migration sequence for Deck Management v2 (Plan §U1).
 */
export class AddDeckTagsAndJoinTables1778533579000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create deck_tag table.
    await queryRunner.createTable(
      new Table({
        name: 'deck_tag',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '24',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // 2. FK: deck_tag.userId → user.id CASCADE DELETE.
    await queryRunner.createForeignKey(
      'deck_tag',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 3. Case-insensitive unique index on (userId, LOWER(name)) to prevent
    //    "Liga Local" and "liga local" from coexisting per user.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_deck_tag_user_name_ci"
        ON "deck_tag" ("userId", LOWER("name"))
    `);

    // 4. Create tracked_deck_tag join table.
    await queryRunner.createTable(
      new Table({
        name: 'tracked_deck_tag',
        columns: [
          {
            name: 'trackedDeckId',
            type: 'int',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'tagId',
            type: 'int',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'attachedAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // 5. FK: tracked_deck_tag.trackedDeckId → tracked_deck.id CASCADE DELETE.
    await queryRunner.createForeignKey(
      'tracked_deck_tag',
      new TableForeignKey({
        name: 'FK_tracked_deck_tag_trackedDeckId',
        columnNames: ['trackedDeckId'],
        referencedTableName: 'tracked_deck',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 6. FK: tracked_deck_tag.tagId → deck_tag.id CASCADE DELETE.
    await queryRunner.createForeignKey(
      'tracked_deck_tag',
      new TableForeignKey({
        name: 'FK_tracked_deck_tag_tagId',
        columnNames: ['tagId'],
        referencedTableName: 'deck_tag',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 7. Lookup index on tagId for the "how many decks use this tag?" query
    //    that drives implicit tag deletion (U4 TOCTOU-safe sequence).
    await queryRunner.createIndex(
      'tracked_deck_tag',
      new TableIndex({
        name: 'IDX_tracked_deck_tag_tagId',
        columnNames: ['tagId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop join table first (references deck_tag).
    await queryRunner.dropIndex('tracked_deck_tag', 'IDX_tracked_deck_tag_tagId');
    await queryRunner.dropTable('tracked_deck_tag');

    // Drop case-insensitive index (expression index — must use raw SQL to drop).
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_deck_tag_user_name_ci"`);

    // Drop deck_tag.
    await queryRunner.dropTable('deck_tag');
  }
}
