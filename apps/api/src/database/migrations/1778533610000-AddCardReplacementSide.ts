import { MigrationInterface, QueryRunner } from 'typeorm';

const SIDE_CHECK = 'CHK_card_replacement_side_valid';

// Door 2: a pick moves copies from one side of the deck. A row written before this reads `deck`.
export class AddCardReplacementSide1778533610000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "card_replacement" ADD COLUMN IF NOT EXISTS "side" varchar NOT NULL DEFAULT 'deck'`);
    await queryRunner.query(`ALTER TABLE "card_replacement" DROP CONSTRAINT IF EXISTS "${SIDE_CHECK}"`);
    await queryRunner.query(`ALTER TABLE "card_replacement" ADD CONSTRAINT "${SIDE_CHECK}" CHECK ("side" IN ('deck', 'inventory'))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "card_replacement" DROP CONSTRAINT IF EXISTS "${SIDE_CHECK}"`);
    await queryRunner.query(`ALTER TABLE "card_replacement" DROP COLUMN IF EXISTS "side"`);
  }
}
