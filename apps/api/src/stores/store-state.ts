import type { StoreStockEntity } from '../database/entities/store-stock.entity';

export type TStoreState = 'priced' | 'store_lacks' | 'not_on_site' | 'looking_up' | 'no_price';

export interface IStoreRowFacts {
  readonly productUrl: string;
  readonly listedInStockAt: Date | null;
  readonly priceCents: number | null;
  readonly quantity: number;
  readonly priceFetchedAt: Date;
}

export interface ILookupFacts {
  readonly pending: boolean;
  readonly lastDoneAt: Date | null;
  readonly lastFailedAt: Date | null;
}

export interface IStoreStateInput {
  readonly row: IStoreRowFacts | null;
  readonly lastAvailabilityPassAt: Date | null;
  readonly lookup: ILookupFacts;
  readonly priceValidDays: number;
  readonly budgetStopped: boolean;
  readonly now: Date;
}

export interface IStoreAnswer {
  readonly state: TStoreState;
  readonly needsLookup: boolean;
}

export const FAILED_LOOKUP_RETRY_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const NO_LOOKUP: ILookupFacts = { pending: false, lastDoneAt: null, lastFailedAt: null };

function answer(state: TStoreState, needsLookup = false): IStoreAnswer {
  return { state, needsLookup };
}

function hasFreshPrice(input: IStoreStateInput, row: IStoreRowFacts): boolean {
  if (row.priceCents === null || row.quantity <= 0) return false;
  return input.now.getTime() - row.priceFetchedAt.getTime() <= input.priceValidDays * DAY_MS;
}

function isListed(input: IStoreStateInput, row: IStoreRowFacts, lookupIsNewer: boolean): boolean {
  if (lookupIsNewer) return true;
  const pass = input.lastAvailabilityPassAt;
  if (pass === null) return true;
  return row.listedInStockAt !== null && row.listedInStockAt.getTime() >= pass.getTime();
}

export function classifyStoreRow(input: IStoreStateInput): IStoreAnswer {
  const { row, lookup, lastAvailabilityPassAt: pass } = input;
  if (row === null || row.productUrl === '') return answer('not_on_site');

  const lookupIsNewer = lookup.lastDoneAt !== null && (pass === null || lookup.lastDoneAt.getTime() > pass.getTime());
  if (lookupIsNewer && row.quantity === 0) return answer('store_lacks');
  if (!isListed(input, row, lookupIsNewer)) return answer('store_lacks');
  if (hasFreshPrice(input, row)) return answer('priced');
  if (lookup.pending) return answer('looking_up');

  const failedAt = lookup.lastFailedAt;
  const lastLookupFailed = failedAt !== null && (lookup.lastDoneAt === null || failedAt.getTime() > lookup.lastDoneAt.getTime());
  if (lastLookupFailed) {
    return answer('no_price', !input.budgetStopped && input.now.getTime() - failedAt.getTime() >= FAILED_LOOKUP_RETRY_MS);
  }
  if (input.budgetStopped) return answer('no_price');
  return answer('looking_up', true);
}

export function resolveStoreState(input: IStoreStateInput): TStoreState {
  return classifyStoreRow(input).state;
}

export function rowFactsOf(stock: StoreStockEntity): IStoreRowFacts {
  return {
    productUrl: stock.productUrl,
    listedInStockAt: stock.listedInStockAt,
    priceCents: stock.priceCents,
    quantity: stock.quantity,
    priceFetchedAt: stock.lastFetchedAt,
  };
}
