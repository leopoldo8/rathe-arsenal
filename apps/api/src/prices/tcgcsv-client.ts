import { ITcgcsvGroup, ITcgcsvPriceRow, groupsUrl, lastUpdatedUrl, parseGroups, parseLastUpdated, parsePriceRows, pricesUrl } from './tcgcsv-parse';

export const TCGCSV_CLIENT = Symbol('TCGCSV_CLIENT');

export interface ITcgcsvClient {
  fetchLastUpdated(): Promise<Date>;
  fetchGroups(): Promise<ITcgcsvGroup[]>;
  fetchPrices(groupId: number): Promise<ITcgcsvPriceRow[]>;
}

export const PRICE_SYNC_USER_AGENT = 'rathe-arsenal-price-sync/1.0 (+https://github.com/leopoldo8/rathe-arsenal)';
export const MIN_REQUEST_INTERVAL_MS = 1000;
const REQUEST_TIMEOUT_MS = 30_000;

export interface IHttpTcgcsvClientOptions {
  readonly fetchFn?: typeof fetch;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly now?: () => number;
  readonly minIntervalMs?: number;
}

const realSleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** tcgcsv asks for a custom User-Agent and spaced requests; every request goes through one queue that enforces both. */
export class HttpTcgcsvClient implements ITcgcsvClient {
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => number;
  private readonly minIntervalMs: number;
  private lastRequestAt: number | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: IHttpTcgcsvClientOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.sleep = options.sleep ?? realSleep;
    this.now = options.now ?? Date.now;
    this.minIntervalMs = options.minIntervalMs ?? MIN_REQUEST_INTERVAL_MS;
  }

  async fetchLastUpdated(): Promise<Date> {
    const parsed = parseLastUpdated(await this.getText(lastUpdatedUrl()));
    if (!parsed) throw new Error('tcgcsv last-updated.txt is not a date');
    return parsed;
  }

  async fetchGroups(): Promise<ITcgcsvGroup[]> {
    return parseGroups(JSON.parse(await this.getText(groupsUrl())));
  }

  async fetchPrices(groupId: number): Promise<ITcgcsvPriceRow[]> {
    return parsePriceRows(JSON.parse(await this.getText(pricesUrl(groupId))));
  }

  private getText(url: string): Promise<string> {
    const run = this.queue.then(() => this.spacedGet(url));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async spacedGet(url: string): Promise<string> {
    if (this.lastRequestAt !== null) {
      const wait = this.lastRequestAt + this.minIntervalMs - this.now();
      if (wait > 0) await this.sleep(wait);
    }
    this.lastRequestAt = this.now();
    const response = await this.fetchFn(url, {
      headers: { 'User-Agent': PRICE_SYNC_USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`tcgcsv answered ${response.status} for ${url}`);
    return response.text();
  }
}
