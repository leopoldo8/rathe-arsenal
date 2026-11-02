import { MigrationInterface, QueryRunner } from 'typeorm';

// Public player decks read from Fabrary, the usage signal's fallback for heroes and formats with too few
// tournament decks (AD-029). IF NOT EXISTS throughout: a service running with `synchronize` may have
// created these tables before this migration runs.
export class AddPublicDecks1778533615000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "public_deck" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "fabraryUlid" varchar(26) NOT NULL,
        "heroIdentifier" varchar(128) NOT NULL,
        "format" varchar(64) NOT NULL,
        "authorKey" varchar(64) NOT NULL,
        "deckUpdatedAt" timestamptz NOT NULL,
        "fetchedAt" timestamptz NOT NULL
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_public_deck_fabrary_ulid" ON "public_deck" ("fabraryUlid")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_public_deck_hero_format" ON "public_deck" ("heroIdentifier", "format")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "public_deck_card" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "publicDeckId" uuid NOT NULL REFERENCES "public_deck" ("id") ON DELETE CASCADE,
        "cardIdentifier" varchar(128) NOT NULL,
        "quantity" int NOT NULL
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_public_deck_card_deck_card" ON "public_deck_card" ("publicDeckId", "cardIdentifier")`,
    );
    await queryRunner.query(`ALTER TABLE "public_deck_card" DROP CONSTRAINT IF EXISTS "CHK_public_deck_card_quantity"`);
    await queryRunner.query(`ALTER TABLE "public_deck_card" ADD CONSTRAINT "CHK_public_deck_card_quantity" CHECK ("quantity" BETWEEN 1 AND 99)`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "public_deck_refresh" (
        "heroIdentifier" varchar(128) NOT NULL,
        "format" varchar(64) NOT NULL,
        "refreshedAt" timestamptz NOT NULL,
        "decks" int NOT NULL,
        PRIMARY KEY ("heroIdentifier", "format")
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "public_deck_refresh"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public_deck_card"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public_deck"`);
  }
}
