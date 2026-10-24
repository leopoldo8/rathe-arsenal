import { MigrationInterface, QueryRunner } from 'typeorm';

// Doors 14 and 15: an account may have no password, the page it was made from is kept on the
// server, and sign-in codes live in their own table. IF NOT EXISTS: a database that ran with
// synchronize may already hold them.
export class OptionalPasswordAndSignInCodes1778533603000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "passwordHash" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "signupReturnPath" varchar(200)`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sign_in_code" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar(255) NOT NULL,
        "codeHash" varchar(64) NOT NULL,
        "buttonTokenHash" varchar(64) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "attempts" int NOT NULL DEFAULT 0,
        "consumedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sign_in_code_one_live" ON "sign_in_code" ("email") WHERE "consumedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sign_in_code_button_token" ON "sign_in_code" ("buttonTokenHash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sign_in_code"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "signupReturnPath"`);
    // Accounts with no password cannot go back under NOT NULL; they get a hash no password produces.
    await queryRunner.query(
      `UPDATE "user" SET "passwordHash" = '$2b$12$' || repeat('x', 53) WHERE "passwordHash" IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "passwordHash" SET NOT NULL`);
  }
}
