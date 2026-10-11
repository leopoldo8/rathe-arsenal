const UUID_KEY = 'uuid NOT NULL DEFAULT uuid_generate_v4()';
const CREATED_AT = 'timestamp with time zone NOT NULL DEFAULT now()';

/** Every column of the AI chat tables and `user.chatAccess`: type, length, nullability and default (plan Landing doors 1-6). */
export const CHAT_COLUMNS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  chat_conversation: {
    id: UUID_KEY,
    userId: 'uuid NOT NULL',
    trackedDeckId: 'integer NULL',
    title: 'character varying(80) NULL',
    createdAt: CREATED_AT,
    updatedAt: 'timestamp with time zone NOT NULL DEFAULT now()',
  },
  chat_message: {
    id: UUID_KEY,
    conversationId: 'uuid NOT NULL',
    role: 'character varying(16) NOT NULL',
    status: 'character varying(16) NOT NULL',
    text: 'text NULL',
    modelContent: 'jsonb NULL',
    locale: 'character varying(8) NOT NULL',
    attempts: 'integer NOT NULL DEFAULT 0',
    claimedAt: 'timestamp with time zone NULL',
    startedAt: 'timestamp with time zone NULL',
    finishedAt: 'timestamp with time zone NULL',
    error: 'character varying(32) NULL',
    model: 'character varying(64) NULL',
    inputTokens: 'integer NULL',
    outputTokens: 'integer NULL',
    costUsd: 'numeric(10,6) NULL',
    createdAt: CREATED_AT,
  },
  chat_proposal: {
    id: UUID_KEY,
    messageId: 'uuid NOT NULL',
    kind: 'character varying(16) NOT NULL',
    status: 'character varying(16) NOT NULL',
    payload: 'jsonb NOT NULL',
    reason: 'text NOT NULL',
    trackedDeckId: 'integer NULL',
    cardReplacementId: 'uuid NULL',
    decidedAt: 'timestamp with time zone NULL',
    createdAt: CREATED_AT,
  },
  chat_usage: {
    id: UUID_KEY,
    userId: 'uuid NOT NULL',
    messageId: 'uuid NULL',
    model: 'character varying(64) NOT NULL',
    inputTokens: 'integer NOT NULL',
    outputTokens: 'integer NOT NULL',
    costUsd: 'numeric(10,6) NOT NULL',
    createdAt: CREATED_AT,
  },
  tournament_deck: {
    id: UUID_KEY,
    fabraryUlid: 'character varying(26) NOT NULL',
    name: 'character varying(255) NOT NULL',
    eventName: 'character varying(255) NULL',
    placement: 'integer NULL',
    heroIdentifier: 'character varying(128) NOT NULL',
    format: 'character varying(64) NOT NULL',
    deckCreatedAt: 'timestamp with time zone NOT NULL',
    syncedAt: 'timestamp with time zone NOT NULL',
  },
  tournament_deck_card: {
    id: UUID_KEY,
    tournamentDeckId: 'uuid NOT NULL',
    cardIdentifier: 'character varying(128) NOT NULL',
    quantity: 'integer NOT NULL DEFAULT 0',
    sideboardQuantity: 'integer NOT NULL DEFAULT 0',
  },
  rules_entry: {
    id: UUID_KEY,
    ruleNumber: 'character varying(128) NOT NULL',
    sectionNumber: 'character varying(16) NOT NULL',
    sectionTitle: 'character varying(255) NOT NULL',
    text: 'text NOT NULL',
    url: 'character varying(255) NOT NULL',
    sourceHash: 'character varying(64) NOT NULL',
    fetchedAt: 'timestamp with time zone NOT NULL',
  },
};

export const CHAT_ACCESS_COLUMN = 'boolean NOT NULL DEFAULT false';

type TQuery = { query(sql: string, parameters?: unknown[]): Promise<unknown> };

interface IColumnRow {
  readonly table_name: string;
  readonly column_name: string;
  readonly data_type: string;
  readonly character_maximum_length: number | null;
  readonly numeric_precision: number | null;
  readonly numeric_scale: number | null;
  readonly is_nullable: string;
  readonly column_default: string | null;
}

function describe(row: IColumnRow): string {
  const size =
    row.character_maximum_length !== null
      ? `(${row.character_maximum_length})`
      : row.data_type === 'numeric'
        ? `(${row.numeric_precision},${row.numeric_scale})`
        : '';
  const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
  return `${row.data_type}${size} ${nullable}${row.column_default === null ? '' : ` DEFAULT ${row.column_default}`}`;
}

export async function readChatColumns(run: TQuery, schema: string): Promise<Record<string, Record<string, string>>> {
  const rows = (await run.query(
    `SELECT table_name, column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default
       FROM information_schema.columns WHERE table_schema = $1 AND table_name = ANY($2)`,
    [schema, Object.keys(CHAT_COLUMNS)],
  )) as IColumnRow[];
  const columns: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    columns[row.table_name] = { ...columns[row.table_name], [row.column_name]: describe(row) };
  }
  return columns;
}

export async function readChatAccessColumn(run: TQuery, schema: string): Promise<string | null> {
  const rows = (await run.query(
    `SELECT table_name, column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default
       FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'user' AND column_name = 'chatAccess'`,
    [schema],
  )) as IColumnRow[];
  return rows[0] ? describe(rows[0]) : null;
}
