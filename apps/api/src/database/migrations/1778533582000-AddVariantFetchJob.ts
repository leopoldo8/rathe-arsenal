import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Creates `variant_fetch_job` — the DB-backed queue + progress store for
 * detail-page variant fetching (replaces the in-memory progress tracker).
 *
 * Note: the variant job processor upserts into `store_stock` on
 * (storeId, cardIdentifier). That unique index already exists as
 * `IDX_store_stock_store_card_unique` (migration 1744329600000-AddStoreTables),
 * so no new constraint is needed here.
 */
export class AddVariantFetchJob1778533582000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.createTable(
      new Table({
        name: 'variant_fetch_job',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          { name: 'userId', type: 'uuid' },
          { name: 'deckId', type: 'int' },
          { name: 'storeId', type: 'int' },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: `'pending'`,
          },
          {
            name: 'cards',
            type: 'jsonb',
            default: `'[]'`,
          },
          { name: 'total', type: 'int', default: 0 },
          { name: 'completed', type: 'int', default: 0 },
          { name: 'failed', type: 'int', default: 0 },
          {
            name: 'enqueuedAt',
            type: 'timestamptz',
            default: 'now()',
          },
          { name: 'startedAt', type: 'timestamptz', isNullable: true },
          { name: 'finishedAt', type: 'timestamptz', isNullable: true },
          { name: 'claimedAt', type: 'timestamptz', isNullable: true },
          {
            name: 'claimedBy',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          { name: 'error', type: 'text', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'variant_fetch_job',
      new TableIndex({
        name: 'IDX_vfj_status_enqueued',
        columnNames: ['status', 'enqueuedAt'],
      }),
    );
    await queryRunner.createIndex(
      'variant_fetch_job',
      new TableIndex({
        name: 'IDX_vfj_user_status',
        columnNames: ['userId', 'status'],
      }),
    );
    await queryRunner.createIndex(
      'variant_fetch_job',
      new TableIndex({
        name: 'IDX_vfj_deck_status',
        columnNames: ['deckId', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('variant_fetch_job', true);
  }
}
