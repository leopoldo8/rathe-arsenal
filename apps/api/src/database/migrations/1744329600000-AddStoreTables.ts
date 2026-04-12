import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Phase 1b Unit 1 — creates the three store-data tables:
 *   - store:            one row per allow-listed store (R30, R31)
 *   - store_stock:      latest scraped stock per (store, cardIdentifier) (R32)
 *   - store_scrape_run: audit trail + soft lock + delta-guard history (R33)
 *
 * Cúpula DT is seeded by the immediately following migration (SeedCupulaDt).
 *
 * Note on consentArtifact: the Gate 2 consent artifact is documented in
 * docs/brainstorms/gates/gate-2-cupula-dt-consent-and-accuracy.md and is
 * referenced via COMMENT ON TABLE rather than a dedicated column, to avoid
 * exposing internal artifact paths in the schema itself.
 */
export class AddStoreTables1744329600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------ store
    await queryRunner.createTable(
      new Table({
        name: 'store',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'slug',
            type: 'varchar',
            length: '100',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'baseUrl',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'listingPath',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'rateLimitMs',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'lastScrapedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'lastFetchedAt',
            type: 'timestamptz',
            isNullable: true,
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

    // Consent artifact reference lives in a table comment, not a column.
    await queryRunner.query(
      `COMMENT ON TABLE store IS 'Consent artifacts for each store are documented in docs/brainstorms/gates/. See gate-2-cupula-dt-consent-and-accuracy.md for Cúpula DT.'`,
    );

    // ----------------------------------------------------------- store_stock
    await queryRunner.createTable(
      new Table({
        name: 'store_stock',
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
            name: 'priceCents',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'quantity',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'productUrl',
            type: 'varchar',
            length: '1000',
            isNullable: false,
          },
          {
            name: 'productNameRaw',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'lastFetchedAt',
            type: 'timestamptz',
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

    await queryRunner.createIndex(
      'store_stock',
      new TableIndex({
        name: 'IDX_store_stock_store_card_unique',
        columnNames: ['storeId', 'cardIdentifier'],
        isUnique: true,
      }),
    );

    // ------------------------------------------------------ store_scrape_run
    await queryRunner.query(
      `CREATE TYPE store_scrape_run_status_enum AS ENUM ('running', 'completed', 'failed', 'paused_delta_guard')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'store_scrape_run',
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
            name: 'startedAt',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'finishedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'productsFetched',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'productsMatched',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'productsUnmatched',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'rowsUpserted',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'rowsZeroed',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'deltaPercent',
            type: 'numeric',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'status',
            type: 'store_scrape_run_status_enum',
            default: `'running'`,
            isNullable: false,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'forcedOverride',
            type: 'boolean',
            default: false,
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

    await queryRunner.createIndex(
      'store_scrape_run',
      new TableIndex({
        name: 'IDX_store_scrape_run_store_started',
        columnNames: ['storeId', 'startedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'store_scrape_run',
      'IDX_store_scrape_run_store_started',
    );
    await queryRunner.dropTable('store_scrape_run');
    await queryRunner.query(`DROP TYPE IF EXISTS store_scrape_run_status_enum`);

    await queryRunner.dropIndex(
      'store_stock',
      'IDX_store_stock_store_card_unique',
    );
    await queryRunner.dropTable('store_stock');

    // Drop store last — store_stock and store_scrape_run have FK references to it.
    // The COMMENT ON TABLE is implicitly dropped when the table is dropped.
    await queryRunner.dropTable('store');
  }
}
