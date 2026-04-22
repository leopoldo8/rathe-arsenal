import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableCheck,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * U1 — creates `csv_source` table and adds `sourceId` FK on `collection_card`.
 *
 * Summary of changes:
 * 1. Create `csv_source` with uuid PK, userId FK, kind varchar+CHECK,
 *    label, originalFilename, sourceUrl, contentHash, cardCount, active,
 *    createdAt, updatedAt.
 * 2. Partial unique indexes on `csv_source`:
 *    - `(userId) WHERE kind='manual'` — one manual source per user.
 *    - `(userId, contentHash) WHERE kind='csv' AND contentHash IS NOT NULL` —
 *      DB backstop against exact-match duplicate CSV imports.
 * 3. TRUNCATE `collection_card` (pre-launch, no real users — snapshots are
 *    disposable and collection rows will be re-seeded from fixtures).
 * 4. Drop old `(userId, cardIdentifier)` unique index on `collection_card`.
 * 5. Add `sourceId uuid NOT NULL` column with FK to `csv_source(id)`.
 * 6. Add new `(userId, cardIdentifier, sourceId)` unique index.
 * 7. Add plain index on `(userId)` and `(userId, kind)` on `csv_source` for
 *    fast per-user source lookups.
 *
 * down() reverses: drops `sourceId`, restores old index, drops `csv_source`.
 * Safe at pre-launch — no user data is preserved on rollback.
 *
 * Timestamp spacing: next unit (U3+) should use a value ≥ 1776854852000.
 */
export class AddCsvSourceAndCollectionCardSourceId1776854851000
  implements MigrationInterface
{
  name = 'AddCsvSourceAndCollectionCardSourceId1776854851000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── 1. Create csv_source ─────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'csv_source',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'kind',
            type: 'varchar',
            length: '16',
            isNullable: false,
          },
          {
            name: 'label',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'originalFilename',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'sourceUrl',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'contentHash',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'cardCount',
            type: 'int',
            isNullable: true,
            default: null,
          },
          {
            name: 'active',
            type: 'boolean',
            isNullable: false,
            default: true,
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

    // ─── 2. CHECK constraint: kind must be 'csv' or 'manual' ─────────────
    await queryRunner.createCheckConstraint(
      'csv_source',
      new TableCheck({
        name: 'CHK_csv_source_kind_valid',
        columnNames: ['kind'],
        expression: `kind IN ('csv', 'manual')`,
      }),
    );

    // ─── 3. FK: csv_source.userId → user.id CASCADE DELETE ───────────────
    await queryRunner.createForeignKey(
      'csv_source',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // ─── 4. Indexes on csv_source ─────────────────────────────────────────
    // Plain index for per-user source list lookups.
    await queryRunner.createIndex(
      'csv_source',
      new TableIndex({
        name: 'IDX_csv_source_userId',
        columnNames: ['userId'],
      }),
    );

    // Composite index for kind-filtered lookups (e.g. find manual source).
    await queryRunner.createIndex(
      'csv_source',
      new TableIndex({
        name: 'IDX_csv_source_userId_kind',
        columnNames: ['userId', 'kind'],
      }),
    );

    // Partial unique: at most one manual source per user.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_csv_source_user_manual_uq"
       ON "csv_source" ("userId")
       WHERE kind = 'manual'`,
    );

    // Partial unique: no duplicate CSV contentHash per user.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_csv_source_user_content_hash_uq"
       ON "csv_source" ("userId", "contentHash")
       WHERE kind = 'csv' AND "contentHash" IS NOT NULL`,
    );

    // ─── 5. Truncate collection_card (pre-launch, no real data) ──────────
    await queryRunner.query(`TRUNCATE "collection_card"`);

    // ─── 6. Drop old (userId, cardIdentifier) unique index ───────────────
    // TypeORM names auto-generated indexes as UQ_{table}_{col1}_{col2}.
    // The index was declared via @Index(['userId','cardIdentifier'],{unique:true})
    // which TypeORM names as IDX_{hash} in practice. Use raw SQL to drop by
    // pattern to avoid name fragility across environments.
    await queryRunner.query(`
      DO $$
      DECLARE
        idx_name text;
      BEGIN
        SELECT indexname INTO idx_name
        FROM pg_indexes
        WHERE tablename = 'collection_card'
          AND indexdef LIKE '%userId%'
          AND indexdef LIKE '%cardIdentifier%'
          AND indexdef NOT LIKE '%sourceId%'
          AND indexdef LIKE '%UNIQUE%';
        IF idx_name IS NOT NULL THEN
          EXECUTE 'DROP INDEX IF EXISTS "' || idx_name || '"';
        END IF;
      END;
      $$
    `);

    // ─── 7. Add sourceId column to collection_card ────────────────────────
    // Added AFTER truncate + index drop so there are no rows to backfill
    // and no constraint violations during the migration. NOT NULL is safe
    // because the table is empty at this point.
    await queryRunner.addColumn(
      'collection_card',
      new TableColumn({
        name: 'sourceId',
        type: 'uuid',
        isNullable: false,
      }),
    );

    // ─── 8. FK: collection_card.sourceId → csv_source.id CASCADE DELETE ──
    await queryRunner.createForeignKey(
      'collection_card',
      new TableForeignKey({
        columnNames: ['sourceId'],
        referencedTableName: 'csv_source',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // ─── 9. New 3-column unique index on collection_card ─────────────────
    await queryRunner.createIndex(
      'collection_card',
      new TableIndex({
        name: 'IDX_collection_card_user_card_source_uq',
        columnNames: ['userId', 'cardIdentifier', 'sourceId'],
        isUnique: true,
      }),
    );

    // ─── 10. Index on sourceId for FK cascade lookups ────────────────────
    await queryRunner.createIndex(
      'collection_card',
      new TableIndex({
        name: 'IDX_collection_card_sourceId',
        columnNames: ['sourceId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse: drop sourceId column + indexes, restore old unique index,
    // then drop csv_source.

    // 1. Drop FK and indexes added to collection_card.
    await queryRunner.dropIndex(
      'collection_card',
      'IDX_collection_card_sourceId',
    );
    await queryRunner.dropIndex(
      'collection_card',
      'IDX_collection_card_user_card_source_uq',
    );

    // Drop the FK constraint on sourceId (find by column name).
    const table = await queryRunner.getTable('collection_card');
    const fk = table?.foreignKeys.find((f) =>
      f.columnNames.includes('sourceId'),
    );
    if (fk) {
      await queryRunner.dropForeignKey('collection_card', fk);
    }

    // 2. Drop sourceId column.
    await queryRunner.dropColumn('collection_card', 'sourceId');

    // 3. Restore old (userId, cardIdentifier) unique index.
    await queryRunner.createIndex(
      'collection_card',
      new TableIndex({
        name: 'IDX_collection_card_user_card_uq',
        columnNames: ['userId', 'cardIdentifier'],
        isUnique: true,
      }),
    );

    // 4. Drop csv_source (partial indexes, FK, check, table).
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_csv_source_user_content_hash_uq"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_csv_source_user_manual_uq"`,
    );
    await queryRunner.dropIndex('csv_source', 'IDX_csv_source_userId_kind');
    await queryRunner.dropIndex('csv_source', 'IDX_csv_source_userId');
    await queryRunner.dropCheckConstraint(
      'csv_source',
      'CHK_csv_source_kind_valid',
    );
    await queryRunner.dropTable('csv_source');
  }
}
