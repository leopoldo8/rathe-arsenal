import { IStoreRowFacts, IStoreStateInput, resolveStoreState, TStoreState } from '../store-state';

type TOverrides = Omit<Partial<IStoreStateInput>, 'row'> & { readonly row?: Partial<IStoreRowFacts> | null };

const NOW = new Date('2026-10-25T12:00:00Z');
const PASS = new Date('2026-10-22T03:00:00Z');
const BEFORE_PASS = new Date('2026-10-15T03:00:00Z');
const AFTER_PASS = new Date('2026-10-23T09:00:00Z');
const FRESH = new Date('2026-10-10T00:00:00Z');
const STALE = new Date('2026-08-01T00:00:00Z');

function input(overrides: TOverrides = {}): IStoreStateInput {
  const { row, ...rest } = overrides;
  return {
    row:
      row === null
        ? null
        : {
            productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=1',
            listedInStockAt: PASS,
            priceCents: 6999,
            quantity: 3,
            priceFetchedAt: FRESH,
            ...row,
          },
    lastAvailabilityPassAt: PASS,
    lookup: { pending: false, lastDoneAt: null, lastFailedAt: null },
    priceValidDays: 30,
    budgetStopped: false,
    now: NOW,
    ...rest,
  };
}

describe('resolveStoreState', () => {
  it('every input row gets exactly one store state', () => {
    const table: ReadonlyArray<readonly [string, IStoreStateInput, TStoreState]> = [
      ['listed in the latest pass with a stocked lookup', input({ lookup: { pending: false, lastDoneAt: BEFORE_PASS, lastFailedAt: null } }), 'priced'],
      [
        'a lookup newer than the pass with zero stock',
        input({ row: { priceCents: null, quantity: 0 }, lookup: { pending: false, lastDoneAt: AFTER_PASS, lastFailedAt: null } }),
        'store_lacks',
      ],
      ['not listed in the latest pass and no newer lookup', input({ row: { listedInStockAt: BEFORE_PASS } }), 'store_lacks'],
      ['never listed by any pass', input({ row: { listedInStockAt: null } }), 'store_lacks'],
      [
        'a newer lookup with stock overrides an absent listing',
        input({ row: { listedInStockAt: BEFORE_PASS, priceFetchedAt: AFTER_PASS }, lookup: { pending: false, lastDoneAt: AFTER_PASS, lastFailedAt: null } }),
        'priced',
      ],
      ['no store_stock row', input({ row: null }), 'not_on_site'],
      ['a row with no product url', input({ row: { productUrl: '' } }), 'not_on_site'],
      [
        'listed with a pending lookup',
        input({ row: { priceCents: null, quantity: 0 }, lookup: { pending: true, lastDoneAt: null, lastFailedAt: null } }),
        'looking_up',
      ],
      ['listed with no price and nothing queued yet', input({ row: { priceCents: null, quantity: 0 } }), 'looking_up'],
      ['listed with a price past the validity window and a pending lookup', input({ row: { priceFetchedAt: STALE }, lookup: { pending: true, lastDoneAt: null, lastFailedAt: null } }), 'looking_up'],
      ['listed with the budget stopped', input({ row: { priceCents: null, quantity: 0 }, budgetStopped: true }), 'no_price'],
      [
        'listed with the last lookup failed',
        input({ row: { priceCents: null, quantity: 0 }, lookup: { pending: false, lastDoneAt: null, lastFailedAt: AFTER_PASS } }),
        'no_price',
      ],
      [
        'a lookup that failed after an earlier one succeeded',
        input({ row: { priceCents: null, quantity: 0 }, lookup: { pending: false, lastDoneAt: BEFORE_PASS, lastFailedAt: AFTER_PASS } }),
        'no_price',
      ],
      [
        'a retry queued after a failure',
        input({ row: { priceCents: null, quantity: 0 }, lookup: { pending: true, lastDoneAt: null, lastFailedAt: AFTER_PASS } }),
        'looking_up',
      ],
      ['a fresh price wins over a stopped budget', input({ budgetStopped: true }), 'priced'],
    ];

    for (const [label, row, expected] of table) {
      expect({ label, state: resolveStoreState(row) }).toEqual({ label, state: expected });
    }
  });

  it('judges the price age by the validity window of the configuration', () => {
    const base = { row: { priceFetchedAt: new Date('2026-10-14T12:00:00Z') } };

    expect(resolveStoreState(input({ ...base, priceValidDays: 30 }))).toBe('priced');
    expect(resolveStoreState(input({ ...base, priceValidDays: 10 }))).toBe('looking_up');
  });

  it('before the first pass a listed card is never store_lacks', () => {
    const noPass = { lastAvailabilityPassAt: null };
    const listed = { listedInStockAt: null };
    const lookups: ReadonlyArray<readonly [string, TOverrides]> = [
      ['no lookup', { row: { ...listed, priceCents: null, quantity: 0 } }],
      ['a pending lookup', { row: { ...listed, priceCents: null, quantity: 0 }, lookup: { pending: true, lastDoneAt: null, lastFailedAt: null } }],
      ['a failed lookup', { row: { ...listed, priceCents: null, quantity: 0 }, lookup: { pending: false, lastDoneAt: null, lastFailedAt: AFTER_PASS } }],
      ['the budget stopped', { row: { ...listed, priceCents: null, quantity: 0 }, budgetStopped: true }],
      ['a stocked lookup', { row: { ...listed, priceFetchedAt: AFTER_PASS }, lookup: { pending: false, lastDoneAt: AFTER_PASS, lastFailedAt: null } }],
      ['a stocked lookup with a stale price', { row: { ...listed, priceFetchedAt: STALE }, lookup: { pending: false, lastDoneAt: STALE, lastFailedAt: null } }],
      ['a price from before the lookups existed', { row: { ...listed } }],
    ];

    for (const [label, overrides] of lookups) {
      expect({ label, isLacks: resolveStoreState(input({ ...noPass, ...overrides })) === 'store_lacks' }).toEqual({ label, isLacks: false });
    }
    const zeroStock = input({
      ...noPass,
      row: { ...listed, priceCents: null, quantity: 0 },
      lookup: { pending: false, lastDoneAt: AFTER_PASS, lastFailedAt: null },
    });
    expect(resolveStoreState(zeroStock)).toBe('store_lacks');
  });
});
