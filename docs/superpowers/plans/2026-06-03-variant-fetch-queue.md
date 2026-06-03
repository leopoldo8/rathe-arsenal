# Variant-Fetch Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the obfuscated listing scrape with a DB-backed job queue that drains card detail-page fetches, surfaced as a global header progress pill.

**Architecture:** A `variant_fetch_job` Postgres table is the queue and the single source of progress truth. The API enqueues a job on the "Get exact prices" CTA; a continuously-running worker (repurposed `scrapper-worker`) claims jobs (`FOR UPDATE SKIP LOCKED`), fetches each card's detail page (reusing the existing parser), writes `store_stock_variant` + a derived `store_stock` row, and updates job counters. The web polls `GET /variant-jobs` and renders a header pill → per-deck panel with aggregate ETA.

**Tech Stack:** NestJS + TypeORM (Postgres), Jest (api tests), React + TanStack Query + Vitest (web tests), Playwright (e2e/visual).

**Spec:** `docs/superpowers/specs/2026-06-03-variant-fetch-queue-design.md`

---

## File Structure

**Backend (apps/api)**
- Create `src/database/entities/variant-fetch-job.entity.ts` — the job/queue row.
- Create `src/database/migrations/1778533582000-AddVariantFetchJob.ts` — table + indexes.
- Create `src/stores/variant-fetch-queue.service.ts` — enqueue, claim, progress updates, orphan reclaim, user-jobs query, ETA.
- Create `src/stores/store-stock-derivation.ts` — pure derivation of representative price/stock from variants.
- Create `src/stores/variant-job-processor.service.ts` — process ONE job: per-card fetch/parse/persist (reuses detail parser) + derived store_stock + counter updates.
- Create `src/stores/variant-queue-worker.ts` — standalone continuous drainer entry point.
- Create `src/decks/dtos/variant-job.response.dto.ts` — `GET /variant-jobs` shape.
- Modify `src/decks/variant-fetch.controller.ts` — `POST .../fetch-variants` enqueues; add `GET /variant-jobs`.
- Modify `src/stores/stores.module.ts` / `src/decks/decks.module.ts` — wire new providers + entity.
- Delete/trim `src/stores/variant-fetch.service.ts` in-memory machinery (progressMap/activeFetchSet/startFetch) once the processor replaces it.

**Frontend (apps/web)**
- Create `src/api/variant-jobs.ts` — `useVariantJobsQuery` + types.
- Create `src/components/variant-queue/VariantQueuePill.tsx` (+ `.module.css`).
- Create `src/components/variant-queue/VariantQueuePanel.tsx` (+ `.module.css`).
- Modify `src/components/shell/AppShell.tsx` — mount the pill.
- Modify `src/routes/_auth/decks.$deckId.tsx`, `src/components/ShoppingLine.tsx`, `src/components/deck-detail/ShoppingPanel.tsx` — enqueue + read progress from jobs query; drop in-memory progress.

**Ops**
- Modify the Railway `scrapper-worker` start command (cron one-shot → `node dist/stores/variant-queue-worker.js`).

---

## Task 1: `variant_fetch_job` entity

**Files:**
- Create: `apps/api/src/database/entities/variant-fetch-job.entity.ts`
- Test: `apps/api/src/database/entities/__tests__/variant-fetch-job.entity.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { EVariantFetchJobStatus, VariantFetchJobEntity } from '../variant-fetch-job.entity';

describe('VariantFetchJobEntity', () => {
  it('exposes the lifecycle status enum values', () => {
    expect(EVariantFetchJobStatus.Pending).toBe('pending');
    expect(EVariantFetchJobStatus.Running).toBe('running');
    expect(EVariantFetchJobStatus.Done).toBe('done');
    expect(EVariantFetchJobStatus.Failed).toBe('failed');
    expect(EVariantFetchJobStatus.Canceled).toBe('canceled');
  });

  it('constructs with default counters', () => {
    const job = new VariantFetchJobEntity();
    job.cards = [{ cardIdentifier: 'a-red', status: 'pending' }];
    expect(job.cards[0].cardIdentifier).toBe('a-red');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rathe-arsenal/api test -- variant-fetch-job.entity`
Expected: FAIL — cannot find module `../variant-fetch-job.entity`.

- [ ] **Step 3: Write the entity**

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Lifecycle of a variant-fetch job. */
export enum EVariantFetchJobStatus {
  Pending = 'pending',
  Running = 'running',
  Done = 'done',
  Failed = 'failed',
  Canceled = 'canceled',
}

/** Per-card status inside a job's `cards` jsonb column. */
export type TVariantJobCardStatus = 'pending' | 'done' | 'failed';

export interface IVariantJobCard {
  readonly cardIdentifier: string;
  readonly status: TVariantJobCardStatus;
}

/**
 * A queued request to fetch detail-page variants for a deck's missing cards.
 * Rows are the queue AND the source of progress truth. A single continuous
 * worker claims `pending` rows via `FOR UPDATE SKIP LOCKED`.
 */
@Entity({ name: 'variant_fetch_job' })
@Index(['status', 'enqueuedAt'])
@Index(['userId', 'status'])
@Index(['deckId', 'status'])
export class VariantFetchJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int' })
  userId!: number;

  @Column({ type: 'int' })
  deckId!: number;

  @Column({ type: 'int' })
  storeId!: number;

  @Column({ type: 'enum', enum: EVariantFetchJobStatus, default: EVariantFetchJobStatus.Pending })
  status!: EVariantFetchJobStatus;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  cards!: IVariantJobCard[];

  @Column({ type: 'int', default: 0 })
  total!: number;

  @Column({ type: 'int', default: 0 })
  completed!: number;

  @Column({ type: 'int', default: 0 })
  failed!: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  enqueuedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  claimedAt!: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  claimedBy!: string | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rathe-arsenal/api test -- variant-fetch-job.entity`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/database/entities/variant-fetch-job.entity.ts apps/api/src/database/entities/__tests__/variant-fetch-job.entity.spec.ts
git commit -m "feat(api): add variant_fetch_job entity"
```

