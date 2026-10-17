import { MigrationInterface, QueryRunner } from 'typeorm';

const SOURCE_CHECK = 'CHK_tournament_deck_source_valid';

export class AddTournamentDeckSource1778533595000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_deck" ADD COLUMN "source" varchar(20) NOT NULL DEFAULT 'tournament'`);
    await queryRunner.query(`ALTER TABLE "tournament_deck" ADD CONSTRAINT "${SOURCE_CHECK}" CHECK ("source" IN ('tournament', 'player-named'))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "tournament_deck" WHERE "source" = 'player-named'`);
    await queryRunner.query(`ALTER TABLE "tournament_deck" DROP CONSTRAINT "${SOURCE_CHECK}"`);
    await queryRunner.query(`ALTER TABLE "tournament_deck" DROP COLUMN "source"`);
  }
}
