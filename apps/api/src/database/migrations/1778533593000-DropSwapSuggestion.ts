import { MigrationInterface, QueryRunner } from 'typeorm';
import { ReplaceSubstituteDecisionWithSwapSuggestion1778533586000 } from './1778533586000-ReplaceSubstituteDecisionWithSwapSuggestion';

const PICKED_FROM_CHECK = 'CHK_card_replacement_picked_from_valid';

const ORIGINS_BEFORE = ['very_close', 'close', 'other_pitch', 'generic', 'search', 'recommendation'] as const;
const ORIGINS_AFTER = [...ORIGINS_BEFORE, 'suggested'] as const;

async function replacePickedFromCheck(queryRunner: QueryRunner, values: readonly string[]): Promise<void> {
  await queryRunner.query(`ALTER TABLE "card_replacement" DROP CONSTRAINT IF EXISTS "${PICKED_FROM_CHECK}"`);
  await queryRunner.query(
    `ALTER TABLE "card_replacement" ADD CONSTRAINT "${PICKED_FROM_CHECK}" CHECK ("pickedFrom" IN (${values
      .map((value) => `'${value}'`)
      .join(', ')}))`,
  );
}

/** Swaps merge into card alternatives (AD-012): every swap row is discarded and every snapshot is recomputed on its next read. */
export class DropSwapSuggestion1778533593000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "swap_suggestion" CASCADE`);
    await queryRunner.query(`TRUNCATE "deck_readiness_snapshot"`);
    await replacePickedFromCheck(queryRunner, ORIGINS_AFTER);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      `SELECT count(*)::int AS count FROM "card_replacement" WHERE "pickedFrom" = 'suggested'`,
    )) as [{ count: number }];
    if (count > 0) {
      throw new Error(`card_replacement holds ${count} used suggestion(s); the six-value CHECK would reject them.`);
    }
    await replacePickedFromCheck(queryRunner, ORIGINS_BEFORE);
    await new ReplaceSubstituteDecisionWithSwapSuggestion1778533586000().up(queryRunner);
  }
}
