import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';

// Door 1: a copy says which printing, edition, finish and condition it is. Four varchar columns on
// `collection_card` and `card_list_line`, `''` meaning "Não sei". The collection's unique key grows
// from three columns to seven, all not null, so the increment's ON CONFLICT also fires for copies with
// no version. The sell lines' single `printing` key is split into the four fields; the column itself
// stays until the slice that moves the sell lines onto the four fields stops writing it.
// IF NOT EXISTS, DROP IF EXISTS and the index lookup by columns: a database that ran with synchronize
// may already hold the columns, the checks and an index under a generated name.

const NEW_INDEX = 'IDX_collection_card_user_card_source_version_uq';
const COLLECTION_KEY = ['userId', 'cardIdentifier', 'sourceId', 'printingCode', 'edition', 'finish', 'condition'];
const OLD_KEY = ['userId', 'cardIdentifier', 'sourceId'];

const EDITION_VALUES = `'', 'first', 'unlimited', 'alpha'`;
const FINISH_VALUES = `'', 'none', 'rainbow', 'cold', 'gold'`;
const CONDITION_VALUES = `'', 'NM', 'LP', 'MP', 'HP', 'DMG'`;

const EDITION_BY_SEGMENT: Readonly<Record<string, string>> = {
  first: 'first',
  '1e': 'first',
  unlimited: 'unlimited',
  ue: 'unlimited',
  alpha: 'alpha',
  ae: 'alpha',
};
const FINISH_BY_SEGMENT: Readonly<Record<string, string>> = {
  rainbow: 'rainbow',
  rf: 'rainbow',
  cold: 'cold',
  cf: 'cold',
  gold: 'gold',
  gf: 'gold',
};

interface ISplitKey {
  readonly printingCode: string;
  readonly edition: string;
  readonly finish: string;
  readonly readable: boolean;
}

/**
 * `collectorCode[.edition][.foiling]`. Stored keys use the codes (`WTR167.UE.RF`); the words are read too.
 * A key with a segment this cannot place keeps only its collector code.
 */
function splitPrintingKey(key: string): ISplitKey {
  const [printingCode = '', ...rest] = key.split('.');
  let edition = '';
  let finish = '';
  let position = 0;
  if (rest[position] !== undefined && EDITION_BY_SEGMENT[rest[position]!.toLowerCase()] !== undefined) {
    edition = EDITION_BY_SEGMENT[rest[position]!.toLowerCase()]!;
    position += 1;
  }
  if (rest[position] !== undefined && FINISH_BY_SEGMENT[rest[position]!.toLowerCase()] !== undefined) {
    finish = FINISH_BY_SEGMENT[rest[position]!.toLowerCase()]!;
    position += 1;
  }
  if (position === rest.length) return { printingCode, edition, finish, readable: true };
  return { printingCode, edition: '', finish: '', readable: false };
}

