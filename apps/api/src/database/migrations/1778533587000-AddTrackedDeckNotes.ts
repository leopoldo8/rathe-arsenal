import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the free-text `notes` column to `tracked_deck` (EDIT-02). Nullable with
 * no default, so existing rows need no backfill and read back as NULL.
 */
export class AddTrackedDeckNotes1778533587000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tracked_deck" ADD COLUMN "notes" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tracked_deck" DROP COLUMN "notes"`);
  }
}
