import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableCheck,
  TableColumn,
  TableColumnOptions,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/** Dropped in reverse: a table goes before the ones it references. */
const NEW_TABLES = [
  'chat_usage',
  'chat_proposal',
  'chat_message',
  'chat_conversation',
  'tournament_deck_card',
  'tournament_deck',
  'rules_entry',
] as const;

const PICKED_FROM_CHECK = 'CHK_card_replacement_picked_from_valid';
const ORIGINS_BEFORE = ['very_close', 'close', 'other_pitch', 'generic', 'search', 'recommendation', 'suggested'] as const;
const ORIGINS_AFTER = [...ORIGINS_BEFORE, 'chat'] as const;

const uuidKey: TableColumnOptions = { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' };
const createdAt: TableColumnOptions = { name: 'createdAt', type: 'timestamptz', default: 'now()', isNullable: false };

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

function cascadeTo(column: string, table: string, onDelete: 'CASCADE' | 'SET NULL'): TableForeignKey {
  return new TableForeignKey({ columnNames: [column], referencedTableName: table, referencedColumnNames: ['id'], onDelete });
}

export class AddAiChat1778533594000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await dropEmptySynchronizedTables(queryRunner);

    if (!(await queryRunner.hasColumn('user', 'chatAccess'))) {
      await queryRunner.addColumn(
        'user',
        new TableColumn({ name: 'chatAccess', type: 'boolean', default: false, isNullable: false }),
      );
    }

    await queryRunner.createTable(
      new Table({
        name: 'chat_conversation',
        columns: [
          uuidKey,
          { name: 'userId', type: 'uuid', isNullable: false },
          { name: 'trackedDeckId', type: 'int', isNullable: true },
          { name: 'title', type: 'varchar', length: '80', isNullable: true },
          createdAt,
          { name: 'updatedAt', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
        foreignKeys: [cascadeTo('userId', 'user', 'CASCADE'), cascadeTo('trackedDeckId', 'tracked_deck', 'SET NULL')],
        indices: [new TableIndex({ name: 'IDX_chat_conversation_user_updated', columnNames: ['userId', 'updatedAt'] })],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'chat_message',
        columns: [
          uuidKey,
          { name: 'conversationId', type: 'uuid', isNullable: false },
          { name: 'role', type: 'varchar', length: '16', isNullable: false },
          { name: 'status', type: 'varchar', length: '16', isNullable: false },
          { name: 'text', type: 'text', isNullable: true },
          { name: 'modelContent', type: 'jsonb', isNullable: true },
          { name: 'locale', type: 'varchar', length: '8', isNullable: false },
          { name: 'attempts', type: 'int', default: 0, isNullable: false },
          { name: 'claimedAt', type: 'timestamptz', isNullable: true },
          { name: 'startedAt', type: 'timestamptz', isNullable: true },
          { name: 'finishedAt', type: 'timestamptz', isNullable: true },
          { name: 'error', type: 'varchar', length: '32', isNullable: true },
          { name: 'model', type: 'varchar', length: '64', isNullable: true },
          { name: 'inputTokens', type: 'int', isNullable: true },
          { name: 'outputTokens', type: 'int', isNullable: true },
          { name: 'costUsd', type: 'numeric', precision: 10, scale: 6, isNullable: true },
          createdAt,
        ],
        checks: [
          new TableCheck({ name: 'CHK_chat_message_role_valid', expression: `"role" IN ('user', 'assistant')` }),
          new TableCheck({
            name: 'CHK_chat_message_status_valid',
            expression: `"status" IN ('pending', 'running', 'done', 'failed')`,
          }),
        ],
        foreignKeys: [cascadeTo('conversationId', 'chat_conversation', 'CASCADE')],
        indices: [
          new TableIndex({ name: 'IDX_chat_message_conversation_created', columnNames: ['conversationId', 'createdAt'] }),
          new TableIndex({ name: 'IDX_chat_message_status_created', columnNames: ['status', 'createdAt'] }),
          new TableIndex({
            name: 'IDX_chat_message_one_open_turn',
            columnNames: ['conversationId'],
            isUnique: true,
            where: `"status" IN ('pending', 'running')`,
          }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'chat_proposal',
        columns: [
          uuidKey,
          { name: 'messageId', type: 'uuid', isNullable: false },
          { name: 'kind', type: 'varchar', length: '16', isNullable: false },
          { name: 'status', type: 'varchar', length: '16', isNullable: false },
          { name: 'payload', type: 'jsonb', isNullable: false },
          { name: 'reason', type: 'text', isNullable: false },
          { name: 'trackedDeckId', type: 'int', isNullable: true },
          { name: 'cardReplacementId', type: 'uuid', isNullable: true },
          { name: 'decidedAt', type: 'timestamptz', isNullable: true },
          createdAt,
        ],
        checks: [
          new TableCheck({ name: 'CHK_chat_proposal_kind_valid', expression: `"kind" IN ('deck', 'swap')` }),
          new TableCheck({
            name: 'CHK_chat_proposal_status_valid',
            expression: `"status" IN ('pending', 'applied', 'dismissed', 'stale')`,
          }),
        ],
        foreignKeys: [
          cascadeTo('messageId', 'chat_message', 'CASCADE'),
          cascadeTo('trackedDeckId', 'tracked_deck', 'SET NULL'),
          cascadeTo('cardReplacementId', 'card_replacement', 'SET NULL'),
        ],
        indices: [new TableIndex({ name: 'IDX_chat_proposal_message', columnNames: ['messageId'] })],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'chat_usage',
        columns: [
          uuidKey,
          { name: 'userId', type: 'uuid', isNullable: false },
          { name: 'messageId', type: 'uuid', isNullable: true },
          { name: 'model', type: 'varchar', length: '64', isNullable: false },
          { name: 'inputTokens', type: 'int', isNullable: false },
          { name: 'outputTokens', type: 'int', isNullable: false },
          { name: 'costUsd', type: 'numeric', precision: 10, scale: 6, isNullable: false },
          createdAt,
        ],
        foreignKeys: [cascadeTo('userId', 'user', 'CASCADE'), cascadeTo('messageId', 'chat_message', 'SET NULL')],
        indices: [new TableIndex({ name: 'IDX_chat_usage_user_created', columnNames: ['userId', 'createdAt'] })],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'tournament_deck',
        columns: [
          uuidKey,
          { name: 'fabraryUlid', type: 'varchar', length: '26', isNullable: false },
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
          { name: 'eventName', type: 'varchar', length: '255', isNullable: true },
          { name: 'placement', type: 'int', isNullable: true },
          { name: 'heroIdentifier', type: 'varchar', length: '128', isNullable: false },
          { name: 'format', type: 'varchar', length: '64', isNullable: false },
          { name: 'deckCreatedAt', type: 'timestamptz', isNullable: false },
          { name: 'syncedAt', type: 'timestamptz', isNullable: false },
        ],
        indices: [
          new TableIndex({ name: 'UQ_tournament_deck_fabrary_ulid', columnNames: ['fabraryUlid'], isUnique: true }),
          new TableIndex({
            name: 'IDX_tournament_deck_hero_format_created',
            columnNames: ['heroIdentifier', 'format', 'deckCreatedAt'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'tournament_deck_card',
        columns: [
          uuidKey,
          { name: 'tournamentDeckId', type: 'uuid', isNullable: false },
          { name: 'cardIdentifier', type: 'varchar', length: '128', isNullable: false },
          { name: 'quantity', type: 'int', default: 0, isNullable: false },
          { name: 'sideboardQuantity', type: 'int', default: 0, isNullable: false },
        ],
        foreignKeys: [cascadeTo('tournamentDeckId', 'tournament_deck', 'CASCADE')],
        indices: [
          new TableIndex({
            name: 'UQ_tournament_deck_card_deck_card',
            columnNames: ['tournamentDeckId', 'cardIdentifier'],
            isUnique: true,
          }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'rules_entry',
        columns: [
          uuidKey,
          { name: 'ruleNumber', type: 'varchar', length: '128', isNullable: false },
          { name: 'sectionNumber', type: 'varchar', length: '16', isNullable: false },
          { name: 'sectionTitle', type: 'varchar', length: '255', isNullable: false },
          { name: 'text', type: 'text', isNullable: false },
          { name: 'url', type: 'varchar', length: '255', isNullable: false },
          { name: 'sourceHash', type: 'varchar', length: '64', isNullable: false },
          { name: 'fetchedAt', type: 'timestamptz', isNullable: false },
        ],
        indices: [new TableIndex({ name: 'UQ_rules_entry_rule_number', columnNames: ['ruleNumber'], isUnique: true })],
      }),
      true,
    );

    await replacePickedFromCheck(queryRunner, ORIGINS_AFTER);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      `SELECT count(*)::int AS count FROM "card_replacement" WHERE "pickedFrom" = 'chat'`,
    )) as [{ count: number }];
    if (count > 0) {
      throw new Error(`card_replacement holds ${count} applied chat swap(s); the seven-value CHECK would reject them.`);
    }
    await replacePickedFromCheck(queryRunner, ORIGINS_BEFORE);
    for (const table of NEW_TABLES) {
      if (await queryRunner.hasTable(table)) await queryRunner.query(`DROP TABLE "${table}" CASCADE`);
    }
    if (await queryRunner.hasColumn('user', 'chatAccess')) await queryRunner.dropColumn('user', 'chatAccess');
  }
}