export class AddCopyVersions1778533607000 implements MigrationInterface {
  private readonly logger = new Logger('AddCopyVersions');

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.extendCollectionCard(queryRunner);
    await this.extendCardListLine(queryRunner);
    await this.splitSellLinePrintingKeys(queryRunner);
  }

  private async extendCollectionCard(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['printingCode', 'edition', 'finish', 'condition']) {
      await queryRunner.query(
        `ALTER TABLE "collection_card" ADD COLUMN IF NOT EXISTS "${column}" varchar NOT NULL DEFAULT ''`,
      );
    }
    await this.replaceCheck(queryRunner, 'collection_card', 'CHK_collection_card_edition_valid', `"edition" IN (${EDITION_VALUES})`);
    await this.replaceCheck(queryRunner, 'collection_card', 'CHK_collection_card_finish_valid', `"finish" IN (${FINISH_VALUES})`);
    await this.replaceCheck(queryRunner, 'collection_card', 'CHK_collection_card_condition_valid', `"condition" IN (${CONDITION_VALUES})`);

    // The three-column unique index carries a name that depends on how the database was built.
    const indexes: Array<{ indexname: string }> = await queryRunner.query(
      `SELECT i.relname AS indexname
       FROM pg_index x
       JOIN pg_class i ON i.oid = x.indexrelid
       JOIN pg_class t ON t.oid = x.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = current_schema() AND t.relname = 'collection_card'
         AND x.indisunique AND NOT x.indisprimary
         AND (SELECT array_agg(a.attname::text ORDER BY k.ord)
              FROM unnest(x.indkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum) = $1::text[]`,
      [OLD_KEY],
    );
    for (const { indexname } of indexes) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${indexname}"`);
    }
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "${NEW_INDEX}" ON "collection_card" (${COLLECTION_KEY.map((column) => `"${column}"`).join(', ')})`,
    );
  }

  private async extendCardListLine(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['printingCode', 'edition', 'finish']) {
      await queryRunner.query(
        `ALTER TABLE "card_list_line" ADD COLUMN IF NOT EXISTS "${column}" varchar NOT NULL DEFAULT ''`,
      );
    }
    // `condition` exists already, nullable, with a check that has no empty value.
    await queryRunner.query(`ALTER TABLE "card_list_line" ADD COLUMN IF NOT EXISTS "condition" varchar(4)`);
    await queryRunner.query(`ALTER TABLE "card_list_line" DROP CONSTRAINT IF EXISTS "CHK_card_list_line_condition_valid"`);
    await queryRunner.query(`UPDATE "card_list_line" SET "condition" = '' WHERE "condition" IS NULL`);
    await queryRunner.query(`ALTER TABLE "card_list_line" ALTER COLUMN "condition" SET DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "card_list_line" ALTER COLUMN "condition" SET NOT NULL`);
    await this.replaceCheck(queryRunner, 'card_list_line', 'CHK_card_list_line_condition_values', `"condition" IN (${CONDITION_VALUES})`);
    await this.replaceCheck(queryRunner, 'card_list_line', 'CHK_card_list_line_edition_valid', `"edition" IN (${EDITION_VALUES})`);
    await this.replaceCheck(queryRunner, 'card_list_line', 'CHK_card_list_line_finish_valid', `"finish" IN (${FINISH_VALUES})`);
  }

  private async splitSellLinePrintingKeys(queryRunner: QueryRunner): Promise<void> {
    const hasPrinting: Array<{ column_name: string }> = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'card_list_line' AND column_name = 'printing'`,
    );
    if (hasPrinting.length === 0) return;
    // A row already split (collector code filled in) is left alone, so a second run changes nothing.
    const lines: Array<{ id: number; printing: string }> = await queryRunner.query(
      `SELECT id, printing FROM "card_list_line" WHERE printing IS NOT NULL AND "printingCode" = ''`,
    );
    for (const line of lines) {
      const split = splitPrintingKey(line.printing);
      if (!split.readable) {
        this.logger.warn(
          `card_list_line line ${line.id}: printing key "${line.printing}" is not readable, kept its collector code "${split.printingCode}" and left edition and finish unknown`,
        );
      }
      await queryRunner.query(
        `UPDATE "card_list_line" SET "printingCode" = $2, edition = $3, finish = $4 WHERE id = $1`,
        [line.id, split.printingCode, split.edition, split.finish],
      );
    }
  }

  private async replaceCheck(queryRunner: QueryRunner, table: string, name: string, expression: string): Promise<void> {
    await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${name}"`);
    await queryRunner.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${name}" CHECK (${expression})`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "${NEW_INDEX}"`);
    // Rows that differ only by version would collide on the old key: fold them into one row first.
    await queryRunner.query(
      `WITH folded AS (
         SELECT min(id) AS keep, sum(quantity) AS total
         FROM "collection_card" GROUP BY "userId", "cardIdentifier", "sourceId"
       )
       UPDATE "collection_card" c SET quantity = f.total FROM folded f WHERE c.id = f.keep`,
    );
    await queryRunner.query(
      `DELETE FROM "collection_card" c USING (
         SELECT min(id) AS keep, "userId", "cardIdentifier", "sourceId"
         FROM "collection_card" GROUP BY "userId", "cardIdentifier", "sourceId"
       ) k
       WHERE c."userId" = k."userId" AND c."cardIdentifier" = k."cardIdentifier"
         AND c."sourceId" = k."sourceId" AND c.id <> k.keep`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_collection_card_user_card_source_uq" ON "collection_card" ("userId", "cardIdentifier", "sourceId")`,
    );
    for (const name of ['CHK_collection_card_edition_valid', 'CHK_collection_card_finish_valid', 'CHK_collection_card_condition_valid']) {
      await queryRunner.query(`ALTER TABLE "collection_card" DROP CONSTRAINT IF EXISTS "${name}"`);
    }
    for (const column of ['printingCode', 'edition', 'finish', 'condition']) {
      await queryRunner.query(`ALTER TABLE "collection_card" DROP COLUMN IF EXISTS "${column}"`);
    }
    for (const name of ['CHK_card_list_line_edition_valid', 'CHK_card_list_line_finish_valid']) {
      await queryRunner.query(`ALTER TABLE "card_list_line" DROP CONSTRAINT IF EXISTS "${name}"`);
    }
    for (const column of ['printingCode', 'edition', 'finish']) {
      await queryRunner.query(`ALTER TABLE "card_list_line" DROP COLUMN IF EXISTS "${column}"`);
    }
    await queryRunner.query(`ALTER TABLE "card_list_line" DROP CONSTRAINT IF EXISTS "CHK_card_list_line_condition_values"`);
    await queryRunner.query(`ALTER TABLE "card_list_line" ALTER COLUMN "condition" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "card_list_line" ALTER COLUMN "condition" DROP DEFAULT`);
    await queryRunner.query(`UPDATE "card_list_line" SET "condition" = NULL WHERE "condition" = ''`);
    await queryRunner.query(
      `ALTER TABLE "card_list_line" ADD CONSTRAINT "CHK_card_list_line_condition_valid" CHECK ("condition" IN ('NM', 'LP', 'MP', 'HP', 'DMG'))`,
    );
  }
}
