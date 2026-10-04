import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddStoreUrlSyncError1778533589000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('store', [
      new TableColumn({ name: 'lastUrlSyncError', type: 'text', isNullable: true }),
      new TableColumn({ name: 'lastUrlSyncErrorAt', type: 'timestamptz', isNullable: true }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('store', ['lastUrlSyncError', 'lastUrlSyncErrorAt']);
  }
}
