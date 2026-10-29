import { MigrationInterface, QueryRunner } from 'typeorm';

// Door 14: e-mail addresses are stored lowercased and unique on the lowercased value.
// No merge rule exists for two accounts whose addresses differ only by case, so the migration
// stops and names them; nothing is changed until the owner has dealt with each pair.
// IF NOT EXISTS: a database that ran with synchronize may already hold the index.
export class LowercaseUserEmails1778533602000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const collisions: { email: string; ids: string[] }[] = await queryRunner.query(`
      SELECT lower("email") AS "email", array_agg("id"::text ORDER BY "createdAt", "id") AS "ids"
        FROM "user"
       GROUP BY lower("email")
      HAVING count(*) > 1
    `);
    if (collisions.length > 0) {
      const lines = collisions.map((row) => `${row.email}: ${row.ids.join(', ')}`);
      throw new Error(
        `Cannot lowercase user e-mails: these addresses collide once lowercased (user ids listed). ` +
          `Resolve each pair, then run the migration again.\n${lines.join('\n')}`,
      );
    }

    await queryRunner.query(`UPDATE "user" SET "email" = lower("email") WHERE "email" <> lower("email")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_email_lower" ON "user" (lower("email"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The original casing is not kept, so the addresses stay lowercase.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_email_lower"`);
  }
}
