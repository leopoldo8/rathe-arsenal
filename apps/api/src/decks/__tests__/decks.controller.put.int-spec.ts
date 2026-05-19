/**
 * Integration tests for PUT /decks/:deckId (U6).
 *
 * Tests route wiring, DTO validation, guard behaviour, and response shape
 * using a slim NestJS app with no database. The real JwtAuthGuard is absent
 * because it lives at APP_GUARD scope; we inject the user shape via middleware.
 * OwnsTrackedDeckGuard is overridden to keep tests focused on the PUT contract.
 *
 * Guard 404 behaviour is tested using a dedicated guard instance that throws
 * NotFoundException.
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
import { HeroIdentifierExistsInCatalog } from '../validators/hero-identifier-exists.validator';
import { ITrackedDeckDetailResponse } from '../dtos/tracked-deck-detail.response.dto';

const USER_ID = 'user-uuid-put-int';
const DECK_ID = 77;

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
    updatedAt: '2026-05-17T12:00:00.000Z',
    totalCards: 60,
    latestSnapshot: null,
    rejectedCount: 0,
    approvedCount: 0,
    pendingCount: 0,
    decisions: [],
    shoppingLine: null,
    legality: { category: 'legal', reasons: [] },
    ...overrides,
  };
}

async function buildApp(opts: {
  userId: string;
  decksService: jest.Mocked<DecksService>;
  guardOverride?: { canActivate: () => boolean | Promise<boolean> };
}): Promise<INestApplication> {
  const { userId, decksService, guardOverride } = opts;

  const builder = Test.createTestingModule({
    controllers: [DecksController],
    providers: [
      { provide: DecksService, useValue: decksService },
      // Validator registered as a provider — falls back to static catalog
      // singleton (as documented in validator and module).
      HeroIdentifierExistsInCatalog,
    ],
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function validBody(overrides: Partial<{
  cards: object[];
  heroIdentifier: string;
  format: string;
}> = {}): object {
  return {
    cards: [
      { cardIdentifier: 'snatch-red', quantity: 3, slot: 'mainboard' },
    ],
    heroIdentifier: 'dorinthea-ironsong',
    format: 'Classic Constructed',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('DecksController PUT /decks/:deckId (int-spec)', () => {
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

  describe('happy path — valid body returns 200 with legality=legal', () => {
    it('routes to service.updateComposition and returns the detail payload', async () => {
      // Arrange
      const response = buildDetailResponse({ legality: { category: 'legal', reasons: [] } });
      decksService.updateComposition.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .put(`/decks/${DECK_ID}`)
        .send(validBody())
        .expect(HttpStatus.OK);

      // Assert
      expect(res.body.legality.category).toBe('legal');
      expect(decksService.updateComposition).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        expect.objectContaining({
          heroIdentifier: 'dorinthea-ironsong',
          format: 'Classic Constructed',
        }),
      );
    });
  });

  describe('happy path — empty cards array is accepted', () => {
    it('returns 200 with legality=incomplete for zero cards', async () => {
      // Arrange
      const response = buildDetailResponse({
        totalCards: 0,
        legality: { category: 'incomplete', reasons: ['Deck has 0 mainboard cards.'] },
      });
      decksService.updateComposition.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .put(`/decks/${DECK_ID}`)
        .send(validBody({ cards: [] }))
        .expect(HttpStatus.OK);

      // Assert
      expect(res.body.legality.category).toBe('incomplete');
      expect(res.body.totalCards).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Error paths — DTO validation
  // ---------------------------------------------------------------------------

  describe('error path — 151 cards triggers 400', () => {
    it('returns 400 when cards array exceeds 150 entries', async () => {
      // Arrange
      const cards = Array.from({ length: 151 }, (_, i) => ({
        cardIdentifier: `card-${i}`,
        quantity: 1,
        slot: 'mainboard',
      }));

      // Act & Assert
      await request(app.getHttpServer())
        .put(`/decks/${DECK_ID}`)
        .send(validBody({ cards }))
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.updateComposition).not.toHaveBeenCalled();
    });
  });

  describe('error path — quantity=5 triggers 400', () => {
    it('returns 400 when a card has quantity > 4', async () => {
      // Arrange
      const cards = [{ cardIdentifier: 'snatch-red', quantity: 5, slot: 'mainboard' }];

      // Act & Assert
      await request(app.getHttpServer())
        .put(`/decks/${DECK_ID}`)
        .send(validBody({ cards }))
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.updateComposition).not.toHaveBeenCalled();
    });
  });

  describe('error path — quantity=0 triggers 400', () => {
    it('returns 400 when a card has quantity < 1', async () => {
      // Arrange
      const cards = [{ cardIdentifier: 'snatch-red', quantity: 0, slot: 'mainboard' }];

      // Act & Assert
      await request(app.getHttpServer())
        .put(`/decks/${DECK_ID}`)
        .send(validBody({ cards }))
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('error path — invalid slot triggers 400', () => {
    it('returns 400 when slot is not in the allowed set', async () => {
      // Arrange
      const cards = [{ cardIdentifier: 'snatch-red', quantity: 3, slot: 'sideboard' }];

      // Act & Assert
      await request(app.getHttpServer())
        .put(`/decks/${DECK_ID}`)
        .send(validBody({ cards }))
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('error path — heroIdentifier not in catalog triggers 400', () => {
    it('returns 400 when heroIdentifier is not a known hero', async () => {
      // The HeroIdentifierExistsInCatalog validator uses the real static catalog.
      // 'not-a-real-hero' is not in the catalog so it will fail validation.
      await request(app.getHttpServer())
        .put(`/decks/${DECK_ID}`)
        .send(validBody({ heroIdentifier: 'not-a-real-hero' }))
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.updateComposition).not.toHaveBeenCalled();
    });
  });

  describe('error path — format=Clash triggers 400', () => {
    it('returns 400 when format is not in the supported list', async () => {
      await request(app.getHttpServer())
        .put(`/decks/${DECK_ID}`)
        .send(validBody({ format: 'Clash' }))
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.updateComposition).not.toHaveBeenCalled();
    });
  });

  describe('error path — missing required fields', () => {
    it('returns 400 when heroIdentifier is missing', async () => {
      const { heroIdentifier: _omitted, ...bodyWithoutHero } = validBody() as {
        heroIdentifier: string;
        cards: object[];
        format: string;
      };

      await request(app.getHttpServer())
        .put(`/decks/${DECK_ID}`)
        .send(bodyWithoutHero)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  // ---------------------------------------------------------------------------
  // Error path — guard throws 404 for another user's deck
  // ---------------------------------------------------------------------------

  describe('error path — another user deck → 404', () => {
    it('returns 404 when OwnsTrackedDeckGuard throws NotFoundException', async () => {
      // Arrange — rebuild app with a guard that throws NotFoundException
      await app.close();
      app = await buildApp({
        userId: USER_ID,
        decksService: createMock<DecksService>(),
        guardOverride: {
          canActivate: () => {
            throw new NotFoundException('Tracked deck not found');
          },
        },
      });

      // Act & Assert
      await request(app.getHttpServer())
        .put(`/decks/${DECK_ID}`)
        .send(validBody())
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ---------------------------------------------------------------------------
  // Response shape
  // ---------------------------------------------------------------------------

  describe('response shape — legality field is present', () => {
    it('response includes legality.category and legality.reasons', async () => {
      // Arrange
      const response = buildDetailResponse({
        legality: { category: 'legal', reasons: [] },
      });
      decksService.updateComposition.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .put(`/decks/${DECK_ID}`)
        .send(validBody())
        .expect(HttpStatus.OK);

      // Assert
      expect(res.body).toHaveProperty('legality');
      expect(res.body.legality).toHaveProperty('category', 'legal');
      expect(res.body.legality).toHaveProperty('reasons');
      expect(Array.isArray(res.body.legality.reasons)).toBe(true);
    });
  });

  describe('response shape — updatedAt is present', () => {
    it('response includes updatedAt and trackedAt', async () => {
      // Arrange
      const response = buildDetailResponse({
        trackedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-05-17T12:00:00.000Z',
      });
      decksService.updateComposition.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .put(`/decks/${DECK_ID}`)
        .send(validBody())
        .expect(HttpStatus.OK);

      // Assert
      expect(res.body.trackedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(res.body.updatedAt).toBe('2026-05-17T12:00:00.000Z');
    });
  });

  // ---------------------------------------------------------------------------
  // All four valid formats are accepted
  // ---------------------------------------------------------------------------

  describe.each([
    'Classic Constructed',
    'Blitz',
    'Living Legend',
    'Silver Age',
  ])('happy path — format=%s is accepted', (format) => {
    it(`routes to service.updateComposition with format="${format}"`, async () => {
      // Arrange
      const response = buildDetailResponse({ format });
      decksService.updateComposition.mockResolvedValue(response);

      // Act
      await request(app.getHttpServer())
        .put(`/decks/${DECK_ID}`)
        .send(validBody({ format }))
        .expect(HttpStatus.OK);

      // Assert
      expect(decksService.updateComposition).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        expect.objectContaining({ format }),
      );
    });
  });
});