---

## Task 2: Migration for `variant_fetch_job`

**Files:**
- Create: `apps/api/src/database/migrations/1778533582000-AddVariantFetchJob.ts`

- [ ] **Step 1: Write the migration**

```typescript
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Creates `variant_fetch_job` — the DB-backed queue + progress store for
 * detail-page variant fetching (replaces the in-memory progress tracker).
 */
export class AddVariantFetchJob1778533582000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.createTable(
      new Table({
        name: 'variant_fetch_job',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'userId', type: 'int' },
          { name: 'deckId', type: 'int' },
          { name: 'storeId', type: 'int' },
          { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
          { name: 'cards', type: 'jsonb', default: "'[]'" },
          { name: 'total', type: 'int', default: 0 },
          { name: 'completed', type: 'int', default: 0 },
          { name: 'failed', type: 'int', default: 0 },
          { name: 'enqueuedAt', type: 'timestamptz', default: 'now()' },
          { name: 'startedAt', type: 'timestamptz', isNullable: true },
          { name: 'finishedAt', type: 'timestamptz', isNullable: true },
          { name: 'claimedAt', type: 'timestamptz', isNullable: true },
          { name: 'claimedBy', type: 'varchar', length: '100', isNullable: true },
          { name: 'error', type: 'text', isNullable: true },
        ],
      }),
      true,
    );
    await queryRunner.createIndex('variant_fetch_job', new TableIndex({ name: 'IDX_vfj_status_enqueued', columnNames: ['status', 'enqueuedAt'] }));
    await queryRunner.createIndex('variant_fetch_job', new TableIndex({ name: 'IDX_vfj_user_status', columnNames: ['userId', 'status'] }));
    await queryRunner.createIndex('variant_fetch_job', new TableIndex({ name: 'IDX_vfj_deck_status', columnNames: ['deckId', 'status'] }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('variant_fetch_job', true);
  }
}
```

> Note: the entity uses `@Column({ type: 'enum' })` but the migration creates a
> `varchar(20)`. Keep them aligned — change the entity column to
> `{ type: 'varchar', length: 20, default: EVariantFetchJobStatus.Pending }` in
> Task 1's file if `schema:log` reports drift. Verify with the next step.

- [ ] **Step 2: Align entity column type to varchar**

Edit `apps/api/src/database/entities/variant-fetch-job.entity.ts` — replace the `status` column decorator with:

```typescript
  @Column({ type: 'varchar', length: 20, default: EVariantFetchJobStatus.Pending })
  status!: EVariantFetchJobStatus;
```

- [ ] **Step 3: Run the migration against a local/test DB and check drift**

Run: `pnpm --filter @rathe-arsenal/api migration:run` then `pnpm --filter @rathe-arsenal/api typeorm schema:log`
Expected: migration applies; `schema:log` reports no pending changes for `variant_fetch_job`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/database/migrations/1778533582000-AddVariantFetchJob.ts apps/api/src/database/entities/variant-fetch-job.entity.ts
git commit -m "feat(api): migration for variant_fetch_job table"
```

---

## Task 3: `store_stock` derivation (pure function)

**Files:**
- Create: `apps/api/src/stores/store-stock-derivation.ts`
- Test: `apps/api/src/stores/__tests__/store-stock-derivation.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { deriveStoreStock } from '../store-stock-derivation';
import { IScrapedVariant } from '../types/scraped-variant';

const v = (priceCents: number, quantity: number): IScrapedVariant => ({
  edition: 'PEN', condition: 'NM', finish: 'non-foil', priceCents, quantity,
});

