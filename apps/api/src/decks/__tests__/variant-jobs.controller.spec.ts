import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { VariantJobsController } from '../variant-jobs.controller';
import { VariantFetchQueueService } from '../../stores/variant-fetch-queue.service';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import {
  EVariantFetchJobStatus,
  VariantFetchJobEntity,
} from '../../database/entities/variant-fetch-job.entity';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const USER_ID = 'user-vj-001';
const DECK_ID_1 = 10;
const DECK_ID_2 = 20;

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

function buildJob(
  deckId: number,
  overrides: Partial<VariantFetchJobEntity> = {},
): VariantFetchJobEntity {
  return {
    id: `job-${deckId}`,
    userId: 1,
    deckId,
    storeId: 1,
    status: EVariantFetchJobStatus.Running,
    cards: [],
    total: 10,
    completed: 4,
    failed: 0,
    enqueuedAt: new Date('2026-06-01T10:00:00Z'),
    startedAt: new Date('2026-06-01T10:00:05Z'),
    finishedAt: null,
    claimedAt: new Date('2026-06-01T10:00:05Z'),
    claimedBy: 'worker-1',
    error: null,
    ...overrides,
  } as VariantFetchJobEntity;
}

function buildDeck(id: number, name: string): TrackedDeckEntity {
  return {
    id,
    userId: USER_ID,
    name,
    hero: 'Dorinthea Ironsong',
    heroIdentifier: 'dorinthea-ironsong',
    format: 'Classic Constructed',
    fabraryUlid: null,
    status: 'active',
    trackedAt: new Date(),
    updatedAt: new Date(),
    user: {} as TrackedDeckEntity['user'],
  } as TrackedDeckEntity;
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

async function buildApp(opts: {
  userId: string;
  queueService: jest.Mocked<VariantFetchQueueService>;
  deckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
}): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [VariantJobsController],
    providers: [
      { provide: VariantFetchQueueService, useValue: opts.queueService },
      { provide: getRepositoryToken(TrackedDeckEntity), useValue: opts.deckRepo },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();

  // Simulate JwtAuthGuard by injecting user into req.user.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { user: { userId: string; email: string } }).user = {
      userId: opts.userId,
      email: 'test@example.com',
    };
    next();
  });

  await app.init();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VariantJobsController (e2e)', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
    jest.clearAllMocks();
  });

  describe('GET /variant-jobs — happy: returns jobs with deck names and etaSeconds', () => {
    it('returns jobs enriched with deckName and computes etaSeconds', async () => {
      // Arrange
      const queueService = createMock<VariantFetchQueueService>();
      const deckRepo = createMock<Repository<TrackedDeckEntity>>();

      const jobs = [
        buildJob(DECK_ID_1, { id: 'job-1', total: 10, completed: 4, failed: 0 }),
        buildJob(DECK_ID_2, { id: 'job-2', total: 5, completed: 5, failed: 0 }),
      ];
      queueService.listForUser.mockResolvedValue(jobs);
      queueService.computeEtaSeconds.mockReturnValue(9);
      deckRepo.find.mockResolvedValue([
        buildDeck(DECK_ID_1, 'Dorinthea CC'),
        buildDeck(DECK_ID_2, 'Rhinar Blitz'),
      ]);

      app = await buildApp({ userId: USER_ID, queueService, deckRepo });

      // Act & Assert
      await request(app.getHttpServer())
        .get('/variant-jobs')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.etaSeconds).toBe(9);
          expect(res.body.jobs).toHaveLength(2);

          const j1 = res.body.jobs.find((j: { jobId: string }) => j.jobId === 'job-1');
          expect(j1).toMatchObject({
            jobId: 'job-1',
            deckId: DECK_ID_1,
            deckName: 'Dorinthea CC',
            status: 'running',
            total: 10,
            completed: 4,
            failed: 0,
          });

          const j2 = res.body.jobs.find((j: { jobId: string }) => j.jobId === 'job-2');
          expect(j2).toMatchObject({
            jobId: 'job-2',
            deckId: DECK_ID_2,
            deckName: 'Rhinar Blitz',
          });
        });

      expect(queueService.listForUser).toHaveBeenCalledWith(expect.any(String));
      expect(queueService.computeEtaSeconds).toHaveBeenCalledWith(jobs);
    });

    it('falls back to "Deck {id}" when deck name is not found', async () => {
      // Arrange
      const queueService = createMock<VariantFetchQueueService>();
      const deckRepo = createMock<Repository<TrackedDeckEntity>>();

      const jobs = [buildJob(DECK_ID_1, { id: 'job-orphan' })];
      queueService.listForUser.mockResolvedValue(jobs);
      queueService.computeEtaSeconds.mockReturnValue(0);
      // Deck repo returns empty — deck may have been deleted.
      deckRepo.find.mockResolvedValue([]);

      app = await buildApp({ userId: USER_ID, queueService, deckRepo });

      await request(app.getHttpServer())
        .get('/variant-jobs')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.jobs[0].deckName).toBe(`Deck ${DECK_ID_1}`);
        });
    });
  });

  describe('GET /variant-jobs — edge: no jobs', () => {
    it('returns empty jobs array and etaSeconds 0 when user has no active jobs', async () => {
      // Arrange
      const queueService = createMock<VariantFetchQueueService>();
      const deckRepo = createMock<Repository<TrackedDeckEntity>>();

      queueService.listForUser.mockResolvedValue([]);

      app = await buildApp({ userId: USER_ID, queueService, deckRepo });

      // Act & Assert
      await request(app.getHttpServer())
        .get('/variant-jobs')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.jobs).toEqual([]);
          expect(res.body.etaSeconds).toBe(0);
        });

      // Should not query decks when no jobs.
      expect(deckRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('GET /variant-jobs — edge: deduplicates deckId queries', () => {
    it('batch-loads deck names with a single repo.find for multiple jobs on same deck', async () => {
      // Arrange
      const queueService = createMock<VariantFetchQueueService>();
      const deckRepo = createMock<Repository<TrackedDeckEntity>>();

      // Two jobs for the same deck (e.g., one done recently, one pending).
      const jobs = [
        buildJob(DECK_ID_1, { id: 'job-a' }),
        buildJob(DECK_ID_1, { id: 'job-b' }),
      ];
      queueService.listForUser.mockResolvedValue(jobs);
      queueService.computeEtaSeconds.mockReturnValue(0);
      deckRepo.find.mockResolvedValue([buildDeck(DECK_ID_1, 'Shared Deck')]);

      app = await buildApp({ userId: USER_ID, queueService, deckRepo });

      await request(app.getHttpServer())
        .get('/variant-jobs')
        .expect(HttpStatus.OK);

      // Only one find call regardless of how many jobs share the same deckId.
      expect(deckRepo.find).toHaveBeenCalledTimes(1);
    });
  });
});
