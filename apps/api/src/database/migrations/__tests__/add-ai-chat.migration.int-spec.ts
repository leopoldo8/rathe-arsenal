import { DataSource, QueryRunner } from 'typeorm';
import { AddAiChat1778533594000 } from '../1778533594000-AddAiChat';
import { CHAT_ACCESS_COLUMN, CHAT_COLUMNS, readChatAccessColumn, readChatColumns } from './chat-columns';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal_chat';
const SCHEMA = 'ai_chat_migration_test';
const ORIGINS_BEFORE = `'very_close', 'close', 'other_pitch', 'generic', 'search', 'recommendation', 'suggested'`;

describe('AddAiChat1778533594000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function rejects(sql: string, params: unknown[] = []): Promise<void> {
    await expect(queryRunner.query(sql, params)).rejects.toThrow();
  }

  beforeAll(async () => {
    dataSource = new DataSource({ type: 'postgres', url: DATABASE_URL, schema: SCHEMA, synchronize: false });
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.query(`CREATE SCHEMA "${SCHEMA}"`);
    await queryRunner.query(`SET search_path TO "${SCHEMA}", public`);
    await queryRunner.query(`CREATE TABLE "user" (id uuid PRIMARY KEY DEFAULT uuid_generate_v4())`);
    await queryRunner.query(`CREATE TABLE "tracked_deck" (id serial PRIMARY KEY)`);
    await queryRunner.query(
      `CREATE TABLE "card_replacement" (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "pickedFrom" varchar(32) NOT NULL,
        CONSTRAINT "CHK_card_replacement_picked_from_valid" CHECK ("pickedFrom" IN (${ORIGINS_BEFORE})))`,
    );
  });

  afterAll(async () => {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.release();
    await dataSource.destroy();
  });

  it('up creates and down drops the chat and reference tables', async () => {
    await new AddAiChat1778533594000().up(queryRunner);

    expect(await readChatColumns(queryRunner, SCHEMA)).toEqual(CHAT_COLUMNS);
    expect(await readChatAccessColumn(queryRunner, SCHEMA)).toBe(CHAT_ACCESS_COLUMN);

    const indexes: Array<{ indexname: string; indexdef: string }> = await queryRunner.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND (indexname LIKE 'IDX_%' OR indexname LIKE 'UQ_%') ORDER BY indexname`,
      [SCHEMA],
    );
    const byName = Object.fromEntries(indexes.map((row) => [row.indexname, row.indexdef]));
    expect(Object.keys(byName)).toEqual([
      'IDX_chat_conversation_user_updated',
      'IDX_chat_message_conversation_created',
      'IDX_chat_message_one_open_turn',
      'IDX_chat_message_status_created',
      'IDX_chat_proposal_message',
      'IDX_chat_usage_user_created',
      'IDX_tournament_deck_hero_format_created',
      'UQ_rules_entry_rule_number',
      'UQ_tournament_deck_card_deck_card',
      'UQ_tournament_deck_fabrary_ulid',
    ]);
    expect(byName['IDX_chat_message_one_open_turn']).toMatch(
      /UNIQUE .*\("conversationId"\) WHERE .*status.* = ANY .*'pending'.*'running'/,
    );
    expect(byName['UQ_tournament_deck_card_deck_card']).toMatch(/UNIQUE .*\("tournamentDeckId", "cardIdentifier"\)/);
    expect(byName['UQ_tournament_deck_fabrary_ulid']).toMatch(/UNIQUE .*\("fabraryUlid"\)/);
    expect(byName['UQ_rules_entry_rule_number']).toMatch(/UNIQUE .*\("ruleNumber"\)/);

    const [{ id: userId }] = await queryRunner.query(`INSERT INTO "user" DEFAULT VALUES RETURNING id`);
    const [{ id: conversationId }] = await queryRunner.query(
      `INSERT INTO chat_conversation ("userId") VALUES ($1) RETURNING id`,
      [userId],
    );
    const insertMessage = `INSERT INTO chat_message ("conversationId", role, status, locale) VALUES ($1, $2, $3, 'en-US') RETURNING id`;
    await rejects(insertMessage, [conversationId, 'system', 'done']);
    await rejects(insertMessage, [conversationId, 'user', 'queued']);
    const [{ id: messageId }] = await queryRunner.query(insertMessage, [conversationId, 'assistant', 'done']);
    const insertProposal = `INSERT INTO chat_proposal ("messageId", kind, status, payload, reason) VALUES ($1, $2, $3, '{}', 'r')`;
    await rejects(insertProposal, [messageId, 'card', 'pending']);
    await rejects(insertProposal, [messageId, 'deck', 'open']);
    await queryRunner.query(`INSERT INTO "card_replacement" ("pickedFrom") VALUES ('chat')`);
    await rejects(`INSERT INTO "card_replacement" ("pickedFrom") VALUES ('oracle')`);

    await expect(new AddAiChat1778533594000().down(queryRunner)).rejects.toThrow(/applied chat swap/);
    await queryRunner.query(`DELETE FROM "card_replacement"`);
    await new AddAiChat1778533594000().down(queryRunner);

    for (const table of Object.keys(CHAT_COLUMNS)) {
      expect({ table, exists: await queryRunner.hasTable(table) }).toEqual({ table, exists: false });
    }
    expect(await readChatAccessColumn(queryRunner, SCHEMA)).toBeNull();
    await rejects(`INSERT INTO "card_replacement" ("pickedFrom") VALUES ('chat')`);
    await queryRunner.query(`INSERT INTO "card_replacement" ("pickedFrom") VALUES ('suggested')`);
  });
});
