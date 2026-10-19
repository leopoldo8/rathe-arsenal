/**
 * Runs the ShareLinks migration on a throwaway schema holding the old sharing tables, to prove that
 * a token handed out before the rework survives as a deck-intent link and that `down` restores it.
 * Needs a real PostgreSQL DB (DATABASE_URL); nothing outside the throwaway schema is touched.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { ShareLinks1778533599000 } from '../database/migrations/1778533599000-ShareLinks';

const OWNER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';
const SHARED_TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const SCHEMA = `share_links_migration_${Date.now().toString(36)}`;

describe('ShareLinks migration (E2E)', () => {
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
    await runner.query(`CREATE TABLE "user" ("id" uuid PRIMARY KEY)`);
    await runner.query(`
      CREATE TABLE "tracked_deck" (
        "id" serial PRIMARY KEY,
        "userId" uuid NOT NULL,
        "shareToken" varchar(32),
        "shareShowsContact" boolean NOT NULL DEFAULT true
      )`);
    await runner.query(`CREATE UNIQUE INDEX "IDX_tracked_deck_shareToken" ON "tracked_deck" ("shareToken")`);
    await runner.query(`
      CREATE TABLE "share_image" (
        "id" serial PRIMARY KEY,
        "targetKind" varchar(8) NOT NULL,
        "targetId" int NOT NULL,
        "contentHash" varchar(64) NOT NULL,
        "cardIdentifiers" text[] NOT NULL,
        "jpeg" bytea NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await runner.query(`CREATE UNIQUE INDEX "IDX_share_image_target" ON "share_image" ("targetKind", "targetId")`);
    await runner.query(`CREATE TABLE "share_event" ("id" bigserial PRIMARY KEY, "kind" varchar(16) NOT NULL)`);
    await runner.query(`INSERT INTO "user" ("id") VALUES ($1), ($2)`, [OWNER_ID, OTHER_ID]);
    await runner.query(
      `INSERT INTO "tracked_deck" ("userId", "shareToken", "shareShowsContact") VALUES ($1, $2, false), ($3, NULL, true)`,
      [OWNER_ID, SHARED_TOKEN, OTHER_ID],
    );
    await runner.query(
      `INSERT INTO "share_image" ("targetKind", "targetId", "contentHash", "cardIdentifiers", "jpeg")
       VALUES ('deck', 1, 'h', '{a}', '\\x00')`,
    );
  });

  afterAll(async () => {
    await runner?.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await runner?.release();
    await dataSource?.destroy();
  });

  it('keeps a shared deck link alive as a deck-intent link and drops the old image', async () => {
    await new ShareLinks1778533599000().up(runner);

    const links = await runner.query(`SELECT "token", "targetKind", "targetId", "intent", "ownerUserId", "showsContact" FROM "share_link"`);
    expect(links).toEqual([
      { token: SHARED_TOKEN, targetKind: 'deck', targetId: 1, intent: 'deck', ownerUserId: OWNER_ID, showsContact: false },
    ]);
    expect(await runner.query(`SELECT 1 FROM "share_image"`)).toHaveLength(0);
    const columns = await runner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'tracked_deck'`,
      [SCHEMA],
    );
    expect(columns.map((row: { column_name: string }) => row.column_name)).not.toContain('shareToken');
  });

  it('puts the deck token back on the deck row when reverted', async () => {
    await runner.query(
      `INSERT INTO "share_link" ("token", "targetKind", "targetId", "intent", "ownerUserId") VALUES ('ZzZzZzZzZzZzZzZzZzZzZz', 'deck', 1, 'missing', $1)`,
      [OWNER_ID],
    );

    await new ShareLinks1778533599000().down(runner);

    const decks = await runner.query(`SELECT "id", "shareToken", "shareShowsContact" FROM "tracked_deck" ORDER BY "id"`);
    expect(decks).toEqual([
      { id: 1, shareToken: SHARED_TOKEN, shareShowsContact: false },
      { id: 2, shareToken: null, shareShowsContact: true },
    ]);
  });
});