describe('deriveStoreStock', () => {
  it('returns cheapest in-stock price and summed quantity', () => {
    const r = deriveStoreStock([v(300, 1), v(100, 9), v(250, 2)]);
    expect(r).toEqual({ priceCents: 100, quantity: 12 });
  });

  it('returns null price and zero quantity when no variants', () => {
    expect(deriveStoreStock([])).toEqual({ priceCents: null, quantity: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rathe-arsenal/api test -- store-stock-derivation`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

```typescript
import { IScrapedVariant } from './types/scraped-variant';

export interface IDerivedStoreStock {
  readonly priceCents: number | null;
  readonly quantity: number;
}

/**
 * Representative store_stock from a card's detail-page variants:
 * cheapest in-stock price + summed in-stock quantity. Variants are already
 * filtered to quantity > 0 with available prices by the detail parser.
 */
export function deriveStoreStock(variants: readonly IScrapedVariant[]): IDerivedStoreStock {
  if (variants.length === 0) return { priceCents: null, quantity: 0 };
  const priceCents = Math.min(...variants.map((v) => v.priceCents));
  const quantity = variants.reduce((sum, v) => sum + v.quantity, 0);
  return { priceCents, quantity };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rathe-arsenal/api test -- store-stock-derivation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/stores/store-stock-derivation.ts apps/api/src/stores/__tests__/store-stock-derivation.spec.ts
git commit -m "feat(api): store_stock derivation from variants"
```

---

## Task 4: Queue service — enqueue + claim + reclaim + user jobs

**Files:**
- Create: `apps/api/src/stores/variant-fetch-queue.service.ts`
- Test: `apps/api/src/stores/__tests__/variant-fetch-queue.service.spec.ts`
- Modify: `apps/api/src/stores/stores.module.ts` (register entity + provider)

The store rate limit is 1500 ms; reuse it for ETA. Orphan threshold: 5 minutes.

- [ ] **Step 1: Write the failing test (enqueue dedup + ETA)**

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { VariantFetchQueueService, RATE_LIMIT_MS } from '../variant-fetch-queue.service';
import { EVariantFetchJobStatus, VariantFetchJobEntity } from '../../database/entities/variant-fetch-job.entity';

describe('VariantFetchQueueService', () => {
  let service: VariantFetchQueueService;
  let repo: jest.Mocked<Repository<VariantFetchJobEntity>>;

  beforeEach(async () => {
    repo = createMock<Repository<VariantFetchJobEntity>>();
    const moduleRef = await Test.createTestingModule({
      providers: [
        VariantFetchQueueService,
        { provide: getRepositoryToken(VariantFetchJobEntity), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(VariantFetchQueueService);
  });

  it('returns the existing pending/running job for a deck instead of duplicating', async () => {
    const existing = { id: 'job-1', status: EVariantFetchJobStatus.Pending } as VariantFetchJobEntity;
    repo.findOne.mockResolvedValue(existing);
    const result = await service.enqueue(7, 42, 1, [{ cardIdentifier: 'a-red', productUrl: 'u', listingPriceCents: null, listingQuantity: 0 }]);
    expect(result.id).toBe('job-1');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('computes ETA as remaining cards times the rate limit', () => {
    const eta = service.computeEtaSeconds([
      { total: 10, completed: 4, failed: 0 } as VariantFetchJobEntity,
      { total: 5, completed: 0, failed: 1 } as VariantFetchJobEntity,
    ]);
    // remaining = (10-4-0) + (5-0-1) = 6 + 4 = 10 cards
    expect(eta).toBe(Math.ceil((10 * RATE_LIMIT_MS) / 1000));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rathe-arsenal/api test -- variant-fetch-queue.service`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the service**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  EVariantFetchJobStatus,
  IVariantJobCard,
  VariantFetchJobEntity,
} from '../database/entities/variant-fetch-job.entity';
import { IFetchCard } from './variant-fetch.service';

export const RATE_LIMIT_MS = 1500;
export const ORPHAN_RECLAIM_MS = 5 * 60 * 1000;

@Injectable()
export class VariantFetchQueueService {
  constructor(
    @InjectRepository(VariantFetchJobEntity)
    private readonly jobRepo: Repository<VariantFetchJobEntity>,
  ) {}

  /** Insert a job, or return the existing pending/running one for the deck. */
  async enqueue(
    userId: number,
    deckId: number,
    storeId: number,
    cards: readonly IFetchCard[],
  ): Promise<VariantFetchJobEntity> {
    const existing = await this.jobRepo.findOne({
      where: { deckId, status: In([EVariantFetchJobStatus.Pending, EVariantFetchJobStatus.Running]) },
    });
    if (existing) return existing;

    const cardRows: IVariantJobCard[] = cards.map((c) => ({ cardIdentifier: c.cardIdentifier, status: 'pending' }));
    const job = this.jobRepo.create({
      userId, deckId, storeId,
      status: EVariantFetchJobStatus.Pending,
      cards: cardRows,
      total: cardRows.length,
      completed: 0,
      failed: 0,
    });
    return this.jobRepo.save(job);
  }

  /** Atomically claim the oldest pending job. Returns null when the queue is empty. */
  async claimNext(workerId: string): Promise<VariantFetchJobEntity | null> {
    const rows: VariantFetchJobEntity[] = await this.jobRepo.query(
      `UPDATE variant_fetch_job SET status = $1, "claimedAt" = now(), "claimedBy" = $2, "startedAt" = COALESCE("startedAt", now())
       WHERE id = (
         SELECT id FROM variant_fetch_job WHERE status = $3
         ORDER BY "enqueuedAt" FOR UPDATE SKIP LOCKED LIMIT 1
       ) RETURNING *`,
      [EVariantFetchJobStatus.Running, workerId, EVariantFetchJobStatus.Pending],
    );
    return rows[0] ?? null;
  }

  /** Reset jobs stuck in `running` past the orphan threshold back to pending. */
  async reclaimOrphans(): Promise<void> {
    await this.jobRepo.query(
      `UPDATE variant_fetch_job SET status = $1, "claimedAt" = NULL, "claimedBy" = NULL
       WHERE status = $2 AND "claimedAt" < now() - ($3 || ' milliseconds')::interval`,
      [EVariantFetchJobStatus.Pending, EVariantFetchJobStatus.Running, String(ORPHAN_RECLAIM_MS)],
    );
  }

  async markCardResult(jobId: string, cardIdentifier: string, ok: boolean): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return;
    const cards = job.cards.map((c) =>
      c.cardIdentifier === cardIdentifier ? { ...c, status: (ok ? 'done' : 'failed') as const } : c,
    );
    await this.jobRepo.update(
      { id: jobId },
      { cards, completed: ok ? job.completed + 1 : job.completed, failed: ok ? job.failed : job.failed + 1 },
    );
  }

  async finish(jobId: string, error: string | null): Promise<void> {
    await this.jobRepo.update(
      { id: jobId },
      { status: error ? EVariantFetchJobStatus.Failed : EVariantFetchJobStatus.Done, finishedAt: new Date(), error },
    );
  }

  /** Active + recently-finished (last 2 min) jobs for a user. */
  async listForUser(userId: number): Promise<VariantFetchJobEntity[]> {
    return this.jobRepo.query(
      `SELECT * FROM variant_fetch_job
       WHERE "userId" = $1
         AND (status IN ($2, $3) OR "finishedAt" > now() - interval '2 minutes')
       ORDER BY "enqueuedAt" DESC`,
      [userId, EVariantFetchJobStatus.Pending, EVariantFetchJobStatus.Running],
    );
  }

  computeEtaSeconds(jobs: readonly VariantFetchJobEntity[]): number {
    const remaining = jobs.reduce((sum, j) => sum + Math.max(0, j.total - j.completed - j.failed), 0);
    return Math.ceil((remaining * RATE_LIMIT_MS) / 1000);
  }
}
```

- [ ] **Step 4: Register in the module**

Edit `apps/api/src/stores/stores.module.ts`: add `VariantFetchJobEntity` to `TypeOrmModule.forFeature([...])`, add `VariantFetchQueueService` to `providers` and `exports`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @rathe-arsenal/api test -- variant-fetch-queue.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/stores/variant-fetch-queue.service.ts apps/api/src/stores/__tests__/variant-fetch-queue.service.spec.ts apps/api/src/stores/stores.module.ts
git commit -m "feat(api): variant-fetch queue service (enqueue/claim/reclaim/eta)"
```

---

## Task 5: Job processor — process one job

**Files:**
- Create: `apps/api/src/stores/variant-job-processor.service.ts`
- Test: `apps/api/src/stores/__tests__/variant-job-processor.service.spec.ts`
- Modify: `apps/api/src/stores/stores.module.ts`

This reuses the existing per-card fetch/parse/persist logic. Extract the body of
`VariantFetchService.fetchAndPersistCard` (apps/api/src/stores/variant-fetch.service.ts:298)
into a shared private method on the processor, ADDING the `deriveStoreStock` +
`store_stock` upsert after the variant transaction, and calling
`queue.markCardResult` instead of mutating the in-memory progress object.

- [ ] **Step 1: Write the failing test**

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, Repository } from 'typeorm';
import { VariantJobProcessorService } from '../variant-job-processor.service';
import { VariantFetchQueueService } from '../variant-fetch-queue.service';
import { SbraubleDetailParserService } from '../sbrauble-detail-parser.service';
import { FetchGuardService } from '../../common/fetch-guard/fetch-guard.service';
import { StoreEntity } from '../../database/entities/store.entity';
import { StoreStockEntity } from '../../database/entities/store-stock.entity';
import { VariantFetchJobEntity, EVariantFetchJobStatus } from '../../database/entities/variant-fetch-job.entity';

describe('VariantJobProcessorService', () => {
  it('derives and upserts store_stock from parsed variants and marks the card done', async () => {
    const fetchGuard = createMock<FetchGuardService>();
    fetchGuard.guardedFetch.mockResolvedValue({ body: Buffer.from('<html></html>') } as never);
    const parser = createMock<SbraubleDetailParserService>();
    parser.parseDetailPage.mockReturnValue([
      { edition: 'PEN', condition: 'NM', finish: 'non-foil', priceCents: 300, quantity: 2 },
      { edition: 'PEN', condition: 'NM', finish: 'foil', priceCents: 100, quantity: 1 },
    ]);
    const storeRepo = createMock<Repository<StoreEntity>>();
    storeRepo.findOne.mockResolvedValue({ id: 1, slug: 'cupula-dt', baseUrl: 'https://www.cupuladt.com.br', lastFetchedAt: null, rateLimitMs: 0 } as never);
    const stockRepo = createMock<Repository<StoreStockEntity>>();
    const queue = createMock<VariantFetchQueueService>();
    const dataSource = createMock<DataSource>();
    dataSource.transaction.mockImplementation(async (cb: never) => (cb as (em: unknown) => Promise<unknown>)(createMock()));

    const moduleRef = await Test.createTestingModule({
      providers: [
        VariantJobProcessorService,
        { provide: FetchGuardService, useValue: fetchGuard },
        { provide: SbraubleDetailParserService, useValue: parser },
        { provide: VariantFetchQueueService, useValue: queue },
        { provide: getRepositoryToken(StoreEntity), useValue: storeRepo },
        { provide: getRepositoryToken(StoreStockEntity), useValue: stockRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    const processor = moduleRef.get(VariantJobProcessorService);

    const job = {
      id: 'job-1', storeId: 1, status: EVariantFetchJobStatus.Running,
      cards: [{ cardIdentifier: 'a-red', status: 'pending' }],
    } as VariantFetchJobEntity;

    await processor.process(job, [{ cardIdentifier: 'a-red', productUrl: 'https://www.cupuladt.com.br/x', listingPriceCents: null, listingQuantity: 0 }]);

    // cheapest in-stock (100) + summed quantity (3) upserted into store_stock
    expect(stockRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 1, cardIdentifier: 'a-red', priceCents: 100, quantity: 3 }),
      expect.anything(),
    );
    expect(queue.markCardResult).toHaveBeenCalledWith('job-1', 'a-red', true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rathe-arsenal/api test -- variant-job-processor.service`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the processor**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FetchGuardService } from '../common/fetch-guard/fetch-guard.service';
import { SbraubleDetailParserService } from './sbrauble-detail-parser.service';
import { VariantFetchQueueService } from './variant-fetch-queue.service';
import { StoreEntity } from '../database/entities/store.entity';
import { StoreStockEntity } from '../database/entities/store-stock.entity';
import { StoreStockVariantEntity } from '../database/entities/store-stock-variant.entity';
import { VariantFetchJobEntity } from '../database/entities/variant-fetch-job.entity';
import { IFetchCard } from './variant-fetch.service';
import { deriveStoreStock } from './store-stock-derivation';

const MAX_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

@Injectable()
export class VariantJobProcessorService {
  private readonly logger = new Logger(VariantJobProcessorService.name);

  constructor(
    private readonly fetchGuard: FetchGuardService,
    private readonly parser: SbraubleDetailParserService,
    private readonly queue: VariantFetchQueueService,
    @InjectRepository(StoreEntity) private readonly storeRepo: Repository<StoreEntity>,
    @InjectRepository(StoreStockEntity) private readonly stockRepo: Repository<StoreStockEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Process every card of a claimed job, persisting variants + derived store_stock. */
  async process(job: VariantFetchJobEntity, cards: readonly IFetchCard[]): Promise<void> {
    const store = await this.storeRepo.findOne({ where: { id: job.storeId } });
    if (!store) {
      await this.queue.finish(job.id, `store ${job.storeId} not found`);
      return;
    }
    const hostname = new URL(store.baseUrl).hostname;
    for (const card of cards) {
      try {
        await this.fetchAndPersist(store, hostname, card);
        await this.queue.markCardResult(job.id, card.cardIdentifier, true);
      } catch (err) {
        this.logger.warn({ msg: 'Card variant fetch failed', cardIdentifier: card.cardIdentifier, error: (err as Error).message });
        await this.queue.markCardResult(job.id, card.cardIdentifier, false);
      }
    }
    await this.queue.finish(job.id, null);
  }

  private async fetchAndPersist(store: StoreEntity, hostname: string, card: IFetchCard): Promise<void> {
    const fresh = await this.storeRepo.findOne({ where: { id: store.id } });
    const lastFetchedAt = fresh?.lastFetchedAt ?? null;
    const rateLimitMs = fresh?.rateLimitMs ?? 1500;
    if (lastFetchedAt !== null) {
      const remaining = Math.max(0, rateLimitMs - (Date.now() - lastFetchedAt.getTime()));
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
    }
    const result = await this.fetchGuard.guardedFetch(card.productUrl, {
      allowHosts: [hostname], maxBytes: MAX_BYTES, timeoutMs: REQUEST_TIMEOUT_MS,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RatheArsenal/1.0)', Accept: 'text/html' },
    });
    const now = new Date();
    await this.storeRepo.update({ id: store.id }, { lastFetchedAt: now });
    const variants = this.parser.parseDetailPage(Buffer.from(result.body).toString('utf-8'));

    await this.dataSource.transaction(async (em) => {
      await em.getRepository(StoreStockVariantEntity).delete({ storeId: store.id, cardIdentifier: card.cardIdentifier });
      if (variants.length > 0) {
        await em.getRepository(StoreStockVariantEntity).insert(
          variants.map((v) => ({
            storeId: store.id, cardIdentifier: card.cardIdentifier,
            edition: v.edition, condition: v.condition, finish: v.finish,
            priceCents: v.priceCents, quantity: v.quantity, detailFetchedAt: now,
            listingPriceCentsSnapshot: card.listingPriceCents, listingQuantitySnapshot: card.listingQuantity,
          })),
        );
      }
    });

    const derived = deriveStoreStock(variants);
    await this.stockRepo.upsert(
      {
        storeId: store.id, cardIdentifier: card.cardIdentifier,
        priceCents: derived.priceCents, quantity: derived.quantity,
        productUrl: card.productUrl, productNameRaw: card.cardIdentifier, lastFetchedAt: now,
      },
      ['storeId', 'cardIdentifier'],
    );
  }
}
```

> If `store_stock_variant` columns differ from the names above, copy them
> verbatim from `apps/api/src/stores/variant-fetch.service.ts:340-360` (the
> existing transaction that writes the same rows).
> `store_stock` needs a unique constraint on `(storeId, cardIdentifier)` for
> `upsert`; if missing, add it in the Task 2 migration.

- [ ] **Step 4: Register processor in the module**

Edit `stores.module.ts`: add `StoreStockEntity` + `StoreStockVariantEntity` to `forFeature` if not present; add `VariantJobProcessorService` to `providers`/`exports`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @rathe-arsenal/api test -- variant-job-processor.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/stores/variant-job-processor.service.ts apps/api/src/stores/__tests__/variant-job-processor.service.spec.ts apps/api/src/stores/stores.module.ts
git commit -m "feat(api): variant job processor with store_stock derivation"
```

---

## Task 6: Enqueue endpoint + GET /variant-jobs

**Files:**
- Create: `apps/api/src/decks/dtos/variant-job.response.dto.ts`
- Modify: `apps/api/src/decks/variant-fetch.controller.ts`
- Test: `apps/api/src/decks/__tests__/variant-fetch.controller.int-spec.ts` (extend existing if present, else create)

- [ ] **Step 1: Write the DTO**

```typescript
export interface IVariantJobDto {
  readonly jobId: string;
  readonly deckId: number;
  readonly deckName: string;
  readonly status: 'pending' | 'running' | 'done' | 'failed' | 'canceled';
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
}

export interface IVariantJobsResponse {
  readonly jobs: readonly IVariantJobDto[];
  readonly etaSeconds: number;
}
```

- [ ] **Step 2: Write the failing controller test**

```typescript
it('POST /decks/:id/fetch-variants enqueues a job and returns jobId', async () => {
  // arrange: missing cards resolved, queue.enqueue returns a pending job
  // act: POST
  // assert: 202 with { jobId, status: 'pending' }; queue.enqueue called once
  expect(true).toBe(true); // replace with real wiring against the test module
});

it('GET /variant-jobs returns the user jobs with aggregate etaSeconds', async () => {
  // queue.listForUser returns 1 running job total=10 completed=3 failed=0
  // assert: response.jobs has the deck, response.etaSeconds = ceil(7*1500/1000)=11
  expect(true).toBe(true);
});
```

> Replace the two `expect(true)` placeholders with concrete assertions wired to
> the controller's existing test harness in the same file. Mirror the existing
> `variant-fetch.controller` test setup (mock `VariantFetchQueueService`,
> `JwtAuthGuard`, `OwnsTrackedDeckGuard`).

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @rathe-arsenal/api test -- variant-fetch.controller`
Expected: FAIL — `GET /variant-jobs` route / enqueue behavior absent.

- [ ] **Step 4: Modify the controller**

Replace the body of `triggerVariantFetch` so that, after resolving missing cards
and the freshness check, it calls `this.queue.enqueue(userId, deckId, storeId, cards)`
and returns `{ jobId: job.id, status: job.status }` with HTTP 202. Add:

```typescript
@Get('/variant-jobs')
@UseGuards(JwtAuthGuard)
async listJobs(@Req() req: { user: { id: number } }): Promise<IVariantJobsResponse> {
  const jobs = await this.queue.listForUser(req.user.id);
  const deckNames = await this.resolveDeckNames(jobs.map((j) => j.deckId));
  return {
    jobs: jobs.map((j) => ({
      jobId: j.id, deckId: j.deckId, deckName: deckNames.get(j.deckId) ?? `Deck ${j.deckId}`,
      status: j.status, total: j.total, completed: j.completed, failed: j.failed,
    })),
    etaSeconds: this.queue.computeEtaSeconds(jobs),
  };
}
```

> `/variant-jobs` must be a top-level route, not under `decks/:deckId`. Put the
> `@Get` handler on a controller mounted at `/` (or add a small
> `VariantJobsController` at `@Controller('variant-jobs')`). Resolve deck names
> via the existing `TrackedDeckEntity` repository (`resolveDeckNames` batches a
> single `IN` query).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @rathe-arsenal/api test -- variant-fetch.controller`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/decks/
git commit -m "feat(api): enqueue endpoint + GET /variant-jobs"
```

---

## Task 7: Continuous worker entry point

**Files:**
- Create: `apps/api/src/stores/variant-queue-worker.ts`
- Test: `apps/api/src/stores/__tests__/variant-queue-worker.spec.ts` (loop logic unit, not the infinite loop)

Refactor the loop body into a testable `drainOnce(queue, processor, controllerHelpers)`
function; the entry point wraps it in `while (true) { await drainOnce(); await sleep(3000) }`.

- [ ] **Step 1: Write the failing test**

```typescript
import { drainOnce } from '../variant-queue-worker';

describe('drainOnce', () => {
  it('claims a job, resolves its cards, processes it', async () => {
    const claimed = { id: 'job-1', deckId: 42, storeId: 1, cards: [{ cardIdentifier: 'a-red', status: 'pending' }] };
    const queue = { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue(claimed) };
    const processor = { process: jest.fn() };
    const resolveCards = jest.fn().mockResolvedValue([{ cardIdentifier: 'a-red', productUrl: 'u', listingPriceCents: null, listingQuantity: 0 }]);
    await drainOnce({ queue, processor, resolveCards, workerId: 'w1' } as never);
    expect(queue.reclaimOrphans).toHaveBeenCalled();
    expect(processor.process).toHaveBeenCalledWith(claimed, expect.arrayContaining([expect.objectContaining({ cardIdentifier: 'a-red' })]));
  });

  it('does nothing when the queue is empty', async () => {
    const queue = { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue(null) };
    const processor = { process: jest.fn() };
    await drainOnce({ queue, processor, resolveCards: jest.fn(), workerId: 'w1' } as never);
    expect(processor.process).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rathe-arsenal/api test -- variant-queue-worker`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the worker**

```typescript
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { AppModule } from '../app.module';
import { VariantFetchQueueService } from './variant-fetch-queue.service';
import { VariantJobProcessorService } from './variant-job-processor.service';
import { VariantFetchJobEntity } from '../database/entities/variant-fetch-job.entity';
import { IFetchCard } from './variant-fetch.service';

const POLL_MS = 3000;

export interface IDrainDeps {
  readonly queue: Pick<VariantFetchQueueService, 'reclaimOrphans' | 'claimNext'>;
  readonly processor: Pick<VariantJobProcessorService, 'process'>;
  readonly resolveCards: (job: VariantFetchJobEntity) => Promise<IFetchCard[]>;
  readonly workerId: string;
}

export async function drainOnce(deps: IDrainDeps): Promise<void> {
  await deps.queue.reclaimOrphans();
  const job = await deps.queue.claimNext(deps.workerId);
  if (!job) return;
  const cards = await deps.resolveCards(job);
  await deps.processor.process(job, cards);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  const queue = app.get(VariantFetchQueueService);
  const processor = app.get(VariantJobProcessorService);
  const workerId = `worker-${randomUUID()}`;
  // resolveCards: map the job's card identifiers to IFetchCard via store_stock /
  // product URLs. Reuse the controller's card-resolution helper (extract it to a
  // shared function in Task 6 and import it here).
  const resolveCards = app.get<(job: VariantFetchJobEntity) => Promise<IFetchCard[]>>('RESOLVE_JOB_CARDS');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try { await drainOnce({ queue, processor, resolveCards, workerId }); }
    catch (err) { console.error(JSON.stringify({ event: 'variant-worker.error', error: (err as Error).message })); }
    await sleep(POLL_MS);
  }
}

if (require.main === module) {
  void main();
}
```

> `resolveCards` maps `job.cards[].cardIdentifier` → `IFetchCard` (productUrl +
> listing snapshot). Extract the controller's existing card-resolution logic
> (the part that builds `IFetchCard[]` from `store_stock` rows) into a shared
> provider registered as `RESOLVE_JOB_CARDS`, so both the enqueue endpoint and
> the worker use one implementation. For never-fetched cards with no
> `store_stock` row, derive the detail `productUrl` from the catalog/listing URL
> the deck snapshot already carries.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rathe-arsenal/api test -- variant-queue-worker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/stores/variant-queue-worker.ts apps/api/src/stores/__tests__/variant-queue-worker.spec.ts
git commit -m "feat(api): continuous variant-queue worker"
```

---

## Task 8: Frontend — jobs query

**Files:**
- Create: `apps/web/src/api/variant-jobs.ts`
- Test: `apps/web/src/api/__tests__/variant-jobs.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { hasActiveJobs } from '../variant-jobs';

describe('hasActiveJobs', () => {
  it('is true when any job is pending or running', () => {
    expect(hasActiveJobs({ jobs: [{ status: 'running' } as never], etaSeconds: 5 })).toBe(true);
  });
  it('is false when all jobs are done/failed', () => {
    expect(hasActiveJobs({ jobs: [{ status: 'done' } as never], etaSeconds: 0 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm exec vitest run src/api/__tests__/variant-jobs.spec.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the client + hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';

export interface IVariantJob {
  readonly jobId: string;
  readonly deckId: number;
  readonly deckName: string;
  readonly status: 'pending' | 'running' | 'done' | 'failed' | 'canceled';
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
}

export interface IVariantJobsResponse {
  readonly jobs: readonly IVariantJob[];
  readonly etaSeconds: number;
}

export const VARIANT_JOBS_QUERY_KEY = ['variant-jobs'] as const;

export function hasActiveJobs(data: IVariantJobsResponse): boolean {
  return data.jobs.some((j) => j.status === 'pending' || j.status === 'running');
}

export function useVariantJobsQuery() {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: VARIANT_JOBS_QUERY_KEY,
    queryFn: () => apiFetch<IVariantJobsResponse>('/variant-jobs'),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && hasActiveJobs(data) ? 4000 : false;
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run src/api/__tests__/variant-jobs.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/api/variant-jobs.ts apps/web/src/api/__tests__/variant-jobs.spec.ts
git commit -m "feat(web): variant-jobs query hook"
```

---

## Task 9: Frontend — pill + panel

**Files:**
- Create: `apps/web/src/components/variant-queue/VariantQueuePill.tsx` + `.module.css`
- Create: `apps/web/src/components/variant-queue/VariantQueuePanel.tsx` + `.module.css`
- Test: `apps/web/src/components/variant-queue/__tests__/VariantQueuePill.spec.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VariantQueuePill } from '../VariantQueuePill';

vi.mock('../../../api/variant-jobs', () => ({
  useVariantJobsQuery: () => ({
    data: {
      jobs: [{ jobId: 'j1', deckId: 42, deckName: 'Kayo Aggro', status: 'running', total: 45, completed: 30, failed: 0 }],
      etaSeconds: 120,
    },
    isLoading: false,
  }),
  hasActiveJobs: () => true,
}));

describe('VariantQueuePill', () => {
  it('shows aggregate progress and expands the panel on click', async () => {
    render(<VariantQueuePill />);
    expect(screen.getByTestId('variant-queue-pill')).toHaveTextContent('30/45');
    await userEvent.click(screen.getByTestId('variant-queue-pill'));
    expect(screen.getByTestId('variant-queue-panel')).toHaveTextContent('Kayo Aggro');
  });

  it('renders nothing when there are no active or recent jobs', () => {
    // override the mock for this case via a second describe or vi.mocked rebind.
    expect(true).toBe(true);
  });
});
```

> Replace the second test's placeholder with a real "no jobs → renders null"
> case (re-mock `useVariantJobsQuery` to return `{ jobs: [], etaSeconds: 0 }` and
> assert `screen.queryByTestId('variant-queue-pill')` is null).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm exec vitest run src/components/variant-queue`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the panel**

```tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import type { IVariantJob } from '../../api/variant-jobs';
import styles from './VariantQueuePanel.module.css';

function formatEta(seconds: number): string {
  if (seconds <= 0) return 'done';
  if (seconds < 60) return `~${seconds}s`;
  return `~${Math.ceil(seconds / 60)} min`;
}

export function VariantQueuePanel({ jobs, etaSeconds }: { jobs: readonly IVariantJob[]; etaSeconds: number }): React.ReactElement {
  return (
    <div className={styles.panel} data-testid="variant-queue-panel" role="status" aria-live="polite">
      <ul className={styles.list}>
        {jobs.map((j) => {
          const pct = j.total > 0 ? Math.round(((j.completed + j.failed) / j.total) * 100) : 0;
          return (
            <li key={j.jobId} className={styles.row}>
              <Link to="/decks/$deckId" params={{ deckId: String(j.deckId) }} className={styles.deckName}>{j.deckName}</Link>
              <span className={styles.bar}><span className={styles.barFill} style={{ width: `${pct}%` }} /></span>
              <span className={styles.count}>{j.completed}/{j.total}{j.failed > 0 ? ` (${j.failed} failed)` : ''}</span>
            </li>
          );
        })}
      </ul>
      <p className={styles.eta}>ETA {formatEta(etaSeconds)}</p>
    </div>
  );
}
```

- [ ] **Step 4: Implement the pill**

```tsx
import React, { useState } from 'react';
import { useVariantJobsQuery, hasActiveJobs } from '../../api/variant-jobs';
import { VariantQueuePanel } from './VariantQueuePanel';
import styles from './VariantQueuePill.module.css';

function formatEta(seconds: number): string {
  if (seconds <= 0) return 'done';
  if (seconds < 60) return `~${seconds}s`;
  return `~${Math.ceil(seconds / 60)}m`;
}

export function VariantQueuePill(): React.ReactElement | null {
  const { data } = useVariantJobsQuery();
  const [open, setOpen] = useState(false);
  if (!data || data.jobs.length === 0) return null;

  const total = data.jobs.reduce((s, j) => s + j.total, 0);
  const done = data.jobs.reduce((s, j) => s + j.completed + j.failed, 0);
  const active = hasActiveJobs(data);

  return (
    <div className={styles.root}>
      <button type="button" className={styles.pill} data-testid="variant-queue-pill" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={active ? styles.spinner : styles.check} aria-hidden="true">{active ? '◐' : '✓'}</span>
        {done}/{total}{active ? ` · ${formatEta(data.etaSeconds)}` : ''}
      </button>
      {open && <VariantQueuePanel jobs={data.jobs} etaSeconds={data.etaSeconds} />}
    </div>
  );
}
```

- [ ] **Step 5: Add the CSS modules**

Create `VariantQueuePill.module.css` and `VariantQueuePanel.module.css` using
the project tokens (`--ra-*`). Pill: small rounded chip with `--ra-accent`
border; panel: absolutely-positioned dropdown (`position: absolute; top: 100%`)
with `--ra-bg-raised`, `--ra-shadow-md`, progress bar fill `--ra-ready-high`.
Mirror the spacing/typography of `LegalityBadge.module.css`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/web && pnpm exec vitest run src/components/variant-queue`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/variant-queue/
git commit -m "feat(web): variant queue pill + panel"
```

---

## Task 10: Mount the pill in AppShell

**Files:**
- Modify: `apps/web/src/components/shell/AppShell.tsx`
- Test: `apps/web/src/components/shell/__tests__/AppShell.spec.tsx` (extend if present)

- [ ] **Step 1: Add the pill to the header**

Import `VariantQueuePill` and render it in the header/nav region of `AppShell`
(next to the existing nav actions). It self-hides when there are no jobs, so no
conditional is needed at the mount site.

- [ ] **Step 2: Write/extend a test asserting the pill mounts**

```tsx
// In AppShell's test, with useVariantJobsQuery mocked to return one running job,
// assert screen.getByTestId('variant-queue-pill') is in the document.
```

- [ ] **Step 3: Run web tests**

Run: `cd apps/web && pnpm exec vitest run src/components/shell`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/shell/
git commit -m "feat(web): mount variant queue pill in AppShell"
```

---

## Task 11: Rewire deck-detail trigger to enqueue + jobs query

**Files:**
- Modify: `apps/web/src/api/variant-fetch.ts` (mutation returns `{ jobId, status }`)
- Modify: `apps/web/src/routes/_auth/decks.$deckId.tsx`
- Modify: `apps/web/src/components/ShoppingLine.tsx`, `apps/web/src/components/deck-detail/ShoppingPanel.tsx`

- [ ] **Step 1: Update the mutation response type** to `{ jobId: string; status: string }` and keep the existing `already_fresh`/`nothing_to_fetch` cases.

- [ ] **Step 2: Replace in-memory progress source**

In `decks.$deckId.tsx`, derive this deck's progress from `useVariantJobsQuery()`
(find the job with `deckId === this deck`) instead of `variantFetchProgress` from
the deck-detail query. Pass `completed/total/failed/status` down to `ShoppingPanel`/
`ShoppingLine` exactly where `variantFetchProgress` flowed before.

- [ ] **Step 3: Update affected web tests**

Update `decks-deckId-mutations.spec.tsx` and any ShoppingLine/ShoppingPanel tests
that asserted the old in-memory progress shape, mocking `useVariantJobsQuery`.

- [ ] **Step 4: Run web tests**

Run: `pnpm --filter @rathe-arsenal/web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): deck-detail reads variant progress from the jobs queue"
```

---

## Task 12: Retire in-memory machinery + listing scrape; flip worker

**Files:**
- Modify: `apps/api/src/stores/variant-fetch.service.ts` (remove `progressMap`, `activeFetchSet`, `startFetch`, `getProgress`, cleanup timers — keep `IFetchCard` export or move it to a shared types file)
- Modify: `apps/api/src/decks/decks.service.ts` (the shopping-line `variantFetchProgress` population via `getProgress` — replace with reading the job, or drop if the web now reads `/variant-jobs`)
- Modify: Railway `scrapper-worker` start command
- Modify: `docs/phase-1-followups.md` (record the retirement + lazy `store_stock`)

- [ ] **Step 1: Move `IFetchCard` to `apps/api/src/stores/types/fetch-card.ts`** and update imports in the queue service, processor, worker, and controller.

- [ ] **Step 2: Delete the in-memory machinery** from `variant-fetch.service.ts`. If the file becomes empty, delete it and its spec; otherwise keep only still-used helpers. Run `pnpm --filter @rathe-arsenal/api test` and fix any references.

- [ ] **Step 3: Stop populating `variantFetchProgress` from `getProgress`** in `decks.service.ts` (the web reads `/variant-jobs` now). Remove the now-dead `IVariantFetchProgressDto` plumbing if unused, or leave the field optional/absent.

- [ ] **Step 4: Run the full API + web suites + typecheck + lint**

Run:
```
pnpm --filter @rathe-arsenal/api test && pnpm --filter @rathe-arsenal/web test
pnpm --filter @rathe-arsenal/api typecheck && pnpm --filter @rathe-arsenal/web typecheck
pnpm --filter @rathe-arsenal/api lint && pnpm --filter @rathe-arsenal/web lint
```
Expected: all green.

- [ ] **Step 5: Flip the Railway worker start command**

Change the `scrapper-worker` service start command to `node dist/stores/variant-queue-worker.js`
(continuous). The listing cron (`scrape-stores.js`) is no longer scheduled. Record this in `docs/phase-1-followups.md`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/ docs/phase-1-followups.md
git commit -m "chore(api): retire in-memory variant progress + listing cron; continuous worker"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** job table (T1–T2), derivation (T3), queue ops/ETA/dedup/reclaim (T4), processor + store_stock write (T5), enqueue + GET (T6), continuous worker (T7), pill/panel + query (T8–T10), trigger rewire (T11), retirement + listing flip + lazy store_stock (T12). All §3–§11 spec sections map to a task.
- **Type consistency:** `IFetchCard` (existing) reused throughout; `EVariantFetchJobStatus`/`IVariantJobCard` defined in T1 and used in T4–T7; `IVariantJobsResponse`/`IVariantJob` defined in T6/T8 and consumed in T9–T11; `deriveStoreStock`→`IDerivedStoreStock` used in T5.
- **Known follow-up baked into tasks:** never-fetched cards lack a `store_stock` row → `resolveCards` (T7) must derive the detail `productUrl` from the deck snapshot's listing URL; `store_stock` needs a `(storeId, cardIdentifier)` unique constraint for `upsert` (verify/add in T2).
