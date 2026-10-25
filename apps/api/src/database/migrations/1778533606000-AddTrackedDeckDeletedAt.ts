import { MigrationInterface, QueryRunner } from 'typeorm';

// Door 4: a deck is soft-deleted and kept 30 days. Every existing row reads null (not deleted).
// IF NOT EXISTS: a database that ran with synchronize may already hold the column.
export class AddTrackedDeckDeletedAt1778533606000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tracked_deck" ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tracked_deck" DROP COLUMN IF EXISTS "deletedAt"`);
  }
}
