/**
 * The account doors in the database (14 and 15): what the schema refuses, and what the
 * lowercase migration does with colliding addresses. Needs DATABASE_URL.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { LowercaseUserEmails1778533602000 } from '../../database/migrations/1778533602000-LowercaseUserEmails';
import { bootAccountsApp, IAccountsApp } from './accounts-e2e.fixture';

describe('Accounts schema (E2E, S30 and S31)', () => {
  let ctx: IAccountsApp;

  beforeAll(async () => {
    ctx = await bootAccountsApp();
  });

  afterAll(async () => {
    await ctx?.close();
    jest.clearAllMocks();
  });

  it('user columns enforce the account doors', async () => {
    const email = ctx.emailFor('schema');
    const upper = email.replace('acct-schema', 'ACCT-Schema');
    const insert = (address: string, returnPath: string | null = null): Promise<unknown> =>
      ctx.dataSource.query(`INSERT INTO "user" ("email", "passwordHash", "signupReturnPath") VALUES ($1, NULL, $2)`, [address, returnPath]);

    await expect(insert(email)).resolves.toBeDefined();
    await expect(insert(upper)).rejects.toThrow(/IDX_user_email_lower/);
    await expect(insert(ctx.emailFor('schema-200'), `/${'a'.repeat(199)}`)).resolves.toBeDefined();
    await expect(insert(ctx.emailFor('schema-201'), `/${'a'.repeat(200)}`)).rejects.toThrow(/too long|value too long/i);
  });

  it('one live sign-in code per address', async () => {
    const email = ctx.emailFor('schema-live');
    const insert = (consumed: boolean, hash: string): Promise<unknown> =>
      ctx.dataSource.query(
        `INSERT INTO "sign_in_code" ("email", "codeHash", "buttonTokenHash", "expiresAt", "consumedAt")
         VALUES ($1, $2, $3, now() + interval '15 minutes', ${consumed ? 'now()' : 'NULL'})`,
        [email, hash.repeat(64).slice(0, 64), `${hash}`.repeat(64).slice(0, 64).replace(/^./, hash)],
      );

    await expect(insert(false, 'a')).resolves.toBeDefined();
    await expect(insert(false, 'b')).rejects.toThrow(/IDX_sign_in_code_one_live/);
    await expect(insert(true, 'c')).resolves.toBeDefined();
    await expect(insert(true, 'd')).resolves.toBeDefined();
  });

  describe('lowercase migration', () => {
    const SCHEMA = `lowercase_emails_${Date.now().toString(36)}`;
    const ANA_UPPER = '11111111-1111-1111-1111-111111111111';
    const ANA_LOWER = '22222222-2222-2222-2222-222222222222';
    const BIA = '33333333-3333-3333-3333-333333333333';
    let dataSource: DataSource;
    let runner: QueryRunner;

    beforeAll(async () => {
      dataSource = new DataSource({
        type: 'postgres',
        url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal',
      });
      await dataSource.initialize();
      runner = dataSource.createQueryRunner();
      await runner.query(`CREATE SCHEMA "${SCHEMA}"`);
      await runner.query(`SET search_path TO "${SCHEMA}"`);
      await runner.query(
        `CREATE TABLE "user" ("id" uuid PRIMARY KEY, "email" varchar(255) NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now())`,
      );
      await runner.query(`CREATE UNIQUE INDEX "IDX_user_email" ON "user" ("email")`);
    });

    afterAll(async () => {
      await runner?.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
      await runner?.release();
      await dataSource?.destroy();
    });

    it('the lowercase migration aborts on a collision and lists the ids', async () => {
      await runner.query(`INSERT INTO "user" ("id", "email") VALUES ($1, 'Ana@x.com'), ($2, 'ana@x.com')`, [ANA_UPPER, ANA_LOWER]);

      const run = new LowercaseUserEmails1778533602000().up(runner);

      await expect(run).rejects.toThrow(new RegExp(`${ANA_UPPER}[\\s\\S]*${ANA_LOWER}|${ANA_LOWER}[\\s\\S]*${ANA_UPPER}`));
      const rows = await runner.query(`SELECT "id", "email" FROM "user" ORDER BY "id"`);
      expect(rows).toEqual([
        { id: ANA_UPPER, email: 'Ana@x.com' },
        { id: ANA_LOWER, email: 'ana@x.com' },
      ]);

      await runner.query(`DELETE FROM "user"`);
      await runner.query(`INSERT INTO "user" ("id", "email") VALUES ($1, 'Bia@Gmail.com')`, [BIA]);
      await new LowercaseUserEmails1778533602000().up(runner);
      const [bia] = await runner.query(`SELECT "email" FROM "user" WHERE "id" = $1`, [BIA]);
      expect(bia.email).toBe('bia@gmail.com');
    });
  });
});
