import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds the on-demand URL-sync trigger columns to `store`:
 * - lastUrlSyncProductCount: products fetched by the last completed sync (status)
 * - urlSyncRequestedAt: set when the owner queues a sync; cleared when claimed
 * - urlSyncRunningAt: set while the worker runs a claimed sync (claim lock)
 */
export class AddStoreUrlSyncTrigger1778533584000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('store', [
      new TableColumn({ name: 'lastUrlSyncProductCount', type: 'int', isNullable: true }),
      new TableColumn({ name: 'urlSyncRequestedAt', type: 'timestamptz', isNullable: true }),
      new TableColumn({ name: 'urlSyncRunningAt', type: 'timestamptz', isNullable: true }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('store', [
      'lastUrlSyncProductCount',
      'urlSyncRequestedAt',
      'urlSyncRunningAt',
    ]);
  }
}
