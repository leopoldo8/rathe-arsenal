import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds `store.lastUrlSyncAt` — the timestamp of the last completed URL/name
 * sync. The variant queue worker reads this on boot to decide whether the
 * sync interval has elapsed, so a redeploy within the interval skips the full
 * catalog re-scrape instead of repeating it on every restart.
 */
export class AddStoreLastUrlSyncAt1778533583000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'store',
      new TableColumn({
        name: 'lastUrlSyncAt',
        type: 'timestamptz',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('store', 'lastUrlSyncAt');
  }
}
