import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableCheck,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

const NEW_TABLES = ['recommendation', 'recommendation_run', 'recommendation_dismissal'] as const;

const PICKED_FROM_CHECK = 'CHK_card_replacement_picked_from_valid';

// `synchronize` may have created these tables first: an empty copy is rebuilt, one holding rows is refused.
async function dropEmptySynchronizedTables(queryRunner: QueryRunner): Promise<void> {
  const existing: string[] = [];
  for (const table of NEW_TABLES) {
    if (!(await queryRunner.hasTable(table))) continue;
    const [{ count }] = (await queryRunner.query(`SELECT count(*)::int AS count FROM "${table}"`)) as [
      { count: number },
    ];
    if (count > 0) {
      throw new Error(`${table} already holds ${count} row(s); refusing to recreate it. Inspect it before migrating.`);
    }
    existing.push(table);
  }
  // Only tables `hasTable` saw: an unguarded DROP would resolve through search_path to another schema's table.
  for (const table of existing) {
    await queryRunner.query(`DROP TABLE "${table}" CASCADE`);
  }
}

async function replacePickedFromCheck(queryRunner: QueryRunner, values: readonly string[]): Promise<void> {
  await queryRunner.query(`ALTER TABLE "card_replacement" DROP CONSTRAINT IF EXISTS "${PICKED_FROM_CHECK}"`);
  await queryRunner.query(
    `ALTER TABLE "card_replacement" ADD CONSTRAINT "${PICKED_FROM_CHECK}" CHECK ("pickedFrom" IN (${values
      .map((value) => `'${value}'`)
      .join(', ')}))`,
  );
}

export class AddCardRecommendations1778533591000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await dropEmptySynchronizedTables(queryRunner);

    await queryRunner.createTable(
      new Table({
        name: 'recommendation_run',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'trackedDeckId', type: 'int', isNullable: false },
          { name: 'trigger', type: 'varchar', length: '16', isNullable: false },
          { name: 'status', type: 'varchar', length: '16', isNullable: false },
          { name: 'runAfter', type: 'timestamptz', isNullable: false },
          { name: 'deckFingerprint', type: 'varchar', length: '64', isNullable: true },
          { name: 'model', type: 'varchar', length: '64', isNullable: true },
          { name: 'attempts', type: 'int', default: 0, isNullable: false },
          { name: 'inputTokens', type: 'int', isNullable: true },
          { name: 'outputTokens', type: 'int', isNullable: true },
          { name: 'error', type: 'text', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'startedAt', type: 'timestamptz', isNullable: true },
          { name: 'finishedAt', type: 'timestamptz', isNullable: true },
          { name: 'claimedAt', type: 'timestamptz', isNullable: true },
        ],
        checks: [
          new TableCheck({ name: 'CHK_recommendation_run_trigger_valid', expression: `"trigger" IN ('auto', 'manual')` }),
          new TableCheck({
            name: 'CHK_recommendation_run_status_valid',
            expression: `"status" IN ('pending', 'running', 'done', 'failed')`,
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['trackedDeckId'],
            referencedTableName: 'tracked_deck',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({ name: 'IDX_recommendation_run_status_run_after', columnNames: ['status', 'runAfter'] }),
          new TableIndex({ name: 'IDX_recommendation_run_deck_status', columnNames: ['trackedDeckId', 'status'] }),
          new TableIndex({
            name: 'IDX_recommendation_run_one_pending',
            columnNames: ['trackedDeckId'],
            isUnique: true,
            where: `"status" = 'pending'`,
          }),
          new TableIndex({
            name: 'IDX_recommendation_run_one_running',
            columnNames: ['trackedDeckId'],
            isUnique: true,
            where: `"status" = 'running'`,
          }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'recommendation',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'runId', type: 'uuid', isNullable: false },
          { name: 'cardIdentifier', type: 'varchar', length: '128', isNullable: false },
          { name: 'rank', type: 'int', isNullable: false },
          { name: 'strength', type: 'varchar', length: '16', isNullable: false },
          { name: 'cutCardIdentifier', type: 'varchar', length: '128', isNullable: true },
          { name: 'cutSlot', type: 'varchar', length: '64', isNullable: true },
          { name: 'reason', type: 'text', isNullable: false },
        ],
        checks: [
          new TableCheck({ name: 'CHK_recommendation_rank_range', expression: `"rank" BETWEEN 1 AND 10` }),
          new TableCheck({
            name: 'CHK_recommendation_strength_valid',
            expression: `"strength" IN ('clear_upgrade', 'consider')`,
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['runId'],
            referencedTableName: 'recommendation_run',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
        indices: [new TableIndex({ name: 'IDX_recommendation_run_rank', columnNames: ['runId', 'rank'], isUnique: true })],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'recommendation_dismissal',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'trackedDeckId', type: 'int', isNullable: false },
          { name: 'cardIdentifier', type: 'varchar', length: '128', isNullable: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['trackedDeckId'],
            referencedTableName: 'tracked_deck',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({
            name: 'IDX_recommendation_dismissal_deck_card',
            columnNames: ['trackedDeckId', 'cardIdentifier'],
            isUnique: true,
          }),
        ],
      }),
      true,
    );

    await replacePickedFromCheck(queryRunner, [
      'very_close',
      'close',
      'other_pitch',
      'generic',
      'search',
      'recommendation',
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      `SELECT count(*)::int AS count FROM "card_replacement" WHERE "pickedFrom" = 'recommendation'`,
    )) as [{ count: number }];
    if (count > 0) {
      throw new Error(`card_replacement holds ${count} adopted recommendation(s); the five-value CHECK would reject them.`);
    }
    await replacePickedFromCheck(queryRunner, ['very_close', 'close', 'other_pitch', 'generic', 'search']);
    for (const table of NEW_TABLES) {
      if (await queryRunner.hasTable(table)) await queryRunner.query(`DROP TABLE "${table}" CASCADE`);
    }
  }
}
