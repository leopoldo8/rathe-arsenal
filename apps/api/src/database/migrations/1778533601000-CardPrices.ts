import { MigrationInterface, QueryRunner } from 'typeorm';

// card_list.priceMultiplier already exists (CardLists migration), so this one only adds the shared price tables.
// IF NOT EXISTS: a database that ran with synchronize may already hold them.
export class CardPrices1778533601000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "card_price" (
        "productId" varchar(32) NOT NULL,
        "subType" varchar(32) NOT NULL,
        "marketPriceCents" int,
        "midPriceCents" int,
        "fetchedAt" timestamptz NOT NULL,
        PRIMARY KEY ("productId", "subType")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "card_price_group_sync" (
        "groupId" int PRIMARY KEY,
        "fetchedAt" timestamptz NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "card_price_group_sync"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "card_price"`);
  }
}
