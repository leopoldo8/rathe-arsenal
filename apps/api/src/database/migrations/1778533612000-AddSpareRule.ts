import { MigrationInterface, QueryRunner } from 'typeorm';

// Door 12: the spare rule and the seller's closing line. `shareClosingLine` already came with
// 1778533611000 (journey 4 needed it first), so it is added only where it is missing and
// removed with the others on down.
export class AddSpareRule1778533612000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "spareRule" varchar(16) NULL`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "CHK_user_spare_rule_valid"`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "CHK_user_spare_rule_valid" CHECK ("spareRule" IS NULL OR "spareRule" IN ('within_format', 'any_deck', 'per_deck'))`,
    );
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "sellClosingLine" varchar(140) NULL`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "shareClosingLine" varchar(140) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "shareClosingLine"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "sellClosingLine"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "CHK_user_spare_rule_valid"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "spareRule"`);
  }
}
