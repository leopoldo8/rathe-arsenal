/**
 * The visitor-action counts of the share report: `offer`, `quote_sent` and `buy` from `share_event`, by the link's
 * intent and by the kind of list the link points at (`deck` for a deck link). Kept apart from the script so a test can
 * run the query and the script prints exactly its rows.
 */

export interface IReportPeriod {
  readonly since: Date;
  readonly until: Date;
}

export interface IReportClient {
  query<Row>(sql: string, params: unknown[]): Promise<{ rows: Row[] }>;
}

export interface IVisitorEventCount {
  readonly kind: string;
  readonly intent: string;
  readonly listKind: string;
  readonly count: number;
}

export async function countVisitorEvents(client: IReportClient, period: IReportPeriod): Promise<IVisitorEventCount[]> {
  const result = await client.query<{ kind: string; intent: string; listKind: string; count: string }>(
    `SELECT kind, intent, "listKind", COUNT(*) AS count
       FROM (
         SELECT e.kind, COALESCE(e.intent, 'unknown') AS intent,
                CASE WHEN e."targetKind" = 'deck' THEN 'deck' ELSE COALESCE(l.kind, 'unknown') END AS "listKind"
           FROM share_event e
           LEFT JOIN card_list l ON e."targetKind" = 'list' AND l.id = e."targetId"
          WHERE e.kind IN ('offer', 'quote_sent', 'buy') AND e."occurredAt" >= $1 AND e."occurredAt" < $2
       ) visitor_events
      GROUP BY kind, intent, "listKind"
      ORDER BY kind, intent, "listKind"`,
    [period.since, period.until],
  );
  return result.rows.map((row) => ({ kind: row.kind, intent: row.intent, listKind: row.listKind, count: Number(row.count) }));
}

export function formatVisitorEventLines(rows: readonly IVisitorEventCount[]): string[] {
  return rows.map((row) => `  ${row.kind} / intent ${row.intent} / list kind ${row.listKind}: ${row.count}`);
}
