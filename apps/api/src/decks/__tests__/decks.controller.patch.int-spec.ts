/**
 * Integration tests for PATCH /decks/:deckId (U4).
 *
 * Tests route wiring, DTO validation, guard behaviour, and response shape
 * using a slim NestJS app with no database. The real JwtAuthGuard is absent
 * because it lives at APP_GUARD scope; we inject the user shape via middleware.
 * OwnsTrackedDeckGuard is overridden to keep the tests focused on the PATCH
 * contract rather than repeated ownership assertions.
 *
 * Guard 404 behaviour is tested separately using a dedicated guard instance
 * that throws NotFoundException.
 */
import {
  HttpStatus,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { DecksController } from '../decks.controller';
import { DecksService } from '../decks.service';
import { OwnsTrackedDeckGuard } from '../../auth/guards/owns-tracked-deck.guard';
import { ITrackedDeckDetailResponse } from '../dtos/tracked-deck-detail.response.dto';

const USER_ID = 'user-uuid-patch-int';
const DECK_ID = 42;

function buildDetailResponse(
  overrides: Partial<ITrackedDeckDetailResponse> = {},
): ITrackedDeckDetailResponse {
  return {
    id: DECK_ID,
    fabraryUlid: null,
    name: 'Dorinthea Ironsong — Classic Constructed',
    hero: 'Dorinthea Ironsong',
    format: 'Classic Constructed',
    status: 'building',
    tags: [],
    trackedAt: '2026-05-17T10:00:00.000Z',
    updatedAt: '2026-05-17T10:00:00.000Z',
    totalCards: 0,
    latestSnapshot: null,
    rejectedCount: 0,
    approvedCount: 0,
    pendingCount: 0,
    decisions: [],
    shoppingLine: null,
    legality: { category: 'incomplete', reasons: [] },
    ...overrides,
  };
}

async function buildApp(opts: {
  userId: string;
  decksService: jest.Mocked<DecksService>;
  /** Override OwnsTrackedDeckGuard with a custom implementation */
  guardOverride?: { canActivate: () => boolean | Promise<boolean> };
}): Promise<INestApplication> {
  const { userId, decksService, guardOverride } = opts;

  const builder = Test.createTestingModule({
    controllers: [DecksController],
    providers: [{ provide: DecksService, useValue: decksService }],
  }).overrideGuard(OwnsTrackedDeckGuard);

  const moduleRef: TestingModule = await (
    guardOverride
      ? builder.useValue(guardOverride)
      : builder.useValue({ canActivate: () => true })
  ).compile();

  const app = moduleRef.createNestApplication();

  // Inject the current user via middleware (mirrors the global JwtAuthGuard).
  app.use((req: Request & { user?: object }, _res: Response, next: NextFunction) => {
    req.user = { userId, email: 'test@example.com' };
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
  return app;
}

describe('DecksController PATCH /decks/:deckId (int-spec)', () => {
  let app: INestApplication;
  let decksService: jest.Mocked<DecksService>;

  beforeEach(async () => {
    decksService = createMock<DecksService>();
    app = await buildApp({ userId: USER_ID, decksService });
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Happy paths
  // ---------------------------------------------------------------------------

  describe('happy path — status only', () => {
    it('returns HTTP 200 with updated status', async () => {
      // Arrange
      const response = buildDetailResponse({ status: 'active' });
      decksService.updateMeta.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ status: 'active' })
        .expect(HttpStatus.OK);

      // Assert
      expect(res.body.status).toBe('active');
      expect(decksService.updateMeta).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        expect.objectContaining({ status: 'active' }),
      );
    });
  });

  describe('happy path — name only', () => {
    it('returns HTTP 200 with updated name', async () => {
      // Arrange
      const response = buildDetailResponse({ name: 'New name' });
      decksService.updateMeta.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ name: 'New name' })
        .expect(HttpStatus.OK);

      // Assert
      expect(res.body.name).toBe('New name');
    });
  });

  describe('happy path — addTagIds', () => {
    it('returns HTTP 200 and deck.tags includes the attached tag names', async () => {
      // Arrange
      const response = buildDetailResponse({ tags: ['liga local', 'torneio'] });
      decksService.updateMeta.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ addTagIds: [1, 2] })
        .expect(HttpStatus.OK);

      // Assert
      expect(res.body.tags).toEqual(['liga local', 'torneio']);
    });
  });

  describe('happy path — removeTagIds (last attachment)', () => {
    it('returns HTTP 200 and deck.tags is empty when the last tag is removed', async () => {
      // Arrange
      const response = buildDetailResponse({ tags: [] });
      decksService.updateMeta.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ removeTagIds: [3] })
        .expect(HttpStatus.OK);

      // Assert
      expect(res.body.tags).toEqual([]);
    });
  });

  describe('happy path — all four fields combined', () => {
    it('returns HTTP 200 with the fully updated payload', async () => {
      // Arrange
      const response = buildDetailResponse({
        status: 'ready',
        name: 'X',
        tags: ['liga local'],
      });
      decksService.updateMeta.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ status: 'ready', name: 'X', addTagIds: [1], removeTagIds: [2] })
        .expect(HttpStatus.OK);

      // Assert
      expect(res.body.status).toBe('ready');
      expect(res.body.name).toBe('X');
      expect(res.body.tags).toEqual(['liga local']);
      expect(decksService.updateMeta).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        expect.objectContaining({
          status: 'ready',
          name: 'X',
          addTagIds: [1],
          removeTagIds: [2],
        }),
      );
    });
  });

  describe('response shape', () => {
    it('includes status, tags, and updatedAt in the response', async () => {
      // Arrange
      const response = buildDetailResponse({
        status: 'idea',
        tags: ['retiro'],
        updatedAt: '2026-05-17T12:00:00.000Z',
      });
      decksService.updateMeta.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ status: 'idea' })
        .expect(HttpStatus.OK);

      // Assert — new U4 response fields present
      expect(res.body.status).toBe('idea');
      expect(res.body.tags).toEqual(['retiro']);
      expect(res.body.updatedAt).toBe('2026-05-17T12:00:00.000Z');
    });
  });

  // ---------------------------------------------------------------------------
  // DTO validation — status
  // ---------------------------------------------------------------------------

  describe('DTO validation — status', () => {
    it('returns 400 when status is "archived" (not in allowed values)', async () => {
      // Act
      await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ status: 'archived' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.updateMeta).not.toHaveBeenCalled();
    });

    it('returns 400 when status is an empty string', async () => {
      await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ status: '' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.updateMeta).not.toHaveBeenCalled();
    });

    it.each(['idea', 'building', 'ready', 'active', 'retired'])(
      'accepts valid status "%s"',
      async (status) => {
        decksService.updateMeta.mockResolvedValue(
          buildDetailResponse({ status: status as ITrackedDeckDetailResponse['status'] }),
        );

        await request(app.getHttpServer())
          .patch(`/decks/${DECK_ID}`)
          .send({ status })
          .expect(HttpStatus.OK);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // DTO validation — name
  // ---------------------------------------------------------------------------

  describe('DTO validation — name', () => {
    it('returns 400 when name exceeds 120 characters', async () => {
      // Arrange
      const longName = 'a'.repeat(121);

      // Act
      await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ name: longName })
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.updateMeta).not.toHaveBeenCalled();
    });

    it('accepts name at the maximum length of 120 characters', async () => {
      // Arrange
      const maxLengthName = 'a'.repeat(120);
      decksService.updateMeta.mockResolvedValue(
        buildDetailResponse({ name: maxLengthName }),
      );

      // Act
      await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ name: maxLengthName })
        .expect(HttpStatus.OK);
    });
  });

  // ---------------------------------------------------------------------------
  // DTO validation — tag arrays
  // ---------------------------------------------------------------------------

  describe('DTO validation — addTagIds / removeTagIds', () => {
    it('returns 400 when addTagIds contains a non-integer value', async () => {
      await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ addTagIds: ['not-a-number'] })
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.updateMeta).not.toHaveBeenCalled();
    });

    it('returns 400 when addTagIds exceeds 50 items', async () => {
      const tooMany = Array.from({ length: 51 }, (_, i) => i + 1);

      await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ addTagIds: tooMany })
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.updateMeta).not.toHaveBeenCalled();
    });

    it('returns 400 when addTagIds is not an array', async () => {
      await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ addTagIds: 1 })
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.updateMeta).not.toHaveBeenCalled();
    });

    it('accepts addTagIds with exactly 50 items', async () => {
      const exactly50 = Array.from({ length: 50 }, (_, i) => i + 1);
      decksService.updateMeta.mockResolvedValue(buildDetailResponse());

      await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ addTagIds: exactly50 })
        .expect(HttpStatus.OK);
    });
  });

  // ---------------------------------------------------------------------------
  // Empty body (no-op)
  // ---------------------------------------------------------------------------

  describe('empty body (no-op update)', () => {
    it('returns HTTP 200 with unchanged payload when body is empty', async () => {
      // Arrange
      const response = buildDetailResponse();
      decksService.updateMeta.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({})
        .expect(HttpStatus.OK);

      // Assert — service called with empty DTO (all fields undefined)
      expect(res.body.id).toBe(DECK_ID);
      expect(decksService.updateMeta).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        {},
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Guard — another user's deck
  // ---------------------------------------------------------------------------

  describe('guard — PATCH on another user\'s deck returns 404', () => {
    it('returns HTTP 404 when OwnsTrackedDeckGuard throws NotFoundException', async () => {
      // Arrange — rebuild app with a guard that throws NotFoundException
      await app.close();
      app = await buildApp({
        userId: USER_ID,
        decksService,
        guardOverride: {
          canActivate: () => {
            throw new NotFoundException('Tracked deck not found');
          },
        },
      });

      // Act
      await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ status: 'active' })
        .expect(HttpStatus.NOT_FOUND);

      expect(decksService.updateMeta).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // addTagIds with another user's tag — 404 via service
  // ---------------------------------------------------------------------------

  describe('error path — tag owned by another user', () => {
    it('returns HTTP 404 when service throws NotFoundException for foreign tag', async () => {
      // Arrange
      decksService.updateMeta.mockRejectedValue(
        new NotFoundException('Tag not found'),
      );

      // Act
      await request(app.getHttpServer())
        .patch(`/decks/${DECK_ID}`)
        .send({ addTagIds: [99] })
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ---------------------------------------------------------------------------
  // Integration: last-write-wins (D12 — no optimistic lock check)
  // ---------------------------------------------------------------------------

  describe('integration — last-write-wins (D12)', () => {
    it('does not return 409 when concurrent PATCHes race (last-write-wins)', async () => {
      // Two calls to PATCH on the same deck — both succeed. The service
      // (mocked here) resolves with the second call's values; neither
      // returns 409 (optimistic-lock not enforced in v2 per D12).
      decksService.updateMeta
        .mockResolvedValueOnce(buildDetailResponse({ status: 'building' }))
        .mockResolvedValueOnce(buildDetailResponse({ status: 'ready' }));

      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .patch(`/decks/${DECK_ID}`)
          .send({ status: 'building' }),
        request(app.getHttpServer())
          .patch(`/decks/${DECK_ID}`)
          .send({ status: 'ready' }),
      ]);

      expect(res1.status).toBe(HttpStatus.OK);
      expect(res2.status).toBe(HttpStatus.OK);
      // No 409 from either
      expect(res1.status).not.toBe(HttpStatus.CONFLICT);
      expect(res2.status).not.toBe(HttpStatus.CONFLICT);
    });
  });
});
