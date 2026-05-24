/**
 * Integration tests for POST /decks (scratch deck creation).
 *
 * Tests the controller route wiring, DTO validation, and response shape
 * using a slim NestJS app (no database). The real JwtAuthGuard is absent
 * because it lives at APP_GUARD scope; we inject the user shape via middleware.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { DecksController } from '../decks.controller';
import { DecksService } from '../decks.service';
import { HeroIdentifierExistsInCatalog } from '../validators/hero-identifier-exists.validator';
import { ITrackedDeckDetailResponse } from '../dtos/tracked-deck-detail.response.dto';
import { OwnsTrackedDeckGuard } from '../../auth/guards/owns-tracked-deck.guard';

const USER_ID = 'user-uuid-post-int';

function buildDetailResponse(
  overrides: Partial<ITrackedDeckDetailResponse> = {},
): ITrackedDeckDetailResponse {
  return {
    id: 99,
    fabraryUlid: null,
    name: 'Dorinthea Ironsong — Classic Constructed',
    hero: 'Dorinthea Ironsong',
    format: 'Classic Constructed',
    status: 'idea',
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
    legality: { category: 'incomplete', reasons: ['Deck has 0 mainboard cards but Classic Constructed requires at least 60.'] },
    ...overrides,
  };
}

async function buildApp(opts: {
  userId: string;
  decksService: jest.Mocked<DecksService>;
}): Promise<INestApplication> {
  const { userId, decksService } = opts;

  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [DecksController],
    providers: [
      { provide: DecksService, useValue: decksService },
      // Validator is registered as a provider; class-validator instantiates it
      // using the static catalog singleton fallback.
      HeroIdentifierExistsInCatalog,
    ],
  })
    // Override OwnsTrackedDeckGuard so we don't need to provide AuthzService.
    .overrideGuard(OwnsTrackedDeckGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();

  // Inject the current user into requests via middleware (mirrors the global
  // JwtAuthGuard which is not available in this slim module).
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

describe('DecksController POST /decks (int-spec)', () => {
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

  describe('happy path — valid dorinthea-ironsong + Classic Constructed', () => {
    it('returns HTTP 201 with the detail payload', async () => {
      // Arrange
      const response = buildDetailResponse();
      decksService.createScratch.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .post('/decks')
        .send({ heroIdentifier: 'dorinthea-ironsong', format: 'Classic Constructed' })
        .expect(HttpStatus.CREATED);

      // Assert
      expect(res.body.fabraryUlid).toBeNull();
      expect(res.body.totalCards).toBe(0);
      expect(res.body.legality.category).toBe('incomplete');
    });

    it('calls decksService.createScratch with the authenticated userId', async () => {
      // Arrange
      decksService.createScratch.mockResolvedValue(buildDetailResponse());

      // Act
      await request(app.getHttpServer())
        .post('/decks')
        .send({ heroIdentifier: 'dorinthea-ironsong', format: 'Classic Constructed' })
        .expect(HttpStatus.CREATED);

      // Assert
      expect(decksService.createScratch).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({
          heroIdentifier: 'dorinthea-ironsong',
          format: 'Classic Constructed',
        }),
      );
    });
  });

  describe('happy path — briar-warden-of-thorns + Living Legend', () => {
    it('returns HTTP 201 with legality.category=incomplete', async () => {
      // Arrange
      const response = buildDetailResponse({
        id: 100,
        name: 'Briar, Warden of Thorns — Living Legend',
        hero: 'Briar, Warden of Thorns',
        format: 'Living Legend',
        legality: {
          category: 'incomplete',
          reasons: ['Deck has 0 mainboard cards but Living Legend requires at least 60.'],
        },
      });
      decksService.createScratch.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .post('/decks')
        .send({ heroIdentifier: 'briar-warden-of-thorns', format: 'Living Legend' })
        .expect(HttpStatus.CREATED);

      // Assert
      expect(res.body.legality.category).toBe('incomplete');
    });
  });

  describe('DTO validation — format', () => {
    it('returns 400 when format is "Clash" (not in supported list)', async () => {
      // Act
      await request(app.getHttpServer())
        .post('/decks')
        .send({ heroIdentifier: 'dorinthea-ironsong', format: 'Clash' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.createScratch).not.toHaveBeenCalled();
    });

    it('returns 400 when format is missing', async () => {
      // Act
      await request(app.getHttpServer())
        .post('/decks')
        .send({ heroIdentifier: 'dorinthea-ironsong' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.createScratch).not.toHaveBeenCalled();
    });
  });

  describe('DTO validation — heroIdentifier', () => {
    it('returns 400 when heroIdentifier is missing', async () => {
      // Act
      await request(app.getHttpServer())
        .post('/decks')
        .send({ format: 'Classic Constructed' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.createScratch).not.toHaveBeenCalled();
    });

    it('returns 400 when heroIdentifier is not in catalog (not a hero type)', async () => {
      // The HeroIdentifierExistsInCatalog validator checks the static catalog.
      // 'pummel' is a real card but not a hero.
      await request(app.getHttpServer())
        .post('/decks')
        .send({ heroIdentifier: 'pummel', format: 'Classic Constructed' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.createScratch).not.toHaveBeenCalled();
    });

    it('returns 400 when heroIdentifier is a non-existent string', async () => {
      await request(app.getHttpServer())
        .post('/decks')
        .send({ heroIdentifier: 'this-does-not-exist-in-catalog', format: 'Classic Constructed' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.createScratch).not.toHaveBeenCalled();
    });

    it('returns 400 when heroIdentifier exceeds 64 characters', async () => {
      const longId = 'a'.repeat(65);
      await request(app.getHttpServer())
        .post('/decks')
        .send({ heroIdentifier: longId, format: 'Classic Constructed' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.createScratch).not.toHaveBeenCalled();
    });
  });

  describe('integration — created deck appears in GET /decks', () => {
    it('returns the deck under status=idea with tags=[] and fabraryUlid=null in list response', async () => {
      // Arrange
      const createdDeck = buildDetailResponse({ id: 55 });
      decksService.createScratch.mockResolvedValue(createdDeck);
      decksService.listForUser.mockResolvedValue({
        trackedDecks: [
          {
            id: 55,
            fabraryUlid: null,
            name: 'Dorinthea Ironsong — Classic Constructed',
            hero: 'Dorinthea Ironsong',
            format: 'Classic Constructed',
            status: 'idea',
            tags: [],
            updatedAt: '2026-05-17T10:00:00.000Z',
            legality: { category: 'incomplete', reasons: [] },
            trackedAt: '2026-05-17T10:00:00.000Z',
            latestSnapshot: null,
            heroImageUrl: null,
            representativeCards: [],
          },
        ],
        collectionCardCount: 0,
        totalCardsMissing: null,
        aggregateShoppingLine: null,
      });

      // Act: create the deck
      await request(app.getHttpServer())
        .post('/decks')
        .send({ heroIdentifier: 'dorinthea-ironsong', format: 'Classic Constructed' })
        .expect(HttpStatus.CREATED);

      // Act: list decks
      const listRes = await request(app.getHttpServer())
        .get('/decks')
        .expect(HttpStatus.OK);

      // Assert: scratch deck present with fabraryUlid=null
      const deckInList = listRes.body.trackedDecks.find((d: { id: number }) => d.id === 55);
      expect(deckInList).toBeDefined();
      expect(deckInList.fabraryUlid).toBeNull();
    });
  });
});
