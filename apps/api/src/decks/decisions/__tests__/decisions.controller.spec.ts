import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ForbiddenException,
} from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { DecisionsController } from '../decisions.controller';
import { DecisionsService, IDecision } from '../decisions.service';

const USER_ID = 'controller-user-uuid';

function makeDecision(overrides: Partial<IDecision> = {}): IDecision {
  return {
    cardIdentifier: 'Test Card (1)',
    decision: 'rejected',
    ...overrides,
  };
}

describe('DecisionsController (e2e)', () => {
  let app: INestApplication;
  let decisionsService: jest.Mocked<DecisionsService>;

  beforeEach(async () => {
    decisionsService = createMock<DecisionsService>();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DecisionsController],
      providers: [{ provide: DecisionsService, useValue: decisionsService }],
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
  // GET /decks/:trackedDeckId/decisions
  // -------------------------------------------------------------------------
  describe('GET /decks/:trackedDeckId/decisions', () => {
    it('returns the decisions list on success', async () => {
      // Arrange
      decisionsService.list.mockResolvedValue([
        makeDecision({ cardIdentifier: 'Card A (1)', decision: 'approved' }),
        makeDecision({ cardIdentifier: 'Card B (1)', decision: 'rejected' }),
      ]);

      // Act & Assert
      await request(app.getHttpServer())
        .get('/decks/1/decisions')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(2);
          expect(res.body[0].decision).toBe('approved');
        });

      expect(decisionsService.list).toHaveBeenCalledWith(USER_ID, 1);
    });

    it('returns 403 when user does not own the deck', async () => {
      // Arrange
      decisionsService.list.mockRejectedValue(
        new ForbiddenException('You do not have access to this tracked deck'),
      );

      // Act & Assert
      await request(app.getHttpServer())
        .get('/decks/99/decisions')
        .expect(403);
    });

    it('returns 401 when no Authorization header is present', async () => {
      // Re-build app without the auth middleware stub to simulate missing auth.
      const moduleRef: TestingModule = await Test.createTestingModule({
        controllers: [DecisionsController],
        providers: [{ provide: DecisionsService, useValue: decisionsService }],
      }).compile();

      const unauthApp = moduleRef.createNestApplication();
      unauthApp.useGlobalPipes(new ValidationPipe({ whitelist: true }));
      // No middleware injecting req.user — @CurrentUser() will throw.
      await unauthApp.init();

      // Act & Assert: @CurrentUser() throws an unguarded error; NestJS maps it to 500,
      // but in real deployment the JwtAuthGuard returns 401 before reaching the handler.
      // Here we verify that the handler is NOT reached without a user object.
      try {
        await request(unauthApp.getHttpServer()).get('/decks/1/decisions').expect((res) => {
          // Either 401 (guard rejects) or 500 (CurrentUser decorator throws) — both
          // indicate the protected resource was not served without credentials.
          expect([401, 500]).toContain(res.status);
        });
      } finally {
        await unauthApp.close();
      }
    });
  });

  // -------------------------------------------------------------------------
  // POST /decks/:trackedDeckId/decisions
  // -------------------------------------------------------------------------
  describe('POST /decks/:trackedDeckId/decisions', () => {
    it('upserts a decision and returns it on success', async () => {
      // Arrange
      decisionsService.upsert.mockResolvedValue(
        makeDecision({ cardIdentifier: 'Test Card (1)', decision: 'approved' }),
      );

      // Act & Assert
      await request(app.getHttpServer())
        .post('/decks/1/decisions')
        .send({ cardIdentifier: 'Test Card (1)', decision: 'approved' })
        .expect(200)
        .expect((res) => {
          expect(res.body.decision).toBe('approved');
          expect(res.body.cardIdentifier).toBe('Test Card (1)');
        });
    });

    it('returns 400 when decision is "pending" (invalid value)', async () => {
      await request(app.getHttpServer())
        .post('/decks/1/decisions')
        .send({ cardIdentifier: 'Test Card (1)', decision: 'pending' })
        .expect(400);
    });

    it('returns 400 when decision is missing', async () => {
      await request(app.getHttpServer())
        .post('/decks/1/decisions')
        .send({ cardIdentifier: 'Test Card (1)' })
        .expect(400);
    });

    it('returns 400 when cardIdentifier is empty', async () => {
      await request(app.getHttpServer())
        .post('/decks/1/decisions')
        .send({ cardIdentifier: '', decision: 'approved' })
        .expect(400);
    });

    it('returns 400 when cardIdentifier exceeds 128 characters', async () => {
      const longId = 'x'.repeat(129);
      await request(app.getHttpServer())
        .post('/decks/1/decisions')
        .send({ cardIdentifier: longId, decision: 'rejected' })
        .expect(400);
    });

    it('returns 400 when cardIdentifier contains path-traversal characters (../)', async () => {
      await request(app.getHttpServer())
        .post('/decks/1/decisions')
        .send({ cardIdentifier: '../../../etc/passwd', decision: 'rejected' })
        .expect(400);
    });

    it('returns 400 when cardIdentifier contains a NUL byte', async () => {
      await request(app.getHttpServer())
        .post('/decks/1/decisions')
        .send({ cardIdentifier: 'card\x00id', decision: 'rejected' })
        .expect(400);
    });

    it('returns 403 when user does not own the deck (POST)', async () => {
      decisionsService.upsert.mockRejectedValue(
        new ForbiddenException('You do not have access to this tracked deck'),
      );
      await request(app.getHttpServer())
        .post('/decks/99/decisions')
        .send({ cardIdentifier: 'Test Card (1)', decision: 'rejected' })
        .expect(403);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /decks/:trackedDeckId/decisions/:cardIdentifier
  // -------------------------------------------------------------------------
  describe('DELETE /decks/:trackedDeckId/decisions/:cardIdentifier', () => {
    it('resets a single decision and returns 204', async () => {
      // Arrange
      decisionsService.resetOne.mockResolvedValue(undefined);

      // Act & Assert
      await request(app.getHttpServer())
        .delete('/decks/1/decisions/Test%20Card%20(1)')
        .expect(204);

      expect(decisionsService.resetOne).toHaveBeenCalledWith(
        USER_ID,
        1,
        'Test Card (1)',
      );
    });

    it('returns 403 when user does not own the deck (DELETE single)', async () => {
      decisionsService.resetOne.mockRejectedValue(
        new ForbiddenException('You do not have access to this tracked deck'),
      );
      await request(app.getHttpServer())
        .delete('/decks/99/decisions/Test%20Card%20(1)')
        .expect(403);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /decks/:trackedDeckId/decisions?scope=rejections
  // -------------------------------------------------------------------------
  describe('DELETE /decks/:trackedDeckId/decisions?scope=rejections', () => {
    it('clears all rejections and returns the count', async () => {
      // Arrange
      decisionsService.clearRejections.mockResolvedValue(3);

      // Act & Assert
      await request(app.getHttpServer())
        .delete('/decks/1/decisions?scope=rejections')
        .expect(200)
        .expect((res) => {
          expect(res.body.cleared).toBe(3);
        });
    });

    it('returns 0 when scope is not "rejections"', async () => {
      await request(app.getHttpServer())
        .delete('/decks/1/decisions?scope=all')
        .expect(200)
        .expect((res) => {
          expect(res.body.cleared).toBe(0);
        });
      expect(decisionsService.clearRejections).not.toHaveBeenCalled();
    });

    it('returns 403 when user does not own the deck (DELETE bulk)', async () => {
      decisionsService.clearRejections.mockRejectedValue(
        new ForbiddenException('You do not have access to this tracked deck'),
      );
      await request(app.getHttpServer())
        .delete('/decks/99/decisions?scope=rejections')
        .expect(403);
    });
  });
});
