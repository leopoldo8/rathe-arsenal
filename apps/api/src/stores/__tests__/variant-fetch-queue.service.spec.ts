import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { VariantFetchQueueService } from '../variant-fetch-queue.service';
import { CreditBudgetService } from '../credit-budget.service';
import { VariantFetchJobEntity } from '../../database/entities/variant-fetch-job.entity';
import { StoreEntity } from '../../database/entities/store.entity';
import { StoreStockEntity } from '../../database/entities/store-stock.entity';

const NOW = new Date('2026-10-25T12:00:00Z');
const PASS = new Date('2026-10-22T03:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const CARD = 'pack-hunt-red';

interface IBuildOptions {
  readonly env?: Record<string, unknown>;
  readonly stock?: Partial<StoreStockEntity>[];
  readonly facts?: Array<{ cardIdentifier: string; pending: boolean; lastDoneAt: Date | null; lastFailedAt: Date | null }>;
  readonly budgetAllows?: boolean;
}

function stockRow(cardIdentifier: string, overrides: Partial<StoreStockEntity> = {}): StoreStockEntity {
  return {
    storeId: 1,
    cardIdentifier,
    priceCents: 6999,
    quantity: 3,
    productUrl: `https://www.cupuladt.com.br/?view=ecom/item&id=${cardIdentifier}`,
    lastFetchedAt: new Date(NOW.getTime() - 10 * DAY_MS),
    listedInStockAt: PASS,
    ...overrides,
  } as StoreStockEntity;
}

async function build(options: IBuildOptions = {}): Promise<{
  service: VariantFetchQueueService;
  jobRepo: jest.Mocked<Repository<VariantFetchJobEntity>>;
  budget: jest.Mocked<CreditBudgetService>;
  inserts: () => Array<{ storeId: number; cardIdentifiers: string[] }>;
}> {
  const jobRepo = createMock<Repository<VariantFetchJobEntity>>();
  jobRepo.query.mockImplementation((async (sql: string) => {
    if (sql.includes('INSERT INTO variant_fetch_job')) return [];
    return options.facts ?? [];
  }) as never);
  const storeRepo = createMock<Repository<StoreEntity>>();
  storeRepo.findOne.mockResolvedValue({ id: 1, lastAvailabilityPassAt: PASS } as never);
  const stockRepo = createMock<Repository<StoreStockEntity>>();
  stockRepo.find.mockResolvedValue((options.stock ?? []) as never);
  const budget = createMock<CreditBudgetService>();
  budget.allowAutomaticLookups.mockResolvedValue(options.budgetAllows ?? true);
  const config = createMock<ConfigService>();
  (config.get as jest.Mock).mockImplementation((key: string) => options.env?.[key]);
  const moduleRef = await Test.createTestingModule({
    providers: [
      VariantFetchQueueService,
      { provide: getRepositoryToken(VariantFetchJobEntity), useValue: jobRepo },
      { provide: getRepositoryToken(StoreEntity), useValue: storeRepo },
      { provide: getRepositoryToken(StoreStockEntity), useValue: stockRepo },
      { provide: CreditBudgetService, useValue: budget },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();
  return {
    service: moduleRef.get(VariantFetchQueueService),
    jobRepo,
    budget,
    inserts: () =>
      jobRepo.query.mock.calls
        .filter(([sql]) => String(sql).includes('INSERT INTO variant_fetch_job'))
        .map(([, params]) => ({ storeId: (params as [number, string[]])[0], cardIdentifiers: (params as [number, string[]])[1] })),
  };
}

describe('VariantFetchQueueService', () => {
  it('queues a lookup only for a card with no price or a price past the validity window', async () => {
    const agedBy = (days: number): Partial<StoreStockEntity> => ({ lastFetchedAt: new Date(NOW.getTime() - days * DAY_MS) });

    const young = await build({ stock: [stockRow(CARD, agedBy(29))] });
    expect(await young.service.enqueueMissing(1, [CARD], NOW)).toEqual([]);
    expect(young.inserts()).toEqual([]);

    const old = await build({ stock: [stockRow(CARD, agedBy(31))] });
    expect(await old.service.enqueueMissing(1, [CARD], NOW)).toEqual([CARD]);
    expect(old.inserts()).toEqual([{ storeId: 1, cardIdentifiers: [CARD] }]);

    const noPrice = await build({ stock: [stockRow(CARD, { priceCents: null, quantity: 0 })] });
    expect(await noPrice.service.enqueueMissing(1, [CARD], NOW)).toEqual([CARD]);

    const shortWindow = await build({ env: { STORE_PRICE_VALID_DAYS: 10 }, stock: [stockRow(CARD, agedBy(11))] });
    expect(await shortWindow.service.enqueueMissing(1, [CARD], NOW)).toEqual([CARD]);
    const insideShortWindow = await build({ env: { STORE_PRICE_VALID_DAYS: 10 }, stock: [stockRow(CARD, agedBy(9))] });
    expect(await insideShortWindow.service.enqueueMissing(1, [CARD], NOW)).toEqual([]);
  });

  it('queues nothing for a card the store does not list, has no page for, or already has a lookup for', async () => {
    const unlisted = stockRow('snatch-red', { priceCents: null, quantity: 0, listedInStockAt: new Date(PASS.getTime() - 7 * DAY_MS) });
    const noPage = stockRow('rhinar', { priceCents: null, quantity: 0, productUrl: '' });
    const alreadyQueued = stockRow('sink-below-red', { priceCents: null, quantity: 0 });
    const { service, inserts } = await build({
      stock: [unlisted, noPage, alreadyQueued],
      facts: [{ cardIdentifier: 'sink-below-red', pending: true, lastDoneAt: null, lastFailedAt: null }],
    });

    const queued = await service.enqueueMissing(1, ['snatch-red', 'rhinar', 'sink-below-red', 'unknown-card'], NOW);

    expect(queued).toEqual([]);
    expect(inserts()).toEqual([]);
  });

  it('queues each card once even when it is asked for twice', async () => {
    const { service, inserts } = await build({ stock: [stockRow(CARD, { priceCents: null, quantity: 0 })] });

    await service.enqueueMissing(1, [CARD, CARD], NOW);

    expect(inserts()).toEqual([{ storeId: 1, cardIdentifiers: [CARD] }]);
  });

  it('queues nothing while the budget is stopped', async () => {
    const { service, inserts, budget } = await build({
      stock: [stockRow(CARD, { priceCents: null, quantity: 0 })],
      budgetAllows: false,
    });

    expect(await service.enqueueMissing(1, [CARD], NOW)).toEqual([]);

    expect(budget.allowAutomaticLookups).toHaveBeenCalledWith(NOW);
    expect(inserts()).toEqual([]);
  });

  it('a failed lookup is retried no sooner than an hour later', async () => {
    const failedAgo = (minutes: number) => [
      { cardIdentifier: CARD, pending: false, lastDoneAt: null, lastFailedAt: new Date(NOW.getTime() - minutes * MINUTE_MS) },
    ];
    const stock = [stockRow(CARD, { priceCents: null, quantity: 0 })];

    const tooSoon = await build({ stock, facts: failedAgo(59) });
    expect(await tooSoon.service.enqueueMissing(1, [CARD], NOW)).toEqual([]);
    expect(tooSoon.inserts()).toEqual([]);

    const later = await build({ stock, facts: failedAgo(61) });
    expect(await later.service.enqueueMissing(1, [CARD], NOW)).toEqual([CARD]);
    expect(later.inserts()).toEqual([{ storeId: 1, cardIdentifiers: [CARD] }]);
  });

  it('claimNext returns null on an empty queue (TypeORM UPDATE returns [rows, rowCount])', async () => {
    const { service, jobRepo } = await build();
    jobRepo.query.mockResolvedValue([[], 0]);

    expect(await service.claimNext('worker-1')).toBeNull();
  });

  it('claimNext returns the claimed job from the [rows, rowCount] shape', async () => {
    const { service, jobRepo } = await build();
    const job = { id: 'job-9', cards: [{ cardIdentifier: 'a-red', status: 'pending' }] } as VariantFetchJobEntity;
    jobRepo.query.mockResolvedValue([[job], 1]);

    expect((await service.claimNext('worker-1'))?.id).toBe('job-9');
  });

  it('claimNext starts no lookup while the budget is stopped, even for a job queued before it was reached', async () => {
    const { service, jobRepo } = await build({ budgetAllows: false });
    jobRepo.query.mockResolvedValue([[{ id: 'job-queued-earlier', cards: [] }], 1]);

    expect(await service.claimNext('worker-1')).toBeNull();

    expect(jobRepo.query).not.toHaveBeenCalled();
  });

  it('claimNext fails closed when the credits cannot be read', async () => {
    const { service, jobRepo, budget } = await build();
    budget.allowAutomaticLookups.mockRejectedValue(new Error('connection lost'));
    jobRepo.query.mockResolvedValue([[{ id: 'job-queued-earlier', cards: [] }], 1]);

    expect(await service.claimNext('worker-1')).toBeNull();

    expect(jobRepo.query).not.toHaveBeenCalled();
  });
});
