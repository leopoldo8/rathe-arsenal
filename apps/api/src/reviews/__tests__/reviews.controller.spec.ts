import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { ReviewsController } from '../reviews.controller';
import { DecisionsService, IBulkUpsertResult } from '../../decks/decisions/decisions.service';
import { ReviewAggregateService } from '../review-aggregate.service';

const USER_ID = 'reviews-controller-user-uuid';

function makeSuccessResult(succeeded: number): IBulkUpsertResult {
  return { succeeded, failed: [] };
}

describe('ReviewsController — POST /reviews/bulk (e2e)', () => {
  let app: INestApplication;
  let decisionsService: jest.Mocked<DecisionsService>;

  beforeEach(async () => {
    decisionsService = createMock<DecisionsService>();
    const reviewAggregateService = createMock<ReviewAggregateService>();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        { provide: DecisionsService, useValue: decisionsService },
        { provide: ReviewAggregateService, useValue: reviewAggregateService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    // Inject authenticated user (the real JwtAuthGuard is APP_GUARD scoped
    // and not registered in this slim module — inject via middleware).
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: { userId: string; email: string } }).user = {
        userId: USER_ID,
        email: 'test@example.com',
      };
      next();
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('returns 200 with succeeded count for 10 valid operations', async () => {
      // Arrange
      decisionsService.bulkUpsert.mockResolvedValue(makeSuccessResult(10));

      const ops = Array.from({ length: 10 }, (_, i) => ({
        trackedDeckId: 42,
        cardIdentifier: `Card ${String(i)} (1)`,
        decision: 'APPROVED' as const,
      }));

      // Act & Assert
      await request(app.getHttpServer())
        .post('/reviews/bulk')
        .send({ operations: ops })
        .expect(200)
        .expect((res) => {
          expect(res.body.succeeded).toBe(10);
          expect(res.body.failed).toHaveLength(0);
        });

      expect(decisionsService.bulkUpsert).toHaveBeenCalledWith(
        USER_ID,
        expect.arrayContaining([
          expect.objectContaining({ trackedDeckId: 42, decision: 'APPROVED' }),
        ]),
      );
    });

    it('passes reset=true operations through to bulkUpsert', async () => {
      // Arrange
      decisionsService.bulkUpsert.mockResolvedValue(makeSuccessResult(1));

      // Act & Assert
      await request(app.getHttpServer())
        .post('/reviews/bulk')
        .send({
          operations: [
            { trackedDeckId: 42, cardIdentifier: 'Card A (1)', reset: true },
          ],
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.succeeded).toBe(1);
        });

      expect(decisionsService.bulkUpsert).toHaveBeenCalledWith(
        USER_ID,
        expect.arrayContaining([
          expect.objectContaining({ trackedDeckId: 42, reset: true }),
        ]),
      );
    });

    it('returns partial failures when service reports pre-validation errors', async () => {
      // Arrange: some ops succeeded, some failed.
      const partialResult: IBulkUpsertResult = {
        succeeded: 8,
        failed: [
          { trackedDeckId: '99', cardIdentifier: 'Card I (1)', error: 'NOT_ACCESSIBLE' },
          { trackedDeckId: '99', cardIdentifier: 'Card J (1)', error: 'NOT_ACCESSIBLE' },
        ],
      };
      decisionsService.bulkUpsert.mockResolvedValue(partialResult);

      // Act & Assert
      await request(app.getHttpServer())
        .post('/reviews/bulk')
        .send({
          operations: [
            { trackedDeckId: 42, cardIdentifier: 'Card A (1)', decision: 'APPROVED' },
          ],
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.succeeded).toBe(8);
          expect(res.body.failed).toHaveLength(2);
          expect(res.body.failed[0].error).toBe('NOT_ACCESSIBLE');
        });
    });
  });

  // -------------------------------------------------------------------------
  // Validation errors (DTO layer)
  // -------------------------------------------------------------------------
  describe('validation errors', () => {
    it('returns 400 when operations is an empty array', async () => {
      await request(app.getHttpServer())
        .post('/reviews/bulk')
        .send({ operations: [] })
        .expect(400);

      expect(decisionsService.bulkUpsert).not.toHaveBeenCalled();
    });

    it('returns 400 when operations is missing entirely', async () => {
      await request(app.getHttpServer())
        .post('/reviews/bulk')
        .send({})
        .expect(400);

      expect(decisionsService.bulkUpsert).not.toHaveBeenCalled();
    });

    it('returns 400 when an operation has both decision and reset', async () => {
      await request(app.getHttpServer())
        .post('/reviews/bulk')
        .send({
          operations: [
            {
              trackedDeckId: 42,
              cardIdentifier: 'Card A (1)',
              decision: 'APPROVED',
              reset: true,
            },
          ],
        })
        .expect(400);

      expect(decisionsService.bulkUpsert).not.toHaveBeenCalled();
    });

    it('returns 400 when an operation has an invalid decision value', async () => {
      await request(app.getHttpServer())
        .post('/reviews/bulk')
        .send({
          operations: [
            {
              trackedDeckId: 42,
              cardIdentifier: 'Card A (1)',
              decision: 'PENDING',
            },
          ],
        })
        .expect(400);

      expect(decisionsService.bulkUpsert).not.toHaveBeenCalled();
    });

    it('returns 400 when cardIdentifier is empty', async () => {
      await request(app.getHttpServer())
        .post('/reviews/bulk')
        .send({
          operations: [
            { trackedDeckId: 42, cardIdentifier: '', decision: 'APPROVED' },
          ],
        })
        .expect(400);

      expect(decisionsService.bulkUpsert).not.toHaveBeenCalled();
    });

    it('returns 400 when cardIdentifier contains path-traversal characters', async () => {
      await request(app.getHttpServer())
        .post('/reviews/bulk')
        .send({
          operations: [
            { trackedDeckId: 42, cardIdentifier: '../../../etc/passwd', decision: 'APPROVED' },
          ],
        })
        .expect(400);

      expect(decisionsService.bulkUpsert).not.toHaveBeenCalled();
    });

    it('returns 400 when trackedDeckId is not a positive integer', async () => {
      await request(app.getHttpServer())
        .post('/reviews/bulk')
        .send({
          operations: [
            { trackedDeckId: -1, cardIdentifier: 'Card A (1)', decision: 'APPROVED' },
          ],
        })
        .expect(400);

      expect(decisionsService.bulkUpsert).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 413 — over-cap
  // -------------------------------------------------------------------------
  describe('over-cap (> 200 operations)', () => {
    it('returns 413 when 201 operations are submitted', async () => {
      // Arrange: 201 ops — exactly one over the cap.
      const ops = Array.from({ length: 201 }, (_, i) => ({
        trackedDeckId: 42,
        cardIdentifier: `Card ${String(i)} (1)`,
        decision: 'APPROVED' as const,
      }));

      // Act & Assert
      await request(app.getHttpServer())
        .post('/reviews/bulk')
        .send({ operations: ops })
        .expect(413)
        .expect((res) => {
          expect(res.body.code).toBe('TOO_MANY_OPERATIONS');
        });

      // No DB writes — service must NOT be called.
      expect(decisionsService.bulkUpsert).not.toHaveBeenCalled();
    });

    it('accepts exactly 200 operations (boundary check)', async () => {
      // Arrange: exactly 200 ops.
      decisionsService.bulkUpsert.mockResolvedValue(makeSuccessResult(200));
      const ops = Array.from({ length: 200 }, (_, i) => ({
        trackedDeckId: 42,
        cardIdentifier: `Card ${String(i)} (1)`,
        decision: 'APPROVED' as const,
      }));

      // Act & Assert — must NOT return 413.
      await request(app.getHttpServer())
        .post('/reviews/bulk')
        .send({ operations: ops })
        .expect(200);

      expect(decisionsService.bulkUpsert).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Transaction abort response passthrough
  // -------------------------------------------------------------------------
  describe('transaction abort', () => {
    it('returns 200 with transactionError payload when service reports a tx abort', async () => {
      // Arrange
      const txAbortResult: IBulkUpsertResult = {
        succeeded: 0,
        failed: [
          { trackedDeckId: '42', cardIdentifier: 'Card A (1)', error: 'INVALID_SHAPE' },
        ],
        transactionError: { code: 'QueryFailedError', cursorHint: 0 },
      };
      decisionsService.bulkUpsert.mockResolvedValue(txAbortResult);

      // Act & Assert
      await request(app.getHttpServer())
        .post('/reviews/bulk')
        .send({
          operations: [
            { trackedDeckId: 42, cardIdentifier: 'Card A (1)', decision: 'APPROVED' },
          ],
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.succeeded).toBe(0);
          expect(res.body.transactionError).toBeDefined();
          expect(res.body.transactionError.code).toBe('QueryFailedError');
          expect(res.body.transactionError.cursorHint).toBe(0);
        });
    });
  });
});
