import { HttpTcgcsvClient, PRICE_SYNC_USER_AGENT } from '../tcgcsv-client';
import { parseGroups, parseLastUpdated, parsePriceRows } from '../tcgcsv-parse';

describe('tcgcsv parsing', () => {
  it('keeps well-formed groups and tolerates garbage', () => {
    expect(parseGroups({ results: [{ groupId: 1, name: 'A', abbreviation: 'AA' }, { groupId: 2, name: 'B', abbreviation: '' }, { name: 'x' }] })).toEqual([
      { groupId: 1, name: 'A', abbreviation: 'AA' },
      { groupId: 2, name: 'B', abbreviation: null },
    ]);
    expect(parseGroups(null)).toEqual([]);
  });

  it('turns prices into USD cents, nulls into null, and drops malformed or repeated rows', () => {
    expect(
      parsePriceRows({
        results: [
          { productId: 7, subTypeName: 'Normal', marketPrice: 25.41, midPrice: 29.38 },
          { productId: 7, subTypeName: 'Normal', marketPrice: 1, midPrice: 1 },
          { productId: 8, subTypeName: 'Rainbow Foil', marketPrice: null, midPrice: 0.3 },
          { productId: 9 },
        ],
      }),
    ).toEqual([
      { productId: '7', subType: 'Normal', marketPriceCents: 2541, midPriceCents: 2938 },
      { productId: '8', subType: 'Rainbow Foil', marketPriceCents: null, midPriceCents: 30 },
    ]);
  });

  it('parses the +0000 offset of last-updated.txt', () => {
    expect(parseLastUpdated('2026-10-17T20:05:21+0000\n')?.toISOString()).toBe('2026-10-17T20:05:21.000Z');
    expect(parseLastUpdated('nonsense')).toBeNull();
  });
});

describe('HttpTcgcsvClient', () => {
  it('sends the custom User-Agent and spaces requests at least one second apart', async () => {
    let clock = 10_000;
    const sleeps: number[] = [];
    const calls: { url: string; userAgent: string }[] = [];
    const fetchFn = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), userAgent: (init?.headers as Record<string, string>)['User-Agent'] as string });
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new HttpTcgcsvClient({
      fetchFn,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });

    await Promise.all([client.fetchGroups(), client.fetchPrices(5), client.fetchPrices(6)]);

    expect(calls.map((call) => call.url)).toEqual([
      'https://tcgcsv.com/tcgplayer/62/groups',
      'https://tcgcsv.com/tcgplayer/62/5/prices',
      'https://tcgcsv.com/tcgplayer/62/6/prices',
    ]);
    expect(calls.every((call) => call.userAgent === PRICE_SYNC_USER_AGENT)).toBe(true);
    expect(sleeps).toEqual([1000, 1000]);
  });

  it('throws on a non-200 answer and keeps working afterwards', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 })) as unknown as typeof fetch;
    const client = new HttpTcgcsvClient({ fetchFn, sleep: async () => undefined, now: () => 0 });

    await expect(client.fetchGroups()).rejects.toThrow('503');
    await expect(client.fetchGroups()).resolves.toEqual([]);
  });

  it('reads a group without a prices file, or with an empty one, as no rows', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(new Response('missing', { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 200 })) as unknown as typeof fetch;
    const client = new HttpTcgcsvClient({ fetchFn, sleep: async () => undefined, now: () => 0 });

    await expect(client.fetchPrices(5)).resolves.toEqual([]);
    await expect(client.fetchPrices(6)).resolves.toEqual([]);
  });

  it('still fails a missing group list', async () => {
    const fetchFn = jest.fn().mockResolvedValueOnce(new Response('missing', { status: 404 })) as unknown as typeof fetch;
    const client = new HttpTcgcsvClient({ fetchFn, sleep: async () => undefined, now: () => 0 });

    await expect(client.fetchGroups()).rejects.toThrow('404');
  });
});
