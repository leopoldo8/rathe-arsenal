/** Below this many decks a share is too noisy to show the model, so the prompt carries no usage at all. */
export const USAGE_MIN_DECKS = 5;
/** The most recent decks counted; older lists were built for a card pool or ban list that may no longer hold. */
export const USAGE_DECKS_MAX = 40;
export const USAGE_MAX_AGE_DAYS = 730;

const DAY_MS = 24 * 60 * 60 * 1000;
// Only catalog-shaped identifiers count: the rows come from Fabrary through the tournament sync.
const CARD_IDENTIFIER = /^[a-z0-9-]+$/;

/** How often recent tournament decks of one hero and format play each card. */
export interface IUsageSignal {
  readonly decks: number;
  /** Card identifier to the share of the decks that play it in the mainboard, equipment or weapons, 0 to 1. */
  readonly shares: ReadonlyMap<string, number>;
}

export interface IUsageRow {
  readonly deckId: string;
  readonly cardIdentifier: string;
}

export interface IUsageRequest {
  readonly heroIdentifier: string;
  readonly format: string;
  readonly now: Date;
  /** Fabrary ids left out; the quality eval holds out the decks its expected cards come from. */
  readonly excludeFabraryUlids?: readonly string[];
  /** Only decks created before this; defaults to `now`. */
  readonly createdBefore?: Date | undefined;
}

export type TUsageQuery = (sql: string, params: readonly unknown[]) => Promise<readonly unknown[]>;

const USAGE_SQL = `
  WITH picked AS (
    SELECT d.id FROM tournament_deck d
     WHERE d."heroIdentifier" = $1 AND d.format = $2 AND d."deckCreatedAt" >= $3 AND d."deckCreatedAt" < $4
       AND NOT (d."fabraryUlid" = ANY($5::text[]))
     ORDER BY d."deckCreatedAt" DESC, d.id
     LIMIT $6
  )
  SELECT c."tournamentDeckId" AS "deckId", c."cardIdentifier"
    FROM tournament_deck_card c JOIN picked p ON p.id = c."tournamentDeckId"
   WHERE c.quantity > 0`;

/** Null when fewer than `USAGE_MIN_DECKS` decks play any card. */
export function computeUsageSignal(rows: readonly IUsageRow[]): IUsageSignal | null {
  const cardsByDeck = new Map<string, Set<string>>();
  for (const row of rows) {
    const cards = cardsByDeck.get(row.deckId) ?? new Set<string>();
    if (CARD_IDENTIFIER.test(row.cardIdentifier)) cards.add(row.cardIdentifier);
    cardsByDeck.set(row.deckId, cards);
  }
  if (cardsByDeck.size < USAGE_MIN_DECKS) return null;
  const counts = new Map<string, number>();
  for (const cards of cardsByDeck.values()) for (const card of cards) counts.set(card, (counts.get(card) ?? 0) + 1);
  return {
    decks: cardsByDeck.size,
    shares: new Map([...counts.entries()].map(([card, count]) => [card, count / cardsByDeck.size])),
  };
}

/** Reads the synced tournament decks (`tournament_deck`) through `query`, so the worker and the eval share one rule. */
export async function loadUsageSignal(query: TUsageQuery, request: IUsageRequest): Promise<IUsageSignal | null> {
  const oldest = new Date(request.now.getTime() - USAGE_MAX_AGE_DAYS * DAY_MS);
  const result = await query(USAGE_SQL, [
    request.heroIdentifier,
    request.format,
    oldest,
    request.createdBefore ?? request.now,
    request.excludeFabraryUlids ?? [],
    USAGE_DECKS_MAX,
  ]);
  return computeUsageSignal(result as readonly IUsageRow[]);
}
