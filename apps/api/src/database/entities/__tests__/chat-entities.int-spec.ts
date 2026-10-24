import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as entities from '..';
import {
  CHAT_ACCESS_COLUMN,
  CHAT_COLUMNS,
  readChatAccessColumn,
  readChatColumns,
} from '../../migrations/__tests__/chat-columns';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal_chat';
const SCHEMA = 'chat_entities_test';

// CHAT_COLUMNS describes the schema right after AddAiChat; later migrations
// (AddChatUsageCachedTokens, AddTournamentDeckSource) added these columns.
const COLUMNS_ADDED_LATER: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  chat_usage: { cachedInputTokens: 'integer NOT NULL DEFAULT 0' },
  tournament_deck: { source: "character varying(20) NOT NULL DEFAULT 'tournament'::character varying" },
};

function withLaterColumns(
  base: Readonly<Record<string, Readonly<Record<string, string>>>>,
): Record<string, Record<string, string>> {
  const merged: Record<string, Record<string, string>> = {};
  for (const [table, columns] of Object.entries(base)) {
    merged[table] = { ...columns, ...(COLUMNS_ADDED_LATER[table] ?? {}) };
  }
  return merged;
}

describe('chat entities', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    const root = new DataSource({ type: 'postgres', url: DATABASE_URL });
    await root.initialize();
    await root.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await root.query(`CREATE SCHEMA "${SCHEMA}"`);
    await root.destroy();
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      schema: SCHEMA,
      entities: Object.values(entities).filter((value) => typeof value === 'function') as never[],
      synchronize: true,
    });
    await dataSource.initialize();
  }, 60_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
      await dataSource.destroy();
    }
  });

  it('synchronize builds the same columns as the migration', async () => {
    expect(await readChatColumns(dataSource, SCHEMA)).toEqual(withLaterColumns(CHAT_COLUMNS));
    expect(await readChatAccessColumn(dataSource, SCHEMA)).toBe(CHAT_ACCESS_COLUMN);
  });
});
