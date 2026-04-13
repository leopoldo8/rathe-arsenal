import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { ReSolveController } from '../re-solve.controller';
import { ReSolveService, IReSolveResult } from '../re-solve.service';
import { MAX_EXCLUSIONS } from '../dtos/re-solve.dto';

const USER_ID = 'user-e2e-123';

function makeResult(): IReSolveResult {
  return {
    rawPercent: 80,
    effectivePercent: 95,
    path: 'B',
    fidelityPercent: 96,
    breakdown: {
      exact: [],
      substituted: [],
      missing: [],
      notOwned: [],
    },
    substitutions: [],
    rejectionCount: 1,
    curveWarnings: [],
  };
}

describe('ReSolveController (e2e)', () => {
  let app: INestApplication;
  let reSolveService: jest.Mocked<ReSolveService>;

  beforeEach(async () => {
    reSolveService = createMock<ReSolveService>();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ReSolveController],
      providers: [{ provide: ReSolveService, useValue: reSolveService }],
    }).compile();

    app = moduleRef.createNestApplication();
    // Stub in the authenticated user that `@CurrentUser()` reads from
    // `req.user`. The real JwtAuthGuard is APP_GUARD-scoped and is not
    // registered in this slim test module, so we inject the shape it
    // would have produced via a tiny middleware.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: { userId: string } }).user = {
        userId: USER_ID,
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

  describe('POST /decks/:deckId/reject-substitute', () => {
    it('returns the re-solve result on success', async () => {
      // Arrange
      reSolveService.rejectSubstitute.mockResolvedValue(makeResult());

      // Act & Assert
      await request(app.getHttpServer())
        .post('/decks/1/reject-substitute')
        .send({ cardIdentifier: 'card-x' })
        .expect(200)
        .expect((res) => {
          expect(res.body.rejectionCount).toBe(1);
          expect(res.body.effectivePercent).toBe(95);
        });
      expect(reSolveService.rejectSubstitute).toHaveBeenCalledWith(
        USER_ID,
        1,
        'card-x',
      );
    });

    it('returns 404 when the user does not own the deck', async () => {
      // Arrange
      reSolveService.rejectSubstitute.mockRejectedValue(
        new NotFoundException('Tracked deck not found'),
      );

      // Act & Assert
      await request(app.getHttpServer())
        .post('/decks/99/reject-substitute')
        .send({ cardIdentifier: 'card-x' })
        .expect(404);
    });

    it('returns 400 when cardIdentifier is missing', async () => {
      await request(app.getHttpServer())
        .post('/decks/1/reject-substitute')
        .send({})
        .expect(400);
    });

    it('returns 400 when cardIdentifier is longer than 100 characters', async () => {
      // Arrange
      const longId = 'x'.repeat(101);

      // Act & Assert
      await request(app.getHttpServer())
        .post('/decks/1/reject-substitute')
        .send({ cardIdentifier: longId })
        .expect(400);
    });
  });

  describe('POST /decks/:deckId/reset-rejections', () => {
    it('returns the reset result on success', async () => {
      // Arrange
      reSolveService.resetRejections.mockResolvedValue({
        ...makeResult(),
        rejectionCount: 0,
      });

      // Act & Assert
      await request(app.getHttpServer())
        .post('/decks/1/reset-rejections')
        .expect(200)
        .expect((res) => {
          expect(res.body.rejectionCount).toBe(0);
        });
    });

    it('returns 404 when the user does not own the deck', async () => {
      // Arrange
      reSolveService.resetRejections.mockRejectedValue(
        new NotFoundException('Tracked deck not found'),
      );

      // Act & Assert
      await request(app.getHttpServer())
        .post('/decks/99/reset-rejections')
        .expect(404);
    });
  });

  describe('POST /decks/:deckId/re-solve', () => {
    it('does not persist anything on a dry-run', async () => {
      // Arrange
      reSolveService.reSolveDryRun.mockResolvedValue(makeResult());

      // Act
      await request(app.getHttpServer())
        .post('/decks/1/re-solve')
        .send({ excludedCardIdentifiers: ['card-a', 'card-b'] })
        .expect(200);

      // Assert: only the dry-run path is invoked.
      expect(reSolveService.reSolveDryRun).toHaveBeenCalledTimes(1);
      expect(reSolveService.rejectSubstitute).not.toHaveBeenCalled();
      expect(reSolveService.resetRejections).not.toHaveBeenCalled();
    });

    it('rejects a payload with more than MAX_EXCLUSIONS identifiers', async () => {
      // Arrange: one more than the allowed maximum.
      const tooMany = Array.from(
        { length: MAX_EXCLUSIONS + 1 },
        (_, i) => `card-${i}`,
      );

      // Act & Assert
      await request(app.getHttpServer())
        .post('/decks/1/re-solve')
        .send({ excludedCardIdentifiers: tooMany })
        .expect(400);
      expect(reSolveService.reSolveDryRun).not.toHaveBeenCalled();
    });

    it('rejects a single identifier longer than 100 characters', async () => {
      // Arrange
      const tooLong = ['x'.repeat(101)];

      // Act & Assert
      await request(app.getHttpServer())
        .post('/decks/1/re-solve')
        .send({ excludedCardIdentifiers: tooLong })
        .expect(400);
      expect(reSolveService.reSolveDryRun).not.toHaveBeenCalled();
    });

    it('accepts an empty exclusion array', async () => {
      // Arrange
      reSolveService.reSolveDryRun.mockResolvedValue(makeResult());

      // Act & Assert
      await request(app.getHttpServer())
        .post('/decks/1/re-solve')
        .send({ excludedCardIdentifiers: [] })
        .expect(200);
    });

    it('returns 404 when the user does not own the deck', async () => {
      // Arrange
      reSolveService.reSolveDryRun.mockRejectedValue(
        new NotFoundException('Tracked deck not found'),
      );

      // Act & Assert
      await request(app.getHttpServer())
        .post('/decks/99/re-solve')
        .send({ excludedCardIdentifiers: [] })
        .expect(404);
    });
  });
});
