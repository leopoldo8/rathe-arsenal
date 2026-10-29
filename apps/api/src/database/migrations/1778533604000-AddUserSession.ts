import { MigrationInterface, QueryRunner } from 'typeorm';

// Door 17: a session the server can end. The cookie holds an opaque token and this table holds its
// sha256. Every JWT issued before this migration stops working, so each player signs in once more.
// IF NOT EXISTS: a database that ran with synchronize may already hold the table.
export class AddUserSession1778533604000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_session" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tokenHash" varchar(64) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "lastSeenAt" timestamptz NOT NULL DEFAULT now(),
        "revokedAt" timestamptz,
        CONSTRAINT "FK_user_session_userId" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_session_token_hash" ON "user_session" ("tokenHash")`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_session_user" ON "user_session" ("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_session"`);
  }
}
