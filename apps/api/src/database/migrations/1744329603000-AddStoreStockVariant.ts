import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Variant-aware shopping line — Unit 1
 *
 * Creates the store_stock_variant table which stores per-variant stock data
 * fetched from detail pages (user-triggered). One row per
 * (storeId, cardIdentifier, edition, condition, finish) tuple.
 *
 * Key design points:
 *   - Composite unique index enables atomic upsert without delete-then-insert.
 *   - Non-unique index on (storeId, cardIdentifier) enables efficient per-card
 *     variant lookups used by the shopping line query.
 *   - storeId FK with CASCADE: deleting a store cleans up all variant rows.
 *   - listingPriceCentsSnapshot is nullable to accommodate "Sob consulta" cards
 *     whose listing row has priceCents = null.
 *   - No FK to store_stock — variant rows reference cards conceptually but are
 *     persisted independently for clean separation of concerns.
 */
export class AddStoreStockVariant1744329603000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'store_stock_variant',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'storeId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'cardIdentifier',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 'edition',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'condition',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'finish',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'priceCents',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'quantity',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'detailFetchedAt',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            // Nullable: listing row may have priceCents = null for "Sob consulta" cards.
            name: 'listingPriceCentsSnapshot',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'listingQuantitySnapshot',
            type: 'int',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['storeId'],
            referencedTableName: 'store',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Composite unique index — enables atomic upsert on (storeId, cardIdentifier,
    // edition, condition, finish) without a preceding DELETE.
    await queryRunner.createIndex(
      'store_stock_variant',
      new TableIndex({
        name: 'IDX_store_stock_variant_unique',
        columnNames: ['storeId', 'cardIdentifier', 'edition', 'condition', 'finish'],
        isUnique: true,
      }),
    );

    // Non-unique index for per-card variant lookups used by ShoppingLineService.
    await queryRunner.createIndex(
      'store_stock_variant',
      new TableIndex({
        name: 'IDX_store_stock_variant_store_card',
        columnNames: ['storeId', 'cardIdentifier'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'store_stock_variant',
      'IDX_store_stock_variant_store_card',
    );
    await queryRunner.dropIndex(
      'store_stock_variant',
      'IDX_store_stock_variant_unique',
    );
    await queryRunner.dropTable('store_stock_variant');
  }
}
