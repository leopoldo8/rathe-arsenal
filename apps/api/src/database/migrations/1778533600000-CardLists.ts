import { MigrationInterface, QueryRunner } from 'typeorm';

// IF NOT EXISTS: a database that ran with synchronize may already hold these tables.
// A list never references a deck or the collection: creating one from a deck copies that moment's lines.
// card_list_line.createdAt orders the lines; the design's column list had none.
export class CardLists1778533600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "card_list" (
        "id" serial PRIMARY KEY,
        "userId" uuid NOT NULL,
        "kind" varchar(8) NOT NULL,
        "name" varchar(80) NOT NULL,
        "notes" text,
        "totalPriceCents" int,
        "priceMultiplier" numeric(4,2),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_card_list_kind_valid" CHECK ("kind" IN ('want', 'sell')),
        CONSTRAINT "CHK_card_list_total_price_valid" CHECK ("totalPriceCents" >= 0),
        CONSTRAINT "CHK_card_list_price_multiplier_valid" CHECK ("priceMultiplier" > 0 AND "priceMultiplier" <= 50),
        CONSTRAINT "FK_card_list_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_card_list_userId" ON "card_list" ("userId")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "card_list_line" (
        "id" serial PRIMARY KEY,
        "listId" int NOT NULL,
        "cardIdentifier" varchar NOT NULL,
        "quantity" int NOT NULL,
        "printing" varchar,
        "condition" varchar(4),
        "priceCents" int,
        "soldAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_card_list_line_quantity_valid" CHECK ("quantity" BETWEEN 1 AND 20),
        CONSTRAINT "CHK_card_list_line_condition_valid" CHECK ("condition" IN ('NM', 'LP', 'MP', 'HP', 'DMG')),
        CONSTRAINT "CHK_card_list_line_price_valid" CHECK ("priceCents" >= 0),
        CONSTRAINT "FK_card_list_line_listId" FOREIGN KEY ("listId") REFERENCES "card_list"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_card_list_line_listId" ON "card_list_line" ("listId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "card_list_line"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "card_list"`);
  }
}
