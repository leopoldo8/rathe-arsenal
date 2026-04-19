import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * U12 — adds `preferences` JSONB column to the `user` table with a column-level
 * default of `'{"theme":"dark"}'::jsonb`.
 *
 * The column-level default ensures all existing rows (including live dev accounts)
 * receive the value without an explicit UPDATE. The narrow closed-schema
 * (`theme: 'dark' | 'light'`) is enforced at the DTO layer; TypeORM stores the
 * raw JSONB blob without further validation.
 *
 * Timestamp = U9 timestamp (1776621085000) + 2000ms = 1776621087000.
 * Per §Key Technical Decisions, +1000ms spacing ensures deterministic TypeORM
 * migration execution order.
 *
 * down() drops the column — only safe at pre-launch scale where preference
 * data is not yet business-critical.
 */
export class AddUserSettings1776621087000 implements MigrationInterface {
  name = 'AddUserSettings1776621087000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "preferences" jsonb NOT NULL DEFAULT '{"theme":"dark"}'::jsonb
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user" DROP COLUMN IF EXISTS "preferences"
    `);
  }
}
