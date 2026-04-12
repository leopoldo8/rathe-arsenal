import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Phase 1b Unit 1 — creates the `card_alias` table used by the two-stage
 * card-name matcher (Unit 2).
 *
 * Ships empty. Rows are added by the dev via direct SQL after reviewing
 * unmatched product logs produced by the scraper (Unit 3).
 *
 * The matcher consults this table before running the deterministic
 * kebab-transform (Stage 1), so a bad deterministic match can be corrected
 * without a code change. See docs for the alias-target-missing warn log.
 */
export class AddCardAlias1744329602000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'card_alias',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'sourceSlug',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'rawName',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'cardIdentifier',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'card_alias',
      new TableIndex({
        name: 'IDX_card_alias_source_rawname_unique',
        columnNames: ['sourceSlug', 'rawName'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'card_alias',
      'IDX_card_alias_source_rawname_unique',
    );
    await queryRunner.dropTable('card_alias');
  }
}
