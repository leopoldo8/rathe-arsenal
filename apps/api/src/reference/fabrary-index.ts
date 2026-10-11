import { Injectable } from '@nestjs/common';
import { FetchGuardService } from '../common/fetch-guard/fetch-guard.service';

export const FABRARY_INDEX_HOST = '4e2ysy5y4i-dsn.algolia.net';
export const FABRARY_INDEX_URL = `https://${FABRARY_INDEX_HOST}/1/indexes/*/queries`;
/** Fabrary's public, read-only search key, shipped in its web bundle (docs/brainstorms/gates/phase-1c-unit-1-spike.md). */
export const FABRARY_INDEX_APP_ID = '4E2YSY5Y4I';
export const FABRARY_INDEX_API_KEY = '63c7b6aa56d38399d37df3c341b982c3';
export const FABRARY_INDEX_NAME = 'public_decks';
/** Algolia never returns more hits than this for one query. */
export const INDEX_HIT_CAP = 1000;

const TOURNAMENT_FILTER = 'isTournament:true';
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 10 * 1024 * 1024;

export interface IIndexDeck {
  readonly deckId: string;
  readonly name: string;
  readonly format: string;
  readonly heroIdentifier: string;
}

export interface IIndexRequest {
  readonly filters: string;
  readonly hitsPerPage: number;
  readonly facets?: readonly string[];
}

export interface IIndexResult {
  readonly nbHits: number;
  readonly hits: readonly IIndexDeck[];
  readonly facets?: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export type TIndexQuery = (request: IIndexRequest) => Promise<IIndexResult>;

export interface ITruncatedListing {
  readonly format: string;
  readonly heroIdentifier: string | null;
}

export interface ITournamentListing {
  readonly decks: readonly IIndexDeck[];
  readonly truncated: readonly ITruncatedListing[];
}

function quoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** One listing per format, or one per hero of a format whose count reaches the hit cap. */
export async function listTournamentDecks(query: TIndexQuery): Promise<ITournamentListing> {
  const overview = await query({ filters: TOURNAMENT_FILTER, hitsPerPage: 0, facets: ['format'] });
  const decks = new Map<string, IIndexDeck>();
  const truncated: ITruncatedListing[] = [];

  const list = async (filters: string, label: ITruncatedListing): Promise<void> => {
    const result = await query({ filters, hitsPerPage: INDEX_HIT_CAP });
    if (result.hits.length >= INDEX_HIT_CAP || result.nbHits >= INDEX_HIT_CAP) truncated.push(label);
    for (const hit of result.hits) decks.set(hit.deckId, hit);
  };

  for (const [format, count] of Object.entries(overview.facets?.['format'] ?? {})) {
    const formatFilter = `${TOURNAMENT_FILTER} AND format:${quoted(format)}`;
    if (count < INDEX_HIT_CAP) {
      await list(formatFilter, { format, heroIdentifier: null });
      continue;
    }
    const byHero = await query({ filters: formatFilter, hitsPerPage: 0, facets: ['heroIdentifier'] });
    for (const hero of Object.keys(byHero.facets?.['heroIdentifier'] ?? {})) {
      await list(`${formatFilter} AND heroIdentifier:${quoted(hero)}`, { format, heroIdentifier: hero });
    }
  }
  return { decks: [...decks.values()], truncated };
}

@Injectable()
export class FabraryIndexClient {
  constructor(private readonly fetchGuard: FetchGuardService) {}

  readonly query: TIndexQuery = async (request) => {
    const params = new URLSearchParams({
      query: '',
      filters: request.filters,
      hitsPerPage: String(request.hitsPerPage),
      attributesToRetrieve: JSON.stringify(['deckId', 'name', 'format', 'heroIdentifier']),
      attributesToHighlight: '[]',
      ...(request.facets ? { facets: JSON.stringify(request.facets), maxValuesPerFacet: '1000' } : {}),
    });
    const response = await this.fetchGuard.guardedFetch(FABRARY_INDEX_URL, {
      allowHosts: [FABRARY_INDEX_HOST],
      maxBytes: MAX_BYTES,
      timeoutMs: TIMEOUT_MS,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-algolia-application-id': FABRARY_INDEX_APP_ID,
        'x-algolia-api-key': FABRARY_INDEX_API_KEY,
      },
      body: JSON.stringify({ requests: [{ indexName: FABRARY_INDEX_NAME, params: params.toString() }] }),
    });
    if (response.status !== 200) throw new Error(`Fabrary index answered HTTP ${response.status}`);
    const parsed = JSON.parse(Buffer.from(response.body).toString('utf8')) as { results?: IIndexResult[] };
    const result = parsed.results?.[0];
    if (!result) throw new Error('Fabrary index answered with no result');
    return result;
  };
}
