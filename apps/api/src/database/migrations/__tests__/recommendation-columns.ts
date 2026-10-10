
/** Every column of the three recommendation tables: type, character length, nullability and default (plan Landing doors 1-3). */
export const RECOMMENDATION_COLUMNS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  recommendation_run: {
    id: 'uuid NOT NULL DEFAULT uuid_generate_v4()',
    trackedDeckId: 'integer NOT NULL',
    trigger: 'character varying(16) NOT NULL',
    status: 'character varying(16) NOT NULL',
    runAfter: 'timestamp with time zone NOT NULL',
    deckFingerprint: 'character varying(64) NULL',
    model: 'character varying(64) NULL',
    attempts: 'integer NOT NULL DEFAULT 0',
    inputTokens: 'integer NULL',
    outputTokens: 'integer NULL',
    error: 'text NULL',
    createdAt: 'timestamp with time zone NOT NULL DEFAULT now()',
    startedAt: 'timestamp with time zone NULL',
    finishedAt: 'timestamp with time zone NULL',
    claimedAt: 'timestamp with time zone NULL',
  },
  recommendation: {
    id: 'uuid NOT NULL DEFAULT uuid_generate_v4()',
    runId: 'uuid NOT NULL',
    cardIdentifier: 'character varying(128) NOT NULL',
    rank: 'integer NOT NULL',
    strength: 'character varying(16) NOT NULL',
    cutCardIdentifier: 'character varying(128) NULL',
    cutSlot: 'character varying(64) NULL',
    reason: 'text NOT NULL',
    reasonPtBr: 'text NULL',
  },
  recommendation_dismissal: {
    id: 'uuid NOT NULL DEFAULT uuid_generate_v4()',
    trackedDeckId: 'integer NOT NULL',
    cardIdentifier: 'character varying(128) NOT NULL',
    createdAt: 'timestamp with time zone NOT NULL DEFAULT now()',
  },
};

export async function readRecommendationColumns(
  run: { query(sql: string, parameters?: unknown[]): Promise<unknown> },
  schema: string,
): Promise<Record<string, Record<string, string>>> {
  const rows = (await run.query(
      `SELECT table_name, column_name, data_type, character_maximum_length, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = ANY($2)`,
      [schema, Object.keys(RECOMMENDATION_COLUMNS)],
    )) as Array<{ table_name: string; column_name: string; data_type: string; character_maximum_length: number | null; is_nullable: string; column_default: string | null }>;
  const columns: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    const length = row.character_maximum_length === null ? '' : `(${row.character_maximum_length})`;
    columns[row.table_name] = {
      ...columns[row.table_name],
      [row.column_name]: `${row.data_type}${length} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}${
        row.column_default === null ? '' : ` DEFAULT ${row.column_default}`
      }`,
    };
  }
  return columns;
}
