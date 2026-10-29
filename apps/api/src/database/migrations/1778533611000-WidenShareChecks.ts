import { MigrationInterface, QueryRunner } from 'typeorm';

const LINK_INTENT = 'CHK_share_link_intent_valid';
const EVENT_KIND = 'CHK_share_event_kind_valid';
const EVENT_INTENT = 'CHK_share_event_intent_valid';
const REFERRED_VIA = 'CHK_user_referred_via_valid';

async function replaceCheck(queryRunner: QueryRunner, table: string, name: string, expression: string): Promise<void> {
  await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${name}"`);
  await queryRunner.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${name}" CHECK (${expression})`);
}

// Door 11: the `quote` intent and the `offer`, `quote_sent` and `buy` events, in one migration.
// Door 12 (the part journey 4 needs): `user.shareClosingLine`, the last closing line the owner sent.
export class WidenShareChecks1778533611000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await replaceCheck(queryRunner, 'share_link', LINK_INTENT, `"intent" IN ('deck', 'missing', 'want', 'sell', 'quote')`);
    await replaceCheck(
      queryRunner,
      'share_event',
      EVENT_KIND,
      `"kind" IN ('created', 'opened', 'signed_up', 'offer', 'quote_sent', 'buy')`,
    );
    await replaceCheck(
      queryRunner,
      'share_event',
      EVENT_INTENT,
      `"intent" IS NULL OR "intent" IN ('deck', 'missing', 'want', 'sell', 'quote')`,
    );
    await replaceCheck(queryRunner, 'user', REFERRED_VIA, `"referredVia" IN ('deck', 'want', 'sell', 'quote')`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "shareClosingLine" varchar(140)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "shareClosingLine"`);
    await queryRunner.query(`DELETE FROM "share_link" WHERE "intent" = 'quote'`);
    await queryRunner.query(`DELETE FROM "share_event" WHERE "kind" IN ('offer', 'quote_sent', 'buy') OR "intent" = 'quote'`);
    await queryRunner.query(`UPDATE "user" SET "referredVia" = NULL WHERE "referredVia" = 'quote'`);
    await replaceCheck(queryRunner, 'share_link', LINK_INTENT, `"intent" IN ('deck', 'missing', 'want', 'sell')`);
    await replaceCheck(queryRunner, 'share_event', EVENT_KIND, `"kind" IN ('created', 'opened', 'signed_up')`);
    await replaceCheck(
      queryRunner,
      'share_event',
      EVENT_INTENT,
      `"intent" IS NULL OR "intent" IN ('deck', 'missing', 'want', 'sell')`,
    );
    await replaceCheck(queryRunner, 'user', REFERRED_VIA, `"referredVia" IN ('deck', 'want', 'sell')`);
  }
}
