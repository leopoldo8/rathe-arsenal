import { MigrationInterface, QueryRunner } from 'typeorm';

// Doors 6 and 7: an import may be a paste, a ready-made product or a Fabrary deck, and the lines of a
// paste or file that are not ready are kept "Para resolver" with their import. The kind check keeps its
// name and widens its list; `productKey` is set only on imports of kind `product`. Existing Fabrary
// imports are still kind `csv` here; moving them to `fabrary` belongs with the Fabrary import slice.
// IF NOT EXISTS and DROP IF EXISTS: a database that ran with synchronize may hold these already.

const KIND_VALUES = `'csv', 'paste', 'product', 'fabrary', 'manual'`;

export class AddImportKindsAndPendingLines1778533608000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "csv_source" ADD COLUMN IF NOT EXISTS "productKey" varchar`);
    await queryRunner.query(`ALTER TABLE "csv_source" DROP CONSTRAINT IF EXISTS "CHK_csv_source_kind_valid"`);
    await queryRunner.query(
      `ALTER TABLE "csv_source" ADD CONSTRAINT "CHK_csv_source_kind_valid" CHECK (kind IN (${KIND_VALUES}))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "import_pending_line" (
         id serial PRIMARY KEY,
         "sourceId" uuid NOT NULL REFERENCES "csv_source"(id) ON DELETE CASCADE,
         "userId" uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
         "lineNumber" int NOT NULL,
         "originalText" text NOT NULL,
         reason varchar(32) NOT NULL,
         "suggestedCardIdentifier" varchar,
         "createdAt" timestamptz NOT NULL DEFAULT now()
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_import_pending_line_sourceId" ON "import_pending_line" ("sourceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_import_pending_line_userId" ON "import_pending_line" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "import_pending_line"`);
    await queryRunner.query(`DELETE FROM "csv_source" WHERE kind IN ('paste', 'product', 'fabrary')`);
    await queryRunner.query(`ALTER TABLE "csv_source" DROP CONSTRAINT IF EXISTS "CHK_csv_source_kind_valid"`);
    await queryRunner.query(
      `ALTER TABLE "csv_source" ADD CONSTRAINT "CHK_csv_source_kind_valid" CHECK (kind IN ('csv', 'manual'))`,
    );
    await queryRunner.query(`ALTER TABLE "csv_source" DROP COLUMN IF EXISTS "productKey"`);
  }
}
