import { MigrationInterface, QueryRunner } from 'typeorm';

// Door 15, addition by S40: the e-mailed code that guards a password change lives beside the
// sign-in codes, told apart by `purpose`, so one per-address limit counts both.
export class AddSignInCodePurpose1778533613000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sign_in_code" ADD COLUMN IF NOT EXISTS "purpose" varchar(16) NOT NULL DEFAULT 'sign_in'`);
    await queryRunner.query(`ALTER TABLE "sign_in_code" DROP CONSTRAINT IF EXISTS "CHK_sign_in_code_purpose_valid"`);
    await queryRunner.query(
      `ALTER TABLE "sign_in_code" ADD CONSTRAINT "CHK_sign_in_code_purpose_valid" CHECK ("purpose" IN ('sign_in', 'password'))`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sign_in_code_one_live"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_sign_in_code_one_live" ON "sign_in_code" ("email", "purpose") WHERE "consumedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "sign_in_code" WHERE "purpose" <> 'sign_in'`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sign_in_code_one_live"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_sign_in_code_one_live" ON "sign_in_code" ("email") WHERE "consumedAt" IS NULL`);
    await queryRunner.query(`ALTER TABLE "sign_in_code" DROP CONSTRAINT IF EXISTS "CHK_sign_in_code_purpose_valid"`);
    await queryRunner.query(`ALTER TABLE "sign_in_code" DROP COLUMN IF EXISTS "purpose"`);
  }
}
