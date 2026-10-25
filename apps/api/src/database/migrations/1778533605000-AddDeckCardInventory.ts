import { MigrationInterface, QueryRunner } from 'typeorm';

// Door 3: a deck line carries the copies taken to the tournament outside the starting deck, next to
// its deck quantity. Every existing row reads 0, and the Fabrary `sideboardQuantity` that imports
// used to drop is stored here from now on. A line must hold at least one copy on either side.
// IF NOT EXISTS and the constraint lookup: a database that ran with synchronize may already hold
// the column and the check.
const CHECK_NAME = 'CHK_deck_card_quantities';

export class AddDeckCardInventory1778533605000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deck_card" ADD COLUMN IF NOT EXISTS "inventoryQuantity" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`ALTER TABLE "deck_card" DROP CONSTRAINT IF EXISTS "${CHECK_NAME}"`);
    await queryRunner.query(
      `ALTER TABLE "deck_card" ADD CONSTRAINT "${CHECK_NAME}"
       CHECK (quantity >= 0 AND "inventoryQuantity" >= 0 AND quantity + "inventoryQuantity" > 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deck_card" DROP CONSTRAINT IF EXISTS "${CHECK_NAME}"`);
    await queryRunner.query(`ALTER TABLE "deck_card" DROP COLUMN IF EXISTS "inventoryQuantity"`);
  }
}
