import { createMock } from '@golevelup/ts-jest';
import { FetchGuardService } from '../../common/fetch-guard/fetch-guard.service';
import {
  FABRARY_INDEX_API_KEY,
  FABRARY_INDEX_APP_ID,
  FabraryIndexClient,
  IIndexDeck,
  IIndexRequest,
  IIndexResult,
  isPlayerNamedPlacement,
  listPlayerNamedDecks,
  listTournamentDecks,
  PLAYER_NAMED_FORMATS,
  PLAYER_NAMED_SEARCH_WORDS,
} from '../fabrary-index';

function decks(prefix: string, count: number, format: string, heroIdentifier = 'katsu-the-wanderer'): IIndexDeck[] {
  return Array.from({ length: count }, (_, i) => ({ deckId: `${prefix}${i}`, name: `${prefix} ${i}`, format, heroIdentifier }));
}

describe('Fabrary tournament index', () => {
  it('lists a format whole under 1000 and by hero at 1000', async () => {
    const blitz = decks('B', 999, 'Blitz');
    const ccKatsu = decks('K', 600, 'Classic Constructed');
    const ccOscilio = decks('O', 400, 'Classic Constructed', 'oscilio-constella-intelligence');
    const requests: IIndexRequest[] = [];
    const query = async (request: IIndexRequest): Promise<IIndexResult> => {
      requests.push(request);
      if (request.facets?.[0] === 'format') {
        return { nbHits: 1999, hits: [], facets: { format: { Blitz: 999, 'Classic Constructed': 1000 } } };
      }
      if (request.facets?.[0] === 'heroIdentifier') {
        return { nbHits: 1000, hits: [], facets: { heroIdentifier: { 'katsu-the-wanderer': 600, 'oscilio-constella-intelligence': 400 } } };
      }
      if (request.filters.includes('format:"Blitz"')) return { nbHits: 999, hits: blitz };
      if (request.filters.includes('heroIdentifier:"katsu-the-wanderer"')) return { nbHits: 600, hits: ccKatsu };
      if (request.filters.includes('heroIdentifier:"oscilio-constella-intelligence"')) return { nbHits: 400, hits: ccOscilio };
      throw new Error(`unexpected request ${request.filters}`);
    };

    const listing = await listTournamentDecks(query);

    const ids = listing.decks.map((deck) => deck.deckId);
    expect(ids).toHaveLength(1999);
    expect(new Set(ids).size).toBe(1999);
    expect(listing.truncated).toEqual([]);
    const listings = requests.filter((request) => request.hitsPerPage > 0).map((request) => request.filters);
    expect(listings).toEqual([
      'isTournament:true AND format:"Blitz"',
      'isTournament:true AND format:"Classic Constructed" AND heroIdentifier:"katsu-the-wanderer"',
      'isTournament:true AND format:"Classic Constructed" AND heroIdentifier:"oscilio-constella-intelligence"',
    ]);
  });

  it('posts the documented Algolia request through the fetch guard', async () => {
    const fetchGuard = createMock<FetchGuardService>();
    fetchGuard.guardedFetch.mockResolvedValue({
      status: 200,
      headers: {},
      body: new TextEncoder().encode(JSON.stringify({ results: [{ nbHits: 0, hits: [] }] })),
    });
    const client = new FabraryIndexClient(fetchGuard);

    await client.query({ filters: 'isTournament:true', hitsPerPage: 1000 });

    const [url, options] = fetchGuard.guardedFetch.mock.calls[0]!;
    expect(url).toBe('https://4e2ysy5y4i-dsn.algolia.net/1/indexes/*/queries');
    expect(options.allowHosts).toEqual(['4e2ysy5y4i-dsn.algolia.net']);
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual(
      expect.objectContaining({ 'x-algolia-application-id': FABRARY_INDEX_APP_ID, 'x-algolia-api-key': FABRARY_INDEX_API_KEY }),
    );
    const body = JSON.parse(options.body as string) as { requests: Array<{ indexName: string; params: string }> };
    expect(body.requests[0]!.indexName).toBe('public_decks');
    expect(new URLSearchParams(body.requests[0]!.params).get('filters')).toContain('isTournament:true');
  });
});

describe('player-named placement decks', () => {
  it('reads an event and a placement from the deck name', () => {
    const named = ['Skirmish Season 10 Winner', '10/6 CC Armory 3-0 Uto, Daisuke', 'PQ+ München Top 8', 'Battle Hardened: Chicago Top 8 - Pat Eshghy', 'Calling Lille 2nd'];
    const unnamed = ['3-0 Draft', 'Pre-release 3-0', 'Azalea Upgraded', 'Top 8 brew', 'Calling prep'];

    expect(named.filter(isPlayerNamedPlacement)).toEqual(named);
    expect(unnamed.filter(isPlayerNamedPlacement)).toEqual([]);
  });

  it('keeps the newest five per hero and format the tournament listing left empty', async () => {
    const requests: IIndexRequest[] = [];
    const katsuBlitz = Array.from({ length: 7 }, (_, i) => ({ deckId: `01M0${i}`, name: `Skirmish ${i} Winner`, format: 'Blitz', heroIdentifier: 'katsu' }));
    const coveredCc = { deckId: '01N1', name: 'Armory 1st', format: 'Classic Constructed', heroIdentifier: 'katsu-the-wanderer' };
    const unnamed = { deckId: '01N2', name: 'Armory prep', format: 'Blitz', heroIdentifier: 'kano' };
    const query = async (request: IIndexRequest): Promise<IIndexResult> => {
      requests.push(request);
      if (request.query !== 'skirmish' && request.query !== 'armory') return { nbHits: 0, hits: [] };
      const hits = [...katsuBlitz, coveredCc, unnamed].filter((deck) => request.filters.includes(`format:"${deck.format}"`));
      return { nbHits: hits.length, hits };
    };

    const decks = await listPlayerNamedDecks(query, new Set(['Classic Constructed|katsu-the-wanderer']));

    expect(decks.map((deck) => deck.deckId)).toEqual(['01M06', '01M05', '01M04', '01M03', '01M02']);
    expect(requests).toHaveLength(PLAYER_NAMED_FORMATS.length * PLAYER_NAMED_SEARCH_WORDS.length);
    expect(requests.every((request) => request.filters.startsWith('NOT isTournament:true AND NOT isPrecon:true AND format:'))).toBe(true);
  });
});
