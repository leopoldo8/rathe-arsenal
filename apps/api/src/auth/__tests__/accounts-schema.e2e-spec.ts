/**
 * The account doors in the database (14 and 15): what the schema refuses, and what the
 * lowercase migration does with colliding addresses. Needs DATABASE_URL.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { LowercaseUserEmails1778533602000 } from '../../database/migrations/1778533602000-LowercaseUserEmails';
import { AddUserSession1778533604000 } from '../../database/migrations/1778533604000-AddUserSession';
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

  it('session token hashes are unique', async () => {
    const email = ctx.emailFor('schema-session');
    const [user] = await ctx.dataSource.query(`INSERT INTO "user" ("email", "passwordHash") VALUES ($1, NULL) RETURNING "id"`, [email]);
    const insert = (hash: string): Promise<unknown> =>
      ctx.dataSource.query(`INSERT INTO "user_session" ("userId", "tokenHash") VALUES ($1, $2)`, [user.id, hash.repeat(64).slice(0, 64)]);

    await expect(insert('a')).resolves.toBeDefined();
    await expect(insert('a')).rejects.toThrow(/IDX_user_session_token_hash/);
    await expect(insert('b')).resolves.toBeDefined();

    await ctx.dataSource.query(`DELETE FROM "user" WHERE "id" = $1`, [user.id]);
    const [left] = await ctx.dataSource.query(`SELECT count(*)::int AS n FROM "user_session" WHERE "userId" = $1`, [user.id]);
    expect(left.n).toBe(0);
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

  describe('user_session migration', () => {
    const SCHEMA = `user_session_${Date.now().toString(36)}`;
    const OWNER = '44444444-4444-4444-4444-444444444444';
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
      // `public` stays on the path for `uuid_generate_v4()`; the new schema comes first so the tables land in it.
      await runner.query(`SET search_path TO "${SCHEMA}", public`);
      await runner.query(`CREATE TABLE "user" ("id" uuid PRIMARY KEY)`);
      await runner.query(`INSERT INTO "user" ("id") VALUES ($1)`, [OWNER]);
    });

    afterAll(async () => {
      await runner?.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
      await runner?.release();
      await dataSource?.destroy();
    });

    it('creates the table the entity expects, can run twice, and goes away on down', async () => {
      await new AddUserSession1778533604000().up(runner);
      await new AddUserSession1778533604000().up(runner);

      await runner.query(`INSERT INTO "user_session" ("userId", "tokenHash") VALUES ($1, $2)`, [OWNER, 'a'.repeat(64)]);
      await expect(
        runner.query(`INSERT INTO "user_session" ("userId", "tokenHash") VALUES ($1, $2)`, [OWNER, 'a'.repeat(64)]),
      ).rejects.toThrow(/IDX_user_session_token_hash/);
      const [row] = await runner.query(`SELECT "lastSeenAt", "revokedAt" FROM "user_session"`);
      expect(row.lastSeenAt).toBeInstanceOf(Date);
      expect(row.revokedAt).toBeNull();
      await runner.query(`DELETE FROM "user" WHERE "id" = $1`, [OWNER]);
      expect(await runner.query(`SELECT 1 FROM "user_session"`)).toEqual([]);

      await new AddUserSession1778533604000().down(runner);
      // Qualified: the real `public.user_session` of this database is still on the search path.
      const [after] = await runner.query(`SELECT to_regclass('"${SCHEMA}"."user_session"') AS "name"`);
      expect(after.name).toBeNull();
    });
  });
});
